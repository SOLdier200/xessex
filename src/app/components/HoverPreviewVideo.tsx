"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string | null;
  alt?: string;

  // Segment surfing
  segmentLen?: number; // seconds shown per segment
  segments?: number;   // number of evenly spaced segments
  startAt?: number;

  // UX/perf controls
  hoverStartDelayMs?: number; // wait before starting playback (default 150)
  fadeInDelayMs?: number;     // delay before fading video visible (default 90)
  fadeDurationMs?: number;    // opacity transition duration (default 180)

  className?: string;
  videoClassName?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Global event name for "one at a time"
const STOP_ALL_EVENT = "xessex-hover-preview-stop-all";

export default function HoverPreviewVideo({
  src,
  poster,
  alt,

  segmentLen = 2,
  segments = 8,
  startAt = 0,

  hoverStartDelayMs = 150,
  fadeInDelayMs = 90,
  fadeDurationMs = 180,

  className,
  videoClassName,
}: Props) {
  const instanceIdRef = useRef<string>(
    // stable id per instance
    `hpv_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hoverIntentTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const jumpTimerRef = useRef<number | null>(null);

  const hoveringRef = useRef(false);
  const canPreviewRef = useRef(false);

  const [duration, setDuration] = useState<number | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  // --- Stop handler (so others can tell this instance to stop)
  useEffect(() => {
    const onStopAll = (e: Event) => {
      // ignore if this instance started the event
      const detail = (e as CustomEvent).detail as { exceptId?: string } | undefined;
      if (detail?.exceptId && detail.exceptId === instanceIdRef.current) return;
      stopPreview();
    };

    window.addEventListener(STOP_ALL_EVENT, onStopAll as EventListener);
    return () => window.removeEventListener(STOP_ALL_EVENT, onStopAll as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const broadcastStopOthers = () => {
    // Tell all other instances to stop (except this one)
    window.dispatchEvent(
      new CustomEvent(STOP_ALL_EVENT, { detail: { exceptId: instanceIdRef.current } })
    );
  };

  // --- IntersectionObserver: only allow preview when on screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        canPreviewRef.current = !!entry?.isIntersecting;

        // If it scrolls off-screen while playing, stop cleanly
        if (!canPreviewRef.current && hoveringRef.current) {
          stopPreview();
        }
      },
      { threshold: 0.2 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverIntentTimerRef.current) window.clearTimeout(hoverIntentTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      if (jumpTimerRef.current) window.clearInterval(jumpTimerRef.current);
      hoverIntentTimerRef.current = null;
      fadeTimerRef.current = null;
      jumpTimerRef.current = null;
    };
  }, []);

  const buildSegmentTimes = (dur: number) => {
    // Avoid very beginning/end (often fades/black)
    const safeStart = Math.min(2, Math.max(0, dur * 0.02));
    const safeEnd = Math.max(0, dur - Math.min(2, Math.max(0, dur * 0.03)));
    const usable = Math.max(0, safeEnd - safeStart);

    const segCount = Math.max(2, segments);
    const step = usable / (segCount - 1);

    const times: number[] = [];
    for (let i = 0; i < segCount; i++) {
      times.push(clamp(safeStart + i * step, 0, Math.max(0, dur - 0.25)));
    }
    return times;
  };

  const beginJumpCycle = (dur: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (jumpTimerRef.current) return;

    const times = buildSegmentTimes(dur);

    // Choose starting segment closest to startAt
    let idx = 0;
    if (startAt > 0) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < times.length; i++) {
        const d = Math.abs(times[i] - startAt);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      idx = best;
    }

    try {
      v.currentTime = times[idx];
    } catch {}

    jumpTimerRef.current = window.setInterval(() => {
      const vv = videoRef.current;
      if (!vv || !hoveringRef.current || !canPreviewRef.current) return;

      idx = (idx + 1) % times.length;
      try {
        vv.currentTime = times[idx];
        void vv.play().catch(() => {});
      } catch {}
    }, Math.max(0.5, segmentLen) * 1000);
  };

  const actuallyStartPreview = async () => {
    if (!hoveringRef.current || !canPreviewRef.current) return;

    const v = videoRef.current;
    if (!v) return;

    try {
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";

      if (v.readyState < 1) v.load();
      if (startAt > 0) v.currentTime = startAt;

      await v.play();
    } catch {
      // ignore autoplay failures
    }

    // Fade in AFTER a small delay (prevents flicker)
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      if (hoveringRef.current && canPreviewRef.current) setIsVideoVisible(true);
    }, fadeInDelayMs);

    // Start segment surfing if duration known
    const dur =
      duration ??
      (v.duration && Number.isFinite(v.duration) ? v.duration : null);
    if (dur) beginJumpCycle(dur);
  };

  const startPreview = () => {
    hoveringRef.current = true;
    setShouldLoad(true); // mount the video source on first hover

    // Stop all other previews immediately (no overlap ever)
    broadcastStopOthers();

    if (!canPreviewRef.current) return;

    // Hover intent delay
    if (hoverIntentTimerRef.current) window.clearTimeout(hoverIntentTimerRef.current);
    hoverIntentTimerRef.current = window.setTimeout(() => {
      void actuallyStartPreview();
    }, hoverStartDelayMs);
  };

  const stopPreview = () => {
    hoveringRef.current = false;

    if (hoverIntentTimerRef.current) window.clearTimeout(hoverIntentTimerRef.current);
    hoverIntentTimerRef.current = null;

    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = null;

    if (jumpTimerRef.current) window.clearInterval(jumpTimerRef.current);
    jumpTimerRef.current = null;

    // Hide video so poster shows (fixes black frame issue)
    setIsVideoVisible(false);

    const v = videoRef.current;
    if (!v) return;

    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ""}`}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      aria-label={alt}
    >
      {/* Always-visible thumbnail */}
      {poster ? (
        <img
          src={poster}
          alt={alt ?? ""}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-white/30 bg-black/60">
          No Thumbnail
        </div>
      )}

      {/* Video overlay: only mounted after first hover to prevent autoplay */}
      {shouldLoad && (
        <video
          ref={videoRef}
          preload="metadata"
          muted
          playsInline
          controls={false}
          className={[
            "absolute inset-0 w-full h-full object-cover",
            "transition-opacity",
            isVideoVisible ? "opacity-100" : "opacity-0",
            videoClassName ?? "",
          ].join(" ")}
          style={{ transitionDuration: `${fadeDurationMs}ms` }}
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (!v) return;

            const dur = v.duration;
            if (Number.isFinite(dur) && dur > 1) {
              setDuration(dur);
              if (hoveringRef.current && canPreviewRef.current) beginJumpCycle(dur);
            }
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
