"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import TopNav from "../components/TopNav";

// NOWPayments hosted invoice ids
const NOWPAYMENTS_IIDS = {
  MM: "4855364671", // Member monthly $3
  MY: "4770954653", // Member yearly $30
  DM: "6120974427", // Diamond monthly $18.5
  DY: "4296776562", // Diamond yearly $185
} as const;

const POLL_EVERY_MS = 3000;
const POLL_MAX_MS = 6 * 60 * 1000; // 6 min

function Spinner() {
  return (
    <div className="inline-flex items-center gap-2 text-white/70">
      <div className="w-4 h-4 rounded-full border border-white/20 border-t-white/70 animate-spin" />
      <span className="text-sm">Waiting for payment confirmation...</span>
    </div>
  );
}

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [memberCycle, setMemberCycle] = useState<"monthly" | "yearly">("monthly");
  const [diamondCycle, setDiamondCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const diamondDisabled = true;

  // Payment waiting state
  const [waiting, setWaiting] = useState(false);
  const [pollMsg, setPollMsg] = useState<string>("");

  const pollTimerRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  function stopPolling() {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function fetchAuthStatus() {
    try {
      const r = await fetch("/api/auth/status", { cache: "no-store" });
      const data = await r.json();
      return data;
    } catch {
      return null;
    }
  }

  function startPollingMembership() {
    stopPolling();
    pollStartRef.current = Date.now();
    setWaiting(true);

    pollTimerRef.current = window.setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_MAX_MS) {
        stopPolling();
        setPollMsg(
          "Still waiting... If you already paid, it may take a moment. Keep this tab open and it will update."
        );
        return;
      }

      const auth = await fetchAuthStatus();
      if (!auth?.ok) {
        setPollMsg("Checking your membership...");
        return;
      }

      if (auth.isMember === true) {
        stopPolling();
        setPollMsg("Membership active! Redirecting...");
        setTimeout(() => router.push("/videos"), 800);
        return;
      }

      setPollMsg("Still waiting for confirmation...");
    }, POLL_EVERY_MS);
  }

  async function handleNowPayments(plan: keyof typeof NOWPAYMENTS_IIDS) {
    setLoading(true);
    setLoadingPlan(plan);

    try {
      const res = await fetch("/api/billing/nowpayments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json().catch(() => null);

      if (!data?.ok || !data?.redirectUrl) {
        const iid = NOWPAYMENTS_IIDS[plan];
        window.location.href = `https://nowpayments.io/payment/?iid=${iid}`;
        return;
      }

      window.location.href = data.redirectUrl as string;
    } catch {
      const iid = NOWPAYMENTS_IIDS[plan];
      window.location.href = `https://nowpayments.io/payment/?iid=${iid}`;
    } finally {
      setLoading(false);
      setLoadingPlan(null);
    }
  }

  // Auto-detect return from NOWPayments
  useEffect(() => {
    const w = searchParams.get("waiting");
    if (w === "1") {
      setPollMsg("Checking your membership...");
      startPollingMembership();
      return;
    }

    try {
      const ref = document.referrer || "";
      const fromNowPayments = ref.includes("nowpayments.io") || ref.includes("nowpayments");

      const cameFromPayment =
        fromNowPayments ||
        window.location.href.includes("nowpayments") ||
        window.location.search.includes("paid=1");

      if (cameFromPayment) {
        setPollMsg("Welcome back - checking your membership...");
        router.replace("/signup?waiting=1");
        startPollingMembership();
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autolaunch NOWPayments if /signup?plan=MM|MY|DM|DY
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (!planParam) return;

    const plan = planParam.toUpperCase() as keyof typeof NOWPAYMENTS_IIDS;
    if (!["MM", "MY", "DM", "DY"].includes(plan)) return;

    const key = `np_autolaunch_${plan}`;
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    }

    handleNowPayments(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const memberPlan = memberCycle === "monthly" ? "MM" : "MY";
  const diamondPlan = diamondCycle === "monthly" ? "DM" : "DY";

  return (
    <>
      {/* WAITING PANEL */}
      {waiting && (
        <div className="max-w-2xl mx-auto mb-8 neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-xl font-semibold neon-text">Waiting for payment...</h2>

          <div className="mt-3">
            <Spinner />
          </div>

          <div className="mt-3 text-sm text-white/70">
            {pollMsg || "Checking your membership..."}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => startPollingMembership()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
            >
              Refresh status
            </button>

            <button
              onClick={() => {
                stopPolling();
                setWaiting(false);
                setPollMsg("");
                router.replace("/signup");
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
            >
              Exit
            </button>
          </div>

          <div className="mt-4 text-[12px] text-white/50">
            Tip: for low-cost plans, stablecoins (USDT/USDC on TRC20/BSC/Polygon) are recommended to avoid
            coin minimums.
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold neon-text">Choose Your Membership</h1>
        <p className="mt-2 text-white/70">Select the plan that&apos;s right for you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Member Tier */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col relative overflow-hidden">
          {memberCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>
          )}

          <div className="text-center">
            <Image src="/logos/textlogo/member.png" alt="Member" width={974} height={286} priority fetchPriority="high" className="h-[58px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setMemberCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    memberCycle === "monthly"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setMemberCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    memberCycle === "yearly"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {memberCycle === "monthly" ? "$3" : "$30"}
              </span>
              <span className="text-white/60">/{memberCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {memberCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $6</div>
            )}
          </div>

          <ul className="mt-6 space-y-3 flex-1">
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              Full access to all videos
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              HD streaming quality
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              Vote on comments
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              No ads
            </li>
            <li className="flex items-center gap-2 text-white/50">
              <span className="text-red-400">&#10007;</span>
              Earn to Watch (not included)
            </li>
          </ul>

          {/* Blockchain fee warning for $3 monthly */}
          {memberCycle === "monthly" && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-400/30 rounded-lg text-xs text-orange-300/90">
              <strong>Note:</strong> For $3 payments, blockchain fees may apply. We recommend using stablecoins (USDT/USDC) on low-fee networks like TRC20, BSC, or Polygon to minimize transaction costs.
            </div>
          )}

          <button
            onClick={() => handleNowPayments(memberPlan)}
            disabled={loading || waiting}
            className={`mt-6 w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-center block ${loading ? "opacity-50" : ""}`}
          >
            {loadingPlan === memberPlan ? "Redirecting to payment..." : "Become a Member"}
          </button>
        </div>

        {/* Diamond Member Tier */}
        <div
          className={`neon-border rounded-2xl p-6 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 flex flex-col relative overflow-hidden ${
            diamondDisabled ? "opacity-60 grayscale" : ""
          }`}
        >
          {/* Diamond image positioned to right middle */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
            <img
              src="/logos/diamond3.png"
              alt="Diamond"
              className="w-24 h-24"
            />
          </div>

          {diamondCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded z-10">
              BEST VALUE
            </div>
          )}

          <div className="text-center relative z-10">
            <Image src="/logos/textlogo/diamonmember.png" alt="Diamond Member" width={1536} height={282} priority fetchPriority="high" className="h-[62px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setDiamondCycle("monthly")}
                  disabled={diamondDisabled}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    diamondCycle === "monthly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setDiamondCycle("yearly")}
                  disabled={diamondDisabled}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    diamondCycle === "yearly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {diamondCycle === "monthly" ? "$18.50" : "$185"}
              </span>
              <span className="text-white/60">/{diamondCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {diamondCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $37</div>
            )}
          </div>

          <ul className="mt-6 space-y-3 flex-1">
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              Full access to all videos
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              4K streaming quality
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              Post &amp; vote on comments
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400">&#10003;</span>
              No ads
            </li>
            <li className="flex items-center gap-2 text-white">
              <span className="text-yellow-400">&#10003;</span>
              <span className="text-yellow-400 font-semibold">
                Earn <span className="text-green-400">$</span> for rating videos
              </span>
            </li>
            <li className="flex items-center gap-2 text-white">
              <span className="text-yellow-400">&#10003;</span>
              <span className="text-yellow-400 font-semibold">Diamond Ladder rankings</span>
            </li>
            <li className="flex items-center gap-2 text-white">
              <span className="text-yellow-400">&#10003;</span>
              <span className="text-yellow-400 font-semibold">Exclusive Diamond badge</span>
            </li>
          </ul>

          {diamondDisabled && (
            <div className="mt-4 text-center text-white/70 text-sm">
              Coming Very Soon....
            </div>
          )}

          <button
            onClick={() => handleNowPayments(diamondPlan)}
            disabled={loading || waiting || diamondDisabled}
            className={`mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block disabled:opacity-50 disabled:cursor-not-allowed ${loading ? "opacity-50" : ""}`}
          >
            {diamondDisabled
              ? "Coming Very Soon...."
              : loadingPlan === diamondPlan
                ? "Redirecting to payment..."
                : "Become a Diamond Member"}
          </button>
        </div>
      </div>

      {/* I've Paid - Check Status Button */}
      <div className="max-w-4xl mx-auto mt-6">
        <div className="neon-border rounded-2xl p-4 bg-black/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-white/70">
            Already paid? Click to verify your membership status.
          </div>
          <button
            onClick={() => {
              setPollMsg("Checking your membership...");
              router.replace("/signup?waiting=1");
              startPollingMembership();
            }}
            disabled={waiting}
            className="px-6 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition disabled:opacity-50 whitespace-nowrap"
          >
            I&apos;ve Paid - Check Status
          </button>
        </div>
      </div>

      {/* Payment info */}
      <div className="max-w-2xl mx-auto mt-8 text-center">
        <p className="text-white/50 text-sm">
          Pay with crypto via NOWPayments. We accept BTC, ETH, SOL, USDT, USDC, and 100+ cryptocurrencies.
        </p>
      </div>

      <p className="text-center mt-6 text-white/50 text-sm">
        Already Signed Up?{" "}
        <Link href="/login" className="text-sky-400 hover:underline">
          Login Here
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        <Suspense fallback={<div className="text-white/50 text-center py-10">Loading...</div>}>
          <SignupInner />
        </Suspense>
      </div>
    </main>
  );
}
