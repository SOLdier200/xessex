"use client";

import { useEffect, useState, useMemo } from "react";

/**
 * Computes milliseconds until the next XESS reward payout.
 * P1 pays out Wednesday 23:59 PT, P2 pays out Saturday 23:59 PT.
 */
function getNextPayout(): { ms: number; label: string } {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const dayName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const second = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);

  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[dayName] ?? 1;
  const currentSecs = hour * 3600 + minute * 60 + second;
  const TARGET_SECS = 23 * 3600 + 59 * 60; // 23:59:00 PT

  function daysUntil(targetDow: number): number {
    let d = (targetDow - dow + 7) % 7;
    if (d === 0 && currentSecs >= TARGET_SECS) d = 7;
    return d;
  }

  const daysToWed = daysUntil(3);
  const daysToSat = daysUntil(6);

  let days: number;
  let label: string;
  if (daysToWed <= daysToSat) {
    days = daysToWed;
    label = "Wednesday";
  } else {
    days = daysToSat;
    label = "Saturday";
  }

  const remainingSecs = days * 86400 + (TARGET_SECS - currentSecs);
  return { ms: remainingSecs * 1000, label: `${label} evening PT` };
}

function formatCountdown(ms: number, showSeconds = false): string {
  if (ms <= 0) return "NOW!";
  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  if (showSeconds) {
    if (d > 0) return `${d}d ${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
    if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Intensity stages:
 * 0 = calm (>24h)     — purple/blue
 * 1 = warming (12-24h) — amber glow
 * 2 = heating (6-12h)  — orange, text glow starts
 * 3 = hot (3-6h)       — orange-red, sparks begin
 * 4 = urgent (1-3h)    — red, lots of sparks, border pulse
 * 5 = critical (<1h)   — intense red/gold, heavy sparks, border flash
 * 6 = final (<15m)     — maximum intensity, rapid flash
 * 7 = payout (0)       — green celebration
 */
function getStage(ms: number): number {
  const h = ms / 3_600_000;
  if (ms <= 0) return 7;
  if (h < 0.25) return 6;  // <15 min
  if (h < 1) return 5;     // <1 hour
  if (h < 3) return 4;     // <3 hours
  if (h < 6) return 3;     // <6 hours
  if (h < 12) return 2;    // <12 hours
  if (h < 24) return 1;    // <24 hours
  return 0;                 // >24 hours
}

function getTextColor(stage: number): string {
  switch (stage) {
    case 0: return "text-purple-400";
    case 1: return "text-amber-300";
    case 2: return "text-orange-400";
    case 3: return "text-orange-500";
    case 4: return "text-red-400";
    case 5: return "text-red-500";
    case 6: return "text-yellow-300";
    case 7: return "text-green-400";
    default: return "text-purple-400";
  }
}

function getSparkColor(stage: number): string {
  switch (stage) {
    case 3: return "bg-orange-400";
    case 4: return "bg-red-400";
    case 5: return "bg-yellow-400";
    case 6: return "bg-yellow-300";
    default: return "bg-orange-400";
  }
}

function getBorderClass(stage: number): string {
  switch (stage) {
    case 0: return "border-purple-400/30";
    case 1: return "border-amber-400/40";
    case 2: return "border-orange-400/40";
    case 3: return "border-orange-500/50";
    case 4: return "animate-border-urgency";
    case 5: return "animate-border-critical";
    case 6: return "animate-border-final";
    case 7: return "border-green-400/60";
    default: return "border-purple-400/30";
  }
}

function getBgGradient(stage: number): string {
  switch (stage) {
    case 0: return "from-purple-500/10 to-purple-500/5";
    case 1: return "from-amber-500/10 to-amber-500/5";
    case 2: return "from-orange-500/12 to-orange-500/5";
    case 3: return "from-orange-500/15 to-red-500/8";
    case 4: return "from-red-500/18 to-orange-500/10";
    case 5: return "from-red-500/22 to-yellow-500/10";
    case 6: return "from-yellow-500/20 to-red-500/15";
    case 7: return "from-green-500/20 to-emerald-500/10";
    default: return "from-purple-500/10 to-purple-500/5";
  }
}

function getTextGlowClass(stage: number): string {
  if (stage >= 6) return "animate-text-glow-intense";
  if (stage >= 4) return "animate-text-glow";
  return "";
}

// How many sparks to render at each stage
function getSparkCount(stage: number, isMobile: boolean): number {
  if (stage < 3) return 0;
  const counts: Record<number, number> = { 3: 2, 4: 4, 5: 5, 6: 6 };
  const n = counts[stage] ?? 0;
  return isMobile ? Math.min(n, 3) : n;
}

type PayoutCountdownProps = {
  variant?: "compact" | "card" | "inline";
  className?: string;
  onClick?: () => void;
  showSeconds?: boolean;
};

export default function PayoutCountdown({ variant = "card", className = "", onClick, showSeconds = false }: PayoutCountdownProps) {
  const [ms, setMs] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  useEffect(() => {
    function tick() {
      const next = getNextPayout();
      setMs(next.ms);
      setLabel(next.label);
    }
    tick();
    const interval = showSeconds ? 1_000 : 30_000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [showSeconds]);

  const stage = ms !== null ? getStage(ms) : 0;
  const sparkCount = useMemo(() => getSparkCount(stage, isMobile), [stage, isMobile]);

  if (ms === null) return null;

  const countdown = formatCountdown(ms, showSeconds);
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
                style={{ top: `${20 + (i * 27) % 60}%`, left: `${10 + (i * 31) % 80}%` }}
              />
            ))}
          </div>
        )}
        <span className="relative z-10 text-white/50 font-medium"><span className="md:hidden">Xess:</span><span className="hidden md:inline">Xess Payout:</span></span>
        <span className={`relative z-10 ${color} ${glowClass} font-bold`}>{countdown}</span>
      </Tag>
    );
  }

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={[
        "relative overflow-hidden bg-gradient-to-r rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5",
        bgGrad,
        borderClass,
        "border",
        stage >= 3 ? "countdown-shimmer" : "",
        stage === 7 ? "animate-celebrate" : "",
        onClick ? "cursor-pointer hover:brightness-125 transition text-left w-full group" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {/* Spark particles — positioned around the card */}
      {sparkCount > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {Array.from({ length: sparkCount }).map((_, i) => (
            <span
              key={i}
              className={`spark spark-${(i % 6) + 1} ${sparkColor}`}
              style={{
                top: `${20 + (i * 27) % 60}%`,
                left: `${10 + (i * 31) % 80}%`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10">
        <div className={`text-[9px] sm:text-[10px] uppercase tracking-wide ${stage >= 4 ? color : "text-white/60"} ${stage >= 5 ? "opacity-80" : "opacity-100"}`}>
          {stage === 7 ? "XESS Payout!" : "Next XESS Payout"}
        </div>
        <div className={`text-xs sm:text-sm font-bold mt-0.5 ${color} ${glowClass}`}>
          {countdown}
        </div>
        <div className={`text-[8px] sm:text-[9px] ${color} opacity-50 mt-0.5`}>
          {label}
        </div>
      </div>
    </Tag>
  );
}
