"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Comments from "@/app/components/Comments";
import StarRating from "@/app/components/StarRating";
import ViewTracker from "@/app/components/ViewTracker";

const COUNTDOWN_SECONDS = 5;

type VideoPayload = {
  id: string;
  slug: string;
  title: string;
  embedUrl: string;
  isShowcase: boolean;
  viewsCount: number;
  avgStars: number;
  starsCount: number;
};

type RelatedVideo = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  avgStars: number;
};

type VideoPlaybackProps = {
  initialVideo: VideoPayload;
  relatedVideos: RelatedVideo[];
  canRateStars: boolean;
  canPostComment: boolean;
  canVoteComments: boolean;
  canViewPremium: boolean;
  isAdminOrMod?: boolean;
};

const ENDED_EVENT_TOKENS = new Set([
  "ended",
  "videoended",
  "playerended",
  "ph5playerended",
  "ph5ended",
  "playbackended",
]);

function normalizeEventToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isEndedToken(token: string) {
  if (!token) return false;
  if (ENDED_EVENT_TOKENS.has(token)) return true;
  if (token.includes("suspend")) return false;
  return token.endsWith("ended");
}

function isVideoEndedMessage(data: unknown): boolean {
  if (!data) return false;
  if (data === "ended") return true;
  if (typeof data === "string") {
    if (isEndedToken(normalizeEventToken(data))) return true;
    try {
      return isVideoEndedMessage(JSON.parse(data));
    } catch {
      return false;
    }
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const eventValue =
      obj.event ?? obj.type ?? obj.state ?? obj.message ?? obj.action ?? obj.name ?? obj.status;
    if (isVideoEndedMessage(eventValue)) return true;
    if (isVideoEndedMessage(obj.data)) return true;
  }
  return false;
}

export default function VideoPlayback({
  initialVideo,
  relatedVideos,
  canRateStars,
  canPostComment,
  canVoteComments,
  canViewPremium,
  isAdminOrMod,
}: VideoPlaybackProps) {
  const [currentVideo, setCurrentVideo] = useState<VideoPayload>(initialVideo);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentVideoRef = useRef(currentVideo);
  const loadingRef = useRef(false);

  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  useEffect(() => {
    setCountdown(null);
  }, [currentVideo.id]);

  const playNextVideo = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingNext(true);

    try {
      const excludeViewkey = currentVideoRef.current.slug;
      const res = await fetch(
        `/api/videos/next?excludeViewkey=${encodeURIComponent(excludeViewkey)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok || !data.next) return;
      setCurrentVideo(data.next as VideoPayload);
    } catch {
      // ignore fetch errors
    } finally {
      loadingRef.current = false;
      setIsLoadingNext(false);
    }
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      playNextVideo();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, playNextVideo]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isVideoEndedMessage(event.data)) return;
      if (loadingRef.current) return;
      setCountdown((prev) => (prev === null ? COUNTDOWN_SECONDS : prev));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ViewTracker videoId={currentVideo.id} />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {currentVideo.title}
          </h1>
          <div className="mt-1 text-xs text-white/50 font-mono break-all">
            {currentVideo.slug}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`text-[10px] px-3 py-1 rounded-full border ${
                currentVideo.isShowcase
                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
                  : "bg-pink-500/20 border-pink-400/30 text-pink-200"
              }`}
            >
              {currentVideo.isShowcase ? "free" : "premium"}
            </span>
            <span className="text-xs text-white/40">
              Views: {currentVideo.viewsCount.toLocaleString()}
            </span>
            {currentVideo.starsCount > 0 && (
              <span className="text-xs text-yellow-400">
                &#9733; {currentVideo.avgStars.toFixed(1)} ({currentVideo.starsCount})
              </span>
            )}
          </div>
        </div>

        <Link
          href="/videos"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
        >
          Back to Videos
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <div className="neon-border rounded-2xl overflow-hidden bg-black/30">
            <div className="aspect-video bg-black relative">
              {currentVideo.embedUrl ? (
                <iframe
                  ref={iframeRef}
                  key={currentVideo.id}
                  src={currentVideo.embedUrl}
                  frameBorder={0}
                  width="100%"
                  height="100%"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  Video embed not configured
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-2xl md:text-3xl font-semibold">
                  Next video starting in {countdown}...
                </div>
              )}

              {isLoadingNext && countdown === null && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-lg">
                  Loading next video...
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 md:mt-6">
            <StarRating videoId={currentVideo.id} readOnly={!canRateStars} />
          </div>

          <Comments
            videoId={currentVideo.id}
            canPost={canPostComment}
            canVote={canVoteComments}
            isAdminOrMod={isAdminOrMod}
          />
        </div>

        <div className="lg:col-span-1 mt-4 lg:mt-0">
          <h2 className="text-lg font-semibold neon-text mb-4">More Videos</h2>

          {relatedVideos.length === 0 ? (
            <p className="text-white/50 text-sm">No other videos available.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
              {relatedVideos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.slug}`}
                  className="flex flex-col lg:flex-row gap-2 lg:gap-3 group"
                >
                  <div className="relative w-full lg:w-32 shrink-0 aspect-video bg-black/60 rounded-lg overflow-hidden">
                    {v.thumbnailUrl ? (
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs lg:text-sm font-medium text-white line-clamp-2 group-hover:text-pink-300 transition">
                      {v.title}
                    </div>
                    <div className="mt-1 text-[10px] lg:text-xs text-white/50">
                      {v.avgStars > 0 && (
                        <span className="text-yellow-400">
                          &#9733; {v.avgStars.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!canViewPremium && (
            <div className="mt-6 neon-border rounded-xl p-4 bg-black/30">
              <h3 className="text-sm font-semibold text-white mb-2">Want more?</h3>
              <p className="text-xs text-white/60 mb-3">
                Upgrade to unlock the full premium catalog.
              </p>
              <Link
                href="/signup"
                className="block w-full text-center px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-100 text-sm font-semibold transition"
              >
                Upgrade
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
