"use client";

import { useEffect, useState, useMemo } from "react";

/**
 * Computes milliseconds until the next credit accrual window.
 * AM accrual happens sometime before noon PT → next window = noon PT
 * PM accrual happens sometime after noon PT → next window = midnight PT (next day)
 */
function getNextAccrual(): { ms: number; label: string } {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const second = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);

  const currentSecs = hour * 3600 + minute * 60 + second;

  if (hour < 12) {
    // Before noon PT → next accrual window is noon PT (12:00:00)
    const noonSecs = 12 * 3600;
    const remainingSecs = noonSecs - currentSecs;
    return { ms: remainingSecs * 1000, label: "PM accrual window" };
  } else {
    // After noon PT → next accrual window is midnight PT (00:00:00 next day)
    const midnightSecs = 24 * 3600;
    const remainingSecs = midnightSecs - currentSecs;
    return { ms: remainingSecs * 1000, label: "AM accrual window" };
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "NOW!";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Intensity stages (max 12h window):
 * 0 = calm (>6h)      — yellow/amber
 * 1 = warming (3-6h)   — gold
 * 2 = heating (1-3h)   — orange, text glow starts
 * 3 = hot (30m-1h)     — orange-red, sparks begin
 * 4 = urgent (10-30m)  — red, border pulse, more sparks
 * 5 = critical (<10m)  — intense, heavy sparks, border flash
 * 6 = final (<3m)      — maximum intensity
 * 7 = accrual (0)      — green celebration
 */
function getStage(ms: number): number {
  const mins = ms / 60_000;
  if (ms <= 0) return 7;
  if (mins < 3) return 6;
  if (mins < 10) return 5;
  if (mins < 30) return 4;
  if (mins < 60) return 3;
  const h = ms / 3_600_000;
  if (h < 3) return 2;
  if (h < 6) return 1;
  return 0;
}

function getTextColor(stage: number): string {
  switch (stage) {
    case 0: return "text-yellow-300";
    case 1: return "text-amber-400";
    case 2: return "text-orange-400";
    case 3: return "text-orange-500";
    case 4: return "text-red-400";
    case 5: return "text-red-500";
    case 6: return "text-yellow-200";
    case 7: return "text-green-400";
    default: return "text-yellow-300";
  }
}

function getSparkColor(stage: number): string {
  switch (stage) {
    case 3: return "bg-amber-400";
    case 4: return "bg-orange-400";
    case 5: return "bg-yellow-400";
    case 6: return "bg-yellow-300";
    default: return "bg-amber-400";
  }
}

function getBorderClass(stage: number): string {
  switch (stage) {
    case 0: return "border-yellow-400/25";
    case 1: return "border-amber-400/35";
    case 2: return "border-orange-400/40";
    case 3: return "border-orange-500/50";
    case 4: return "animate-border-urgency";
    case 5: return "animate-border-critical";
    case 6: return "animate-border-final";
    case 7: return "border-green-400/60";
    default: return "border-yellow-400/25";
  }
}

function getBgGradient(stage: number): string {
  switch (stage) {
    case 0: return "from-yellow-500/10 to-amber-500/5";
    case 1: return "from-amber-500/12 to-yellow-500/5";
    case 2: return "from-orange-500/12 to-amber-500/5";
    case 3: return "from-orange-500/15 to-red-500/8";
    case 4: return "from-red-500/18 to-orange-500/10";
    case 5: return "from-red-500/22 to-yellow-500/10";
    case 6: return "from-yellow-500/20 to-red-500/15";
    case 7: return "from-green-500/20 to-emerald-500/10";
    default: return "from-yellow-500/10 to-amber-500/5";
  }
}

function getTextGlowClass(stage: number): string {
  if (stage >= 6) return "animate-text-glow-intense";
  if (stage >= 4) return "animate-text-glow";
  return "";
}

function getSparkCount(stage: number, isMobile: boolean): number {
  if (stage < 3) return 0;
  const counts: Record<number, number> = { 3: 2, 4: 3, 5: 5, 6: 6 };
  const n = counts[stage] ?? 0;
  return isMobile ? Math.min(n, 3) : n;
}

type Props = {
  variant?: "compact" | "card" | "inline";
  className?: string;
  onClick?: () => void;
};

export default function CreditAccrualCountdown({ variant = "card", className = "", onClick }: Props) {
  const [ms, setMs] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  useEffect(() => {
    function tick() {
      const next = getNextAccrual();
      setMs(next.ms);
      setLabel(next.label);
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  const stage = ms !== null ? getStage(ms) : 0;
  const sparkCount = useMemo(() => getSparkCount(stage, isMobile), [stage, isMobile]);

  if (ms === null) return null;

  const countdown = formatCountdown(ms);
  const color = getTextColor(stage);
  const glowClass = getTextGlowClass(stage);
  const borderClass = getBorderClass(stage);
  const bgGrad = getBgGradient(stage);
  const sparkColor = getSparkColor(stage);

  if (variant === "compact") {
    return (
      <span className={`${color} ${glowClass} font-bold ${className}`}>
        {countdown}
      </span>
    );
  }

  if (variant === "inline") {
    const Tag = onClick ? "button" : "div";
    const inlineSparkCount = isMobile ? 0 : Math.min(sparkCount, 4);
    return (
      <Tag
        onClick={onClick}
        className={[
          "relative overflow-hidden inline-flex items-center gap-1 md:gap-1.5 rounded-md border whitespace-nowrap",
          "px-1.5 py-0.5 md:px-3 md:py-1.5 lg:px-4 lg:py-2",
          "text-[9px] md:text-xs lg:text-sm leading-tight",
          `bg-gradient-to-r ${bgGrad} ${borderClass}`,
          stage >= 3 && !isMobile ? "countdown-shimmer" : "",
          stage === 7 ? "animate-celebrate" : "",
          onClick ? "cursor-pointer hover:brightness-125 active:scale-[0.97] transition-all text-left" : "",
          className,
        ].filter(Boolean).join(" ")}
      >
        {inlineSparkCount > 0 && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {Array.from({ length: inlineSparkCount }).map((_, i) => (
              <span
                key={i}
                className={`spark spark-${(i % 6) + 1} ${sparkColor}`}
                style={{ top: `${15 + (i * 23) % 65}%`, left: `${8 + (i * 29) % 82}%` }}
              />
            ))}
          </div>
        )}
        <span className="relative z-10 text-white/50 font-medium"><span className="md:hidden">Credits:</span><span className="hidden md:inline">Credit Payout:</span></span>
        <span className={`relative z-10 ${color} ${glowClass} font-bold`}>{countdown}</span>
      </Tag>
    );
  }

  return (
    <div
      className={[
        "relative overflow-hidden bg-gradient-to-r rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5",
        bgGrad,
        borderClass,
        "border",
        stage >= 3 ? "countdown-shimmer" : "",
        stage === 7 ? "animate-celebrate" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {/* Spark particles */}
      {sparkCount > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {Array.from({ length: sparkCount }).map((_, i) => (
            <span
              key={i}
              className={`spark spark-${(i % 6) + 1} ${sparkColor}`}
              style={{
                top: `${15 + (i * 23) % 65}%`,
                left: `${8 + (i * 29) % 82}%`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10">
        <div className={`text-[9px] sm:text-[10px] uppercase tracking-wide ${stage >= 4 ? color : "text-yellow-300/60"} ${stage >= 5 ? "opacity-80" : "opacity-100"}`}>
          {stage === 7 ? "Credits Accruing!" : "Next Credit Payout"}
        </div>
        <div className={`text-xs sm:text-sm font-bold mt-0.5 ${color} ${glowClass}`}>
          {countdown}
        </div>
        <div className={`text-[8px] sm:text-[9px] ${color} opacity-50 mt-0.5`}>
          {label}
        </div>
      </div>
    </div>
  );
}
