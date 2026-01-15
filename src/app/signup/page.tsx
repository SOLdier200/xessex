"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import TopNav from "../components/TopNav";
import GoogleSignupButton from "../components/GoogleSignupButton";

// NOWPayments hosted invoice ids (must match IPN route IID_TO_PLAN)
const NOWPAYMENTS_IIDS = {
  M60: "1094581819", // Member 60 days $10
  MY:  "429715526",  // Member 1 year $40
  D1:  "1754587706", // Diamond 30 days $18
  D2:  "552457287",  // Diamond 60 days $30
  DY:  "1689634405", // Diamond 1 year $100
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

  const [memberCycle, setMemberCycle] = useState<"60days" | "yearly">("60days");
  const [diamondCycle, setDiamondCycle] = useState<"30days" | "60days" | "yearly">("30days");
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const diamondDisabled = true;

  // Payment waiting state
  const [waiting, setWaiting] = useState(false);
  const [pollMsg, setPollMsg] = useState<string>("");

  const [signupOpen, setSignupOpen] = useState(false);
  const [signupPlan, setSignupPlan] = useState<keyof typeof NOWPAYMENTS_IIDS | null>(null);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupRegistered, setSignupRegistered] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const memberPlan = memberCycle === "60days" ? "M60" : "MY";
  const diamondPlan = diamondCycle === "30days" ? "D1" : diamondCycle === "60days" ? "D2" : "DY";

  const autoPromptedRef = useRef(false);
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

  async function fetchAccountStatus() {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await r.json();
      return data;
    } catch {
      return null;
    }
  }

  async function checkMembershipOnce() {
    const auth = await fetchAuthStatus();
    if (!auth?.ok) {
      setPollMsg("Checking your membership...");
      return false;
    }

    if (auth.isMember === true) {
      stopPolling();
      setPollMsg("Membership active! Redirecting...");
      setTimeout(() => router.push("/videos"), 800);
      return true;
    }

    setPollMsg("Still waiting for confirmation...");
    return false;
  }

  function startPollingMembership() {
    stopPolling();
    pollStartRef.current = Date.now();
    setWaiting(true);
    setPollMsg("Checking your membership...");
    toast("Checking status...");
    void checkMembershipOnce();

    pollTimerRef.current = window.setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_MAX_MS) {
        stopPolling();
        setPollMsg(
          "Still waiting... If you already paid, it may take a moment. Keep this tab open and it will update."
        );
        return;
      }

      await checkMembershipOnce();
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

      if (!res.ok || !data?.ok || !data?.redirectUrl) {
        toast.error("Payment start failed. Please try again.");
        return false;
      }

      window.location.href = data.redirectUrl as string;
      return true;
    } catch {
      toast.error("Payment start failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
      setLoadingPlan(null);
    }
  }

  function openLoginModal() {
    if (signupBusy) return;
    setLoginError(null);
    setLoginOpen(true);
    setSignupOpen(false);
  }

  function closeLoginModal() {
    if (loginBusy) return;
    setLoginOpen(false);
    setLoginError(null);
    setSignupOpen(true);
  }

  async function beginCheckout(plan: keyof typeof NOWPAYMENTS_IIDS) {
    const account = await fetchAccountStatus();
    const authed = account?.ok && account.authed;
    const membership = account?.membership ?? "FREE";
    const hasEmail = account?.hasEmail ?? false;

    if (authed && (membership !== "FREE" || hasEmail)) {
      await handleNowPayments(plan);
      return;
    }

    setSignupPlan(plan);
    setSignupError(null);
    setSignupOpen(true);
  }

  async function ensureAuthReady() {
    for (let i = 0; i < 4; i += 1) {
      const account = await fetchAccountStatus();
      if (account?.ok && account.authed) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupBusy) return;
    const plan = signupPlan;

    setSignupBusy(true);
    setSignupError(null);

    try {
      if (!signupRegistered) {
        const email = signupEmail.trim();
        const password = signupPassword;

        if (!email) {
          setSignupError("Please enter your email.");
          return;
        }
        if (!password || password.length < 5) {
          setSignupError("Please create a password (min 5 characters).");
          return;
        }

        const res = await fetch("/api/auth/email/register-for-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          if (data?.error === "EMAIL_EXISTS") {
            setSignupError("Email already exists. Please log in to continue.");
          } else if (data?.error === "INVALID_INPUT") {
            setSignupError("Please enter a valid email and password.");
          } else {
            setSignupError("Signup failed. Please try again.");
          }
          return;
        }

        setSignupRegistered(true);
      }

      const authed = await ensureAuthReady();
      if (!authed) {
        setSignupError("Account created, but login is not ready yet. Please refresh and try again.");
        return;
      }

      if (!plan) {
        toast.success("Account created. Choose a plan to continue.");
        setSignupOpen(false);
        setSignupEmail("");
        setSignupPassword("");
        setShowSignupPassword(false);
        setSignupRegistered(false);
        // Notify WalletStatus and other components that auth changed
        window.dispatchEvent(new Event("auth-changed"));
        return;
      }

      const started = await handleNowPayments(plan);
      if (started) {
        setSignupOpen(false);
        setSignupEmail("");
        setSignupPassword("");
        setShowSignupPassword(false);
        setSignupRegistered(false);
      }
    } catch {
      setSignupError("Signup failed. Please try again.");
    } finally {
      setSignupBusy(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginBusy) return;

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email) {
      setLoginError("Please enter your email.");
      return;
    }
    if (!password || password.length < 5) {
      setLoginError("Please enter your password.");
      return;
    }

    setLoginBusy(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (data?.error === "INVALID_PASSWORD") {
          setLoginError("Incorrect password, please try again.");
        } else if (data?.error === "USER_NOT_FOUND") {
          setLoginError("No account found with this email.");
        } else if (data?.error === "RATE_LIMITED") {
          setLoginError(`Too many attempts. Try again in ${data.retryAfter || 60} seconds.`);
        } else if (data?.error === "INVALID_INPUT") {
          setLoginError("Please enter a valid email and password.");
        } else {
          setLoginError("Login failed. Please try again.");
        }
        return;
      }

      toast.success("Logged in. Choose a plan to continue.");
      setLoginOpen(false);
      setSignupOpen(false);
      setLoginEmail("");
      setLoginPassword("");
      setShowLoginPassword(false);
      // Notify WalletStatus and other components that auth changed
      window.dispatchEvent(new Event("auth-changed"));
    } catch {
      setLoginError("Login failed. Please try again.");
    } finally {
      setLoginBusy(false);
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

  useEffect(() => {
    if (autoPromptedRef.current) return;
    if (searchParams.get("waiting") === "1") return;
    if (waiting) return;

    autoPromptedRef.current = true;

    fetchAccountStatus()
      .then((account) => {
        const authed = account?.ok && account.authed;
        const membership = account?.membership ?? "FREE";
        const hasEmail = account?.hasEmail ?? false;

        if (!authed || (membership === "FREE" && !hasEmail)) {
          setSignupPlan(null);
          setSignupOpen(true);
        }
      })
      .catch(() => {
        setSignupPlan(null);
        setSignupOpen(true);
      });
  }, [searchParams, waiting]);

  // Autolaunch NOWPayments if /signup?plan=MM|MY|DM|DY
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (!planParam) return;

    const plan = planParam.toUpperCase() as keyof typeof NOWPAYMENTS_IIDS;
    if (!["M60", "MY", "D1", "D2", "DY"].includes(plan)) return;

    const key = `np_autolaunch_${plan}`;
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    }

    beginCheckout(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

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
                  onClick={() => setMemberCycle("60days")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    memberCycle === "60days"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  60 Days
                </button>
                <button
                  onClick={() => setMemberCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    memberCycle === "yearly"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  1 Year
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {memberCycle === "60days" ? "$10" : "$40"}
              </span>
              <span className="text-white/60">/{memberCycle === "60days" ? "60 days" : "year"}</span>
            </div>
            {memberCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $20/year</div>
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

          {/* Blockchain fee tip for 60 days */}
          {memberCycle === "60days" && (
            <div className="mt-4 p-3 bg-sky-500/10 border border-sky-400/30 rounded-lg text-xs text-sky-300/90">
              <strong>Tip:</strong> For faster confirmations, we recommend stablecoins (USDT/USDC) on low-fee networks like TRC20, BSC, or Polygon.
            </div>
          )}

          <button
            onClick={() => beginCheckout(memberPlan)}
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
                  onClick={() => setDiamondCycle("30days")}
                  disabled={diamondDisabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    diamondCycle === "30days"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setDiamondCycle("60days")}
                  disabled={diamondDisabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    diamondCycle === "60days"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  60 Days
                </button>
                <button
                  onClick={() => setDiamondCycle("yearly")}
                  disabled={diamondDisabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    diamondCycle === "yearly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  1 Year
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {diamondCycle === "30days" ? "$18" : diamondCycle === "60days" ? "$30" : "$100"}
              </span>
              <span className="text-white/60">
                /{diamondCycle === "30days" ? "30 days" : diamondCycle === "60days" ? "60 days" : "year"}
              </span>
            </div>
            {diamondCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $116/year</div>
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
        <span className="ml-2 text-white/50">
          Create Account with Email{" "}
          <button
            type="button"
            onClick={() => {
              setSignupPlan(null);
              setSignupError(null);
              setSignupOpen(true);
            }}
            className="text-sky-400 hover:underline"
          >
            here
          </button>{" "}
          first before purchasing membership.
        </span>
      </p>

      {signupOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => !signupBusy && setSignupOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-6">
            <button
              type="button"
              onClick={() => setSignupOpen(false)}
              disabled={signupBusy}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition disabled:opacity-50"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white mb-2">Sign up with your Email</h2>
            <p className="text-sm text-white/60 mb-5">
              Enter your email to create your membership account.
            </p>

            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  disabled={signupBusy || signupRegistered}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-white outline-none focus:border-pink-400/70"
                  placeholder="you@email.com"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Create password</label>
                <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-black/50 px-3 py-2 focus-within:border-pink-400/70">
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={signupBusy || signupRegistered}
                    className="w-full bg-transparent text-white outline-none"
                    placeholder="Minimum 5 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    className="text-white/50 hover:text-white/80 transition"
                    aria-label={showSignupPassword ? "Hide password" : "Show password"}
                  >
                    {showSignupPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {signupError && <div className="text-xs text-red-300">{signupError}</div>}

              <button
                type="submit"
                disabled={signupBusy}
                className="w-full rounded-xl bg-pink-500/20 border border-pink-400/40 py-3 text-pink-100 font-semibold hover:bg-pink-500/30 transition disabled:opacity-50"
              >
                {signupBusy
                  ? signupRegistered
                    ? "Redirecting to payment..."
                    : "Creating account..."
                  : signupPlan
                    ? "Continue to Payment"
                    : "Create Account"}
              </button>
            </form>

            <div className="my-4 text-center text-xs text-white/40">or</div>

            <GoogleSignupButton
              label="Sign up with Google"
              redirectTo={`/auth/callback?next=${encodeURIComponent(
                signupPlan ? `/signup?plan=${signupPlan}` : "/signup"
              )}`}
            />

            <button
              type="button"
              onClick={openLoginModal}
              className="mt-4 text-xs text-white/60 hover:text-white"
            >
              Already have an account? Login here.
            </button>
          </div>
        </div>
      )}

      {loginOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => !loginBusy && setLoginOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-6">
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              disabled={loginBusy}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition disabled:opacity-50"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white mb-2">Login with your Email</h2>
            <p className="text-sm text-white/60 mb-5">
              Enter the email you used to create your account.
            </p>

            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loginBusy}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-white outline-none focus:border-pink-400/70"
                  placeholder="you@email.com"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Password</label>
                <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-black/50 px-3 py-2 focus-within:border-pink-400/70">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginBusy}
                    className="w-full bg-transparent text-white outline-none"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="text-white/50 hover:text-white/80 transition"
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {loginError && <div className="text-xs text-red-300">{loginError}</div>}

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full rounded-xl bg-pink-500/20 border border-pink-400/40 py-3 text-pink-100 font-semibold hover:bg-pink-500/30 transition disabled:opacity-50"
              >
                {loginBusy ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="my-4 text-center text-xs text-white/40">or</div>

            <GoogleSignupButton
              label="Login with Google"
              redirectTo={`/auth/callback?next=${encodeURIComponent(
                signupPlan ? `/signup?plan=${signupPlan}` : "/signup"
              )}`}
            />

            <button
              type="button"
              onClick={closeLoginModal}
              disabled={loginBusy}
              className="mt-4 text-xs text-white/60 hover:text-white disabled:opacity-50"
            >
              Back to create account
            </button>
          </div>
        </div>
      )}
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
