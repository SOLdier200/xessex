"use client";

import { useEffect, useState } from "react";

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
    hour12: false,
  }).formatToParts(now);

  const dayName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[dayName] ?? 1;
  const currentMins = hour * 60 + minute;
  const TARGET_MINS = 23 * 60 + 59; // 23:59 PT

  function daysUntil(targetDow: number): number {
    let d = (targetDow - dow + 7) % 7;
    if (d === 0 && currentMins >= TARGET_MINS) d = 7;
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

  const remainingMins = days * 24 * 60 + (TARGET_MINS - currentMins);
  return { ms: remainingMins * 60 * 1000, label: `${label} evening PT` };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now!";
  const totalMins = Math.floor(ms / 60_000);
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getCountdownColor(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours <= 0) return "text-green-400";
  if (hours < 3) return "text-red-400";
  if (hours < 6) return "text-orange-400";
  if (hours < 12) return "text-yellow-400";
  if (hours < 24) return "text-amber-300";
  return "text-purple-400";
}

function getBorderColor(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours <= 0) return "border-green-400/50";
  if (hours < 3) return "border-red-400/50";
  if (hours < 6) return "border-orange-400/50";
  if (hours < 12) return "border-yellow-400/50";
  if (hours < 24) return "border-amber-300/40";
  return "border-purple-400/30";
}

function getGlowColor(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours <= 0) return "from-green-500/20 to-green-500/5";
  if (hours < 3) return "from-red-500/20 to-red-500/5";
  if (hours < 6) return "from-orange-500/20 to-orange-500/5";
  if (hours < 12) return "from-yellow-500/15 to-yellow-500/5";
  if (hours < 24) return "from-amber-500/15 to-amber-500/5";
  return "from-purple-500/15 to-purple-500/5";
}

type PayoutCountdownProps = {
  /** "compact" = single-line for inline use; "card" = full card with border */
  variant?: "compact" | "card";
  className?: string;
  onClick?: () => void;
};

export default function PayoutCountdown({ variant = "card", className = "", onClick }: PayoutCountdownProps) {
  const [ms, setMs] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const next = getNextPayout();
      setMs(next.ms);
      setLabel(next.label);
    }
    tick();
    const id = setInterval(tick, 30_000); // update every 30s
    return () => clearInterval(id);
  }, []);

  if (ms === null) return null;

  const countdown = formatCountdown(ms);
  const color = getCountdownColor(ms);
  const pulse = ms > 0 && ms < 3 * 3_600_000;

  if (variant === "compact") {
    return (
      <span className={`${color} ${pulse ? "animate-pulse" : ""} ${className}`}>
        {countdown}
      </span>
    );
  }

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`bg-gradient-to-r ${getGlowColor(ms)} border ${getBorderColor(ms)} rounded-xl p-4 ${onClick ? "cursor-pointer hover:brightness-125 transition text-left w-full group" : ""} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/60 uppercase tracking-wide flex items-center gap-1">
            Next XESS Payout
            {onClick && <span className="text-white/30 group-hover:text-white/50 transition text-xs">→</span>}
          </div>
          <div className={`text-2xl font-bold mt-1 ${color} ${pulse ? "animate-pulse" : ""}`}>
            {countdown}
          </div>
          {onClick && <div className="text-[10px] text-white/30 mt-1 group-hover:text-white/50 transition">View payout history</div>}
        </div>
        <div className="text-right">
          <div className={`text-xs ${color} opacity-70`}>
            {label}
          </div>
        </div>
      </div>
    </Tag>
  );
}
