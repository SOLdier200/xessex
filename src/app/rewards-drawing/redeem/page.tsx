"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RedeemPricing = {
  ok: boolean;
  pricing: {
    member: { creditsPerMonth: number };
    diamond: { creditsPerMonth: number };
  };
};

function microToCreditsStr(micro: string) {
  try {
    const v = BigInt(micro);
    const whole = v / 1000n;
    const frac = v % 1000n;
    if (frac === 0n) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return micro;
  }
}

export default function RedeemPage() {
  const [balance, setBalance] = useState<string>("0");
  const [pricing, setPricing] = useState<RedeemPricing["pricing"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tier, setTier] = useState<"MEMBER" | "DIAMOND">("MEMBER");
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ expiresAt: string; creditsUsed: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [statusRes, pricingRes] = await Promise.all([
        fetch("/api/rewards-drawing/status", { cache: "no-store" }),
        fetch("/api/rewards-drawing/redeem", { cache: "no-store" }),
      ]);

      const statusJson = await statusRes.json();
      const pricingJson = await pricingRes.json() as RedeemPricing;

      if (statusJson.ok) {
        setBalance(statusJson.creditsBalanceMicro);
      }
      if (pricingJson.ok) {
        setPricing(pricingJson.pricing);
      }
    } catch {
      setErr("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const creditsPerMonth = pricing
    ? tier === "DIAMOND"
      ? pricing.diamond.creditsPerMonth
      : pricing.member.creditsPerMonth
    : 0;

  const totalCredits = creditsPerMonth * months;
  const totalCostMicro = BigInt(totalCredits) * 1000n;
  const balanceBig = BigInt(balance || "0");
  const canAfford = balanceBig >= totalCostMicro;

  const redeem = async () => {
    setErr(null);
    setSuccess(null);
    setBusy(true);

    try {
      const res = await fetch("/api/rewards-drawing/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, months }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "redeem_failed");
      }

      setSuccess({ expiresAt: json.expiresAt, creditsUsed: json.creditsUsed });
      await fetchData(); // Refresh balance
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/rewards-drawing" className="text-cyan-400 hover:text-cyan-300 text-sm">
          &larr; Back to Rewards Drawing
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
          Redeem Credits for Membership
        </h1>
        <p className="mt-2 text-white/60">
          Use your Special Credits to get free membership time.
        </p>
      </div>

      {/* Rules reminder */}
      <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-900/10 p-4">
        <div className="text-yellow-400 font-semibold mb-2">Important</div>
        <ul className="text-white/70 text-sm space-y-1 list-disc list-inside">
          <li>Special Credits have <span className="text-white">no cash value</span></li>
          <li>Credits can only be used for: drawing entries or membership redemption</li>
          <li>Credits cannot be converted to XESS, withdrawn, or transferred</li>
        </ul>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-white/70">
          Loading...
        </div>
      )}

      {!loading && err && !success && (
        <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-6 text-red-200 mb-4">
          {err}
        </div>
      )}

      {!loading && success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-6 mb-6">
          <div className="text-emerald-400 font-semibold text-lg mb-2">Redemption Successful!</div>
          <p className="text-white/80">
            You used <span className="text-emerald-400 font-mono">{success.creditsUsed}</span> credits.
          </p>
          <p className="text-white/80 mt-1">
            Your membership now expires: <span className="text-white font-semibold">{new Date(success.expiresAt).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}</span>
          </p>
          <Link
            href="/profile"
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition"
          >
            View Profile
          </Link>
        </div>
      )}

      {!loading && pricing && !success && (
        <>
          {/* Balance */}
          <div className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5 mb-6">
            <div className="text-cyan-400/80 text-sm">Your Special Credits</div>
            <div className="text-cyan-400 font-semibold text-2xl">{microToCreditsStr(balance)}</div>
          </div>

          {/* Tier selection */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
            <div className="text-white font-semibold mb-4">Select Membership Tier</div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTier("MEMBER")}
                className={`p-4 rounded-xl border transition ${
                  tier === "MEMBER"
                    ? "border-purple-400 bg-purple-500/20"
                    : "border-white/10 bg-black/30 hover:border-white/20"
                }`}
              >
                <div className={`font-semibold ${tier === "MEMBER" ? "text-purple-400" : "text-white"}`}>
                  Member
                </div>
                <div className="text-white/60 text-sm mt-1">
                  {pricing.member.creditsPerMonth} credits/month
                </div>
              </button>
              <button
                onClick={() => setTier("DIAMOND")}
                className={`p-4 rounded-xl border transition ${
                  tier === "DIAMOND"
                    ? "border-yellow-400 bg-yellow-500/20"
                    : "border-white/10 bg-black/30 hover:border-white/20"
                }`}
              >
                <div className={`font-semibold ${tier === "DIAMOND" ? "text-yellow-400" : "text-white"}`}>
                  Diamond
                </div>
                <div className="text-white/60 text-sm mt-1">
                  {pricing.diamond.creditsPerMonth} credits/month
                </div>
              </button>
            </div>
          </div>

          {/* Months selection */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
            <div className="text-white font-semibold mb-4">Select Duration</div>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`px-4 py-2 rounded-lg border transition ${
                    months === m
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-400"
                      : "border-white/10 bg-black/30 text-white hover:border-white/20"
                  }`}
                >
                  {m} month{m > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
            <div className="text-white font-semibold mb-4">Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Tier</span>
                <span className="text-white">{tier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Duration</span>
                <span className="text-white">{months} month{months > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Cost per month</span>
                <span className="text-white">{creditsPerMonth} credits</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                <span className="text-white font-semibold">Total Cost</span>
                <span className={`font-semibold ${canAfford ? "text-cyan-400" : "text-red-400"}`}>
                  {totalCredits} credits
                </span>
              </div>
            </div>

            {!canAfford && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                Insufficient credits. You need {totalCredits} credits but only have {microToCreditsStr(balance)}.
              </div>
            )}
          </div>

          {/* Redeem button */}
          <button
            onClick={redeem}
            disabled={busy || !canAfford}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Redeeming..." : `Redeem ${totalCredits} Credits`}
          </button>
        </>
      )}
    </div>
  );
}
