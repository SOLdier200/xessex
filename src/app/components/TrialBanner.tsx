"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TrialInfo = {
  isOnTrial: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
};

export default function TrialBanner() {
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data?.authed && data?.isOnTrial) {
          setTrial({
            isOnTrial: data.isOnTrial,
            trialDaysLeft: data.trialDaysLeft,
            trialEndsAt: data.trialEndsAt,
          });
        }
      } catch {
        // Ignore
      }
    }
    fetchTrialStatus();

    const handleAuthChange = () => fetchTrialStatus();
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  if (!trial?.isOnTrial) return null;

  const urgency = trial.trialDaysLeft <= 3;

  return (
    <div
      className={`rounded-xl p-3 mb-4 ${
        urgency
          ? "bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 border border-red-400/40"
          : "bg-gradient-to-r from-emerald-500/10 via-black/30 to-emerald-500/10 border border-emerald-400/30"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`px-2 py-1 rounded-lg text-xs font-semibold ${
              urgency ? "bg-red-500/30 text-red-300" : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            FREE TRIAL
          </div>
          <span className={`text-sm ${urgency ? "text-red-200" : "text-white/80"}`}>
            {trial.trialDaysLeft === 0
              ? "Your trial expires today!"
              : trial.trialDaysLeft === 1
                ? "1 day left in your trial"
                : `${trial.trialDaysLeft} days left in your trial`}
          </span>
        </div>
        <Link
          href="/signup"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            urgency
              ? "bg-red-500/20 border border-red-400/50 text-red-300 hover:bg-red-500/30"
              : "bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 hover:bg-emerald-500/30"
          }`}
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  );
}
