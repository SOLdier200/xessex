"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";

type PhaseStatus = "done" | "now" | "next";

type RoadmapPhase = {
  id: string;
  status: PhaseStatus;
  title: string;
  subtitle: string;
  bullets: React.ReactNode[];
};

const PHASES: RoadmapPhase[] = [
  {
    id: "phase0",
    status: "done",
    title: "Phase 0 — Complete",
    subtitle: "Foundation shipped",
    bullets: [
      "Blueprint 4.0 finalized",
      "Wallet authentication live",
      "Unlock system deployed",
      "Rewards engine active",
      "100+ Top Quality Videos",
      "Beta testing started",
      "Whitepaper/Tokenomics Drafted",
    ],
  },
  {
    id: "phase1",
    status: "now",
    title: "Phase 1 — Now",
    subtitle: "Mainnet Launch",
    bullets: [
      "Public roadmap + transparency panel",
      "Rewards Drawing Implemented",
      "UI/UX polish",
      "Credit tuning & balancing",
      "Anti-abuse tuning v1",
    ],
  },
  {
    id: "phase2",
    status: "next",
    title: "Phase 2 — Expansion",
    subtitle: "Platform growth",
    bullets: [
      <>Private Presale — <Link href="/launch" className="text-pink-400 hover:text-pink-300 underline underline-offset-2">Join Presale</Link></>,
      "Public Presale",
      "Liquidity seeded & locked",
      "Mainnet rewards activation",
      "First owned content deployed",
      "Automated anti-abuse systems",
    ],
  },
  {
    id: "phase3",
    status: "next",
    title: "Phase 3 — Growth",
    subtitle: "Scaling up",
    bullets: [
      "Weekly content additions",
      "Partner onboarding",
      "Partner embed system",
      "Governance experiments",
    ],
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusStyles(status: PhaseStatus) {
  if (status === "done") {
    return {
      card: "border-white/10 bg-white/[0.025]",
      badge: "bg-white/10 text-white/80",
      glow: "shadow-[0_0_60px_rgba(255,255,255,0.06)]",
      dot: "bg-white/60",
      ring: "ring-white/20",
      title: "text-white/90",
      sub: "text-white/60",
    };
  }
  if (status === "now") {
    return {
      card: "border-white/25 bg-white/[0.07]",
      badge: "bg-white/15 text-white",
      glow: "shadow-[0_0_120px_rgba(255,255,255,0.18)]",
      dot: "bg-white",
      ring: "ring-white/40",
      title: "text-white",
      sub: "text-white/70",
    };
  }
  return {
    card: "border-white/10 bg-white/[0.02]",
    badge: "bg-white/10 text-white/70",
    glow: "shadow-[0_0_40px_rgba(255,255,255,0.05)]",
    dot: "bg-white/40",
    ring: "ring-white/15",
    title: "text-white/85",
    sub: "text-white/60",
  };
}

/**
 * Small starfield with parallax drift. All white-on-black; subtle opacity.
 * We generate deterministic stars (client side) so it doesn't look repetitive.
 */
function StarfieldParallax() {
  const layer1 = React.useMemo(() => makeStars(70, 1), []);
  const layer2 = React.useMemo(() => makeStars(45, 2), []);
  const layer3 = React.useMemo(() => makeStars(28, 3), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <StarLayer stars={layer1} opacityClass="opacity-[0.10]" drift="slow" />
      <StarLayer stars={layer2} opacityClass="opacity-[0.08]" drift="medium" />
      <StarLayer stars={layer3} opacityClass="opacity-[0.06]" drift="fast" />
      {/* vignette keeps it deep black */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(0,0,0,0)_45%,rgba(0,0,0,0.85)_85%)]" />
    </div>
  );
}

type Star = { x: number; y: number; r: number };
function makeStars(n: number, seed: number): Star[] {
  // Simple deterministic RNG for stable stars
  let s = seed * 99991;
  const rand = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: n }, () => ({
    x: Math.round(rand() * 1000) / 10, // 0..100
    y: Math.round(rand() * 1000) / 10, // 0..100
    r: Math.max(0.6, Math.round(rand() * 1.8 * 10) / 10),
  }));
}

function StarLayer({
  stars,
  opacityClass,
  drift,
}: {
  stars: Star[];
  opacityClass: string;
  drift: "slow" | "medium" | "fast";
}) {
  const dur = drift === "slow" ? 28 : drift === "medium" ? 20 : 14;
  const dist = drift === "slow" ? 16 : drift === "medium" ? 28 : 44;

  return (
    <motion.div
      aria-hidden
      className={cn("absolute inset-0", opacityClass)}
      animate={{ x: [-dist, dist, -dist], y: [dist, -dist, dist] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    >
      {stars.map((st, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: `${st.r}px`,
            height: `${st.r}px`,
          }}
        />
      ))}
    </motion.div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function RoadmapMarquee() {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  // We'll animate this motion value directly.
  const rawX = useMotionValue(0);

  // Mobile tuning: spring the displayed X for a heavier, premium drag feel.
  const x = useSpring(rawX, {
    stiffness: 170,
    damping: 26,
    mass: 0.9,
  });

  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number>(0);

  // Duplicate phases for continuous drift illusion
  const trackPhases = React.useMemo(() => [...PHASES, ...PHASES], []);

  // Used to compute bounds + center NOW
  const boundsRef = React.useRef({ min: -8000, max: 0, wrapAt: 4000 });

  // Build a "completed trail" (floating checks) repeated
  const trail = React.useMemo(() => {
    const done = PHASES.filter((p) => p.status === "done");
    // Repeat & flatten into small labels for a continuous stream
    const labels = done.flatMap((p) => p.bullets.map((b) => b));
    const chunk = labels.length ? labels : ["Milestone completed"];
    return [...chunk, ...chunk, ...chunk];
  }, []);

  // Compute bounds after layout
  const computeBounds = React.useCallback(() => {
    const viewport = viewportRef.current;
    const trackEl = trackRef.current;
    if (!viewport || !trackEl) return;

    const viewportW = viewport.clientWidth;
    const trackW = trackEl.scrollWidth;

    // We duplicated phases; wrap at half width
    const wrapAt = trackW / 2;

    // Clamp so you can't drag so far right that you see empty space
    // maxX is 0 (fully left aligned)
    const maxX = 0;

    // minX so that the end of the first "loop" can be reached
    // Keep some padding so there's always content
    const minX = -(wrapAt - viewportW * 0.35);

    boundsRef.current = { min: minX, max: maxX, wrapAt };
  }, []);

  // Auto-center NOW card on load (and resize)
  const centerNow = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nowEl = viewport.querySelector<HTMLElement>('[data-status="now"]');
    if (!nowEl) return;

    const viewportRect = viewport.getBoundingClientRect();
    const nowRect = nowEl.getBoundingClientRect();

    // Current rendered track offset is rawX; we want to adjust it so NOW center aligns to viewport center.
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const nowCenter = nowRect.left + nowRect.width / 2;

    const delta = viewportCenter - nowCenter; // positive means move track right
    const next = rawX.get() + delta;

    const { min, max } = boundsRef.current;
    rawX.set(clamp(next, min, max));
  }, [rawX]);

  React.useEffect(() => {
    computeBounds();
    // wait a frame so DOM positions settle
    const t = requestAnimationFrame(() => {
      centerNow();
      computeBounds(); // recompute after centering
    });

    const onResize = () => {
      computeBounds();
      centerNow();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("resize", onResize);
    };
  }, [computeBounds, centerNow]);

  // Auto-scroll drift (slow = premium on black)
  React.useEffect(() => {
    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      // Always scroll at constant speed
      const speedPxPerSec = 16;
      const newX = rawX.get() - speedPxPerSec * dt;

      // Wrap seamlessly when we've scrolled one full loop
      const { wrapAt } = boundsRef.current;
      if (Math.abs(newX) >= wrapAt) {
        // Jump back to start for seamless loop
        rawX.set(newX + wrapAt);
      } else {
        rawX.set(newX);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [rawX]);

  // Wheel → horizontal scroll (desktop)
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        rawX.set(rawX.get() - e.deltaY * 0.85);
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [rawX]);


  return (
    <section className="relative w-full overflow-hidden bg-black">
      {/* starfield parallax (subtle) */}
      <StarfieldParallax />

      {/* background polish for pure black */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.08] to-transparent" />
        <div className="absolute top-1/2 left-1/2 h-80 w-[80rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03] blur-[120px]" />
        {/* subtle grain illusion */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"160\" height=\"160\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"4\" stitchTiles=\"stitch\"/></filter><rect width=\"160\" height=\"160\" filter=\"url(%23n)\" opacity=\"0.25\"/></svg>')",
          }}
        />
      </div>

      {/* Ambient breathing pulse */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[180px]" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Roadmap</h2>
            <p className="mt-1 text-sm text-white/60">
              Completed milestones behind us — current focus centered — what&apos;s next ahead.
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <LegendDot label="Complete" tone="done" />
            <LegendDot label="Now" tone="now" />
            <LegendDot label="Upcoming" tone="next" />
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative mt-7 overflow-hidden rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-4"
          style={{
            // Past fades away on the left, stays clear through center/right
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 7%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 100%)",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 7%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 100%)",
          }}
        >
          {/* Completed trail behind us (subtle, fades out) */}
          <div className="pointer-events-none absolute left-0 right-0 top-3 flex items-center justify-start">
            <motion.div
              className="flex items-center gap-6 pr-24 text-[11px] tracking-wide text-white/40"
              style={{ x }}
              aria-hidden
            >
              {trail.map((t, i) => (
                <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[11px] text-white/70">
                    ✓
                  </span>
                  <span className="text-white/45">{t}</span>
                </div>
              ))}
            </motion.div>

            {/* fade edges */}
            <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-black to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-black to-transparent" />
          </div>

          {/* center NOW marker */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full border border-white/30 bg-black/70 px-4 py-1 text-[11px] tracking-widest text-white/80 backdrop-blur-xl"
            >
              CURRENT PHASE
            </motion.div>
          </div>

          {/* track */}
          <motion.div
            ref={trackRef}
            className="mt-8 flex w-max items-stretch gap-4 pr-16"
            style={{ x }}
          >
            {trackPhases.map((p, idx) => (
              <PhaseCard key={`${p.id}-${idx}`} phase={p} index={idx} />
            ))}
          </motion.div>

          {/* Past depth stack (left trailing blur) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[220px]">
            {/* Deep black falloff */}
            <div className="absolute inset-y-0 left-0 w-[220px] bg-gradient-to-r from-black via-black/80 to-transparent" />

            {/* Blur veil (makes past feel farther away) */}
            <div className="absolute inset-y-0 left-0 w-[180px] backdrop-blur-2xl" />

            {/* Inner soft shadow line for depth */}
            <div className="absolute inset-y-0 left-[140px] w-px bg-white/10 opacity-40" />

            {/* Extra haze near the extreme left edge */}
            <div className="absolute inset-y-0 left-0 w-[120px] bg-white/[0.02] blur-xl" />
          </div>

          {/* subtle fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/90 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/80 to-transparent" />

          <div className="mt-4 flex items-center justify-between text-xs text-white/50">
            <span className="hidden sm:inline">Tip: scroll wheel or drag</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => centerNow()}
                className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-white/70 hover:bg-white/[0.06]"
              >
                Center Current
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LegendDot({ label, tone }: { label: string; tone: PhaseStatus }) {
  const s = statusStyles(tone);
  return (
    <div className="flex items-center gap-2 text-xs text-white/70">
      <span className={cn("h-2 w-2 rounded-full ring-2", s.dot, s.ring)} />
      <span>{label}</span>
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
  const s = statusStyles(phase.status);
  const isNow = phase.status === "now";

  return (
    <motion.div
      data-status={phase.status}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "relative w-[320px] shrink-0 rounded-3xl border p-5 backdrop-blur",
        s.card,
        s.glow
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full ring-2", s.dot, s.ring)} />
          <span className={cn("text-sm font-medium", s.title)}>{phase.title}</span>
        </div>

        <span className={cn("rounded-full px-2.5 py-1 text-[11px]", s.badge)}>
          {phase.status === "done" ? "COMPLETED" : phase.status === "now" ? "CURRENT" : "UPCOMING"}
        </span>
      </div>

      <p className={cn("mt-2 text-sm", s.sub)}>{phase.subtitle}</p>

      <ul className="mt-4 space-y-2">
        {phase.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/70">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/40" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* NOW pulse */}
      {isNow && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[26px]"
          animate={{ opacity: [0.14, 0.32, 0.14] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.22), 0 0 100px rgba(255,255,255,0.12)",
          }}
        />
      )}
    </motion.div>
  );
}
