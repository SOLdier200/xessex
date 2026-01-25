"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import TopNav from "../components/TopNav";
import GoogleSignupButton from "../components/GoogleSignupButton";
import ReferralCapture from "../components/ReferralCapture";
import DiamondMemberSignUpModal from "@/components/DiamondMemberSignUpModal";

// NOWPayments hosted invoice ids (must match IPN route IID_TO_PLAN)
const NOWPAYMENTS_IIDS = {
  M90: "1513416538", // Member 90 days $10
  MY:  "429715526",  // Member 1 year $40
  D1:  "1754587706", // Diamond 30 days $9
  D2:  "949588916",  // Diamond 60 days $17
  DY:  "1689634405", // Diamond 1 year $70
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

  const [memberCycle, setMemberCycle] = useState<"90days" | "yearly">("90days");
  const [diamondCycle, setDiamondCycle] = useState<"30days" | "60days" | "yearly">("30days");
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const diamondDisabled = false;

  // Payment method tabs
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "cashapp" | "creditcard">("crypto");
  // Cash App specific cycles
  const [cashAppMemberCycle, setCashAppMemberCycle] = useState<"monthly" | "yearly">("monthly");
  const [cashAppDiamondCycle, setCashAppDiamondCycle] = useState<"monthly" | "yearly">("monthly");
  // Credit Card specific cycles
  const [ccMemberCycle, setCcMemberCycle] = useState<"monthly" | "yearly">("monthly");
  const [ccDiamondCycle, setCcDiamondCycle] = useState<"monthly" | "yearly">("monthly");

  // Payment waiting state
  const [waiting, setWaiting] = useState(false);
  const [pollMsg, setPollMsg] = useState<string>("");

  const [signupSelectOpen, setSignupSelectOpen] = useState(false);
  const [walletDownloadOpen, setWalletDownloadOpen] = useState(false);
  const [diamondSignupOpen, setDiamondSignupOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupPlan, setSignupPlan] = useState<keyof typeof NOWPAYMENTS_IIDS | null>(null);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRefCode, setSignupRefCode] = useState("");
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

  const [isMember, setIsMember] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [membership, setMembership] = useState<"FREE" | "MEMBER" | "DIAMOND">("FREE");
  const [trialUsed, setTrialUsed] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  const memberPlan = memberCycle === "90days" ? "M90" : "MY";
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

  async function handleStartTrial() {
    setTrialLoading(true);
    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        if (data?.error === "UNAUTHENTICATED") {
          toast.error("Please sign up or log in first to start your free trial");
          setSignupSelectOpen(true);
        } else if (data?.error === "TRIAL_ALREADY_USED") {
          toast.error("You've already used your free trial");
          setTrialUsed(true);
        } else if (data?.error === "ALREADY_SUBSCRIBED") {
          toast.error("You already have an active membership");
        } else {
          toast.error("Could not start trial. Please try again.");
        }
        return;
      }
      toast.success("Your 14-day free trial has started!");
      setIsOnTrial(true);
      setTrialUsed(true);
      setTrialDaysLeft(14);
      setMembership("MEMBER");
      setCanStartTrial(false);
      window.dispatchEvent(new Event("auth-changed"));
      router.push("/videos");
    } catch {
      toast.error("Could not start trial. Please try again.");
    } finally {
      setTrialLoading(false);
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
        // Handle Diamond wallet requirement
        if (data?.error === "DIAMOND_REQUIRES_WALLET") {
          toast.error("Diamond membership requires a connected wallet");
          setWalletDownloadOpen(true);
          return false;
        }
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

        // Get referral code - prefer form input (prepend XESS-), fall back to localStorage
        const refCode = signupRefCode.trim()
          ? `XESS-${signupRefCode.trim()}`
          : (typeof window !== "undefined" ? localStorage.getItem("ref_code") : null) ||
            undefined;

        const res = await fetch("/api/auth/email/register-for-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, refCode }),
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
        setSignupRefCode("");
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
        setSignupRefCode("");
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
        const membershipVal = account?.membership ?? "FREE";
        const hasEmail = account?.hasEmail ?? false;

        // Set auth and membership state
        setIsAuthed(authed);
        setMembership(membershipVal as "FREE" | "MEMBER" | "DIAMOND");

        // Check if user is already a member
        if (membershipVal === "MEMBER" || membershipVal === "DIAMOND") {
          setIsMember(true);
        }

        // Check if user can start a trial
        if (account?.canStartTrial) {
          setCanStartTrial(true);
        }

        // Set trial state
        setTrialUsed(account?.trialUsed ?? false);
        setIsOnTrial(account?.isOnTrial ?? false);
        setTrialDaysLeft(account?.trialDaysLeft ?? null);

        // Only show signup modal if user is not authenticated
        // Wallet-only users who are authed should proceed directly to payment options
        if (!authed) {
          setSignupPlan(null);
          setSignupSelectOpen(true);
        }
      })
      .catch(() => {
        setSignupPlan(null);
        setSignupSelectOpen(true);
      });
  }, [searchParams, waiting]);

  // Autolaunch NOWPayments if /signup?plan=MM|MY|DM|DY
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (!planParam) return;

    const plan = planParam.toUpperCase() as keyof typeof NOWPAYMENTS_IIDS;
    if (!["M90", "MY", "D1", "D2", "DY"].includes(plan)) return;

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
      {/* Capture referral code from URL */}
      <ReferralCapture />

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

      <div className="text-center mb-8 -mt-5">
        <Image src="/logos/textlogo/siteset3/memberselect100.png" alt="Select Membership" width={938} height={276} className="h-[109px] w-auto mx-auto" />

        {/* Free Trial Banner */}
        {!isMember && (
          <div className="max-w-2xl mx-auto mt-6 mb-4">
            <div className="rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-r from-emerald-500/10 via-black/30 to-emerald-500/10 p-5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-bold text-emerald-400">Try Free for 14 Days</h3>
                  <p className="text-white/70 text-sm mt-1">
                    Full access to all videos. No credit card required.
                  </p>
                </div>
                <button
                  onClick={handleStartTrial}
                  disabled={trialLoading}
                  className="px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 font-semibold hover:bg-emerald-500/30 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {trialLoading ? "Starting..." : "Start Free Trial"}
                </button>
              </div>
              <p className="text-center text-white/50 text-xs mt-3">
                After your trial ends, choose a plan to continue. No automatic charges.
              </p>
            </div>
          </div>
        )}

        {/* Payment Method Tabs */}
        <div className="flex justify-center mt-6">
          <div className="bg-black/60 rounded-full p-1.5 flex gap-2 border border-white/20 shadow-lg shadow-black/50">
            <button
              onClick={() => setPaymentMethod("crypto")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                paymentMethod === "crypto"
                  ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/40"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Crypto
            </button>
            <button
              onClick={() => setPaymentMethod("cashapp")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                paymentMethod === "cashapp"
                  ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/40"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Cash App
            </button>
            <button
              onClick={() => setPaymentMethod("creditcard")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                paymentMethod === "creditcard"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/40"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Credit Card
            </button>
          </div>
        </div>
      </div>

      {/* CRYPTO TAB CONTENT */}
      {paymentMethod === "crypto" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Member Tier */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col relative overflow-hidden">
          {memberCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>
          )}

          <div className="text-center">
            <Image src="/logos/textlogo/siteset3/member100.png" alt="Member" width={974} height={286} priority fetchPriority="high" className="h-[58px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setMemberCycle("90days")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    memberCycle === "90days"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  90 Days
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
                {memberCycle === "90days" ? "$10" : "$40"}
              </span>
              <span className="text-white/60">/{memberCycle === "90days" ? "90 days" : "year"}</span>
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

          {/* Blockchain fee tip for 90 days */}
          {memberCycle === "90days" && (
            <div className="mt-4 p-3 bg-sky-500/10 border border-sky-400/30 rounded-lg text-xs text-sky-300/90">
              <strong>Tip:</strong> For faster confirmations, we recommend stablecoins (USDT/USDC) on low-fee networks like TRC20, BSC, or Polygon.
            </div>
          )}

          <button
            onClick={() => beginCheckout(memberPlan)}
            disabled={loading || waiting}
            className={`mt-6 w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-center block ${loading ? "opacity-50" : ""}`}
          >
            {loadingPlan === memberPlan ? "Redirecting to payment..." : isMember ? "Extend Membership" : "Become a Member"}
          </button>
        </div>

        {/* Diamond Member Tier */}
        <div
          id="diamond-card-crypto"
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
            <Image src="/logos/textlogo/siteset3/diamond100.png" alt="Diamond Member" width={1536} height={282} priority fetchPriority="high" className="h-[62px] w-auto mx-auto" />

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
                {diamondCycle === "30days" ? "$9" : diamondCycle === "60days" ? "$17" : "$70"}
              </span>
              <span className="text-white/60">
                /{diamondCycle === "30days" ? "30 days" : diamondCycle === "60days" ? "60 days" : "year"}
              </span>
            </div>
            {diamondCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $38/year</div>
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

          <button
            onClick={() => handleNowPayments(diamondPlan)}
            disabled={loading || waiting}
            className={`mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block disabled:opacity-50 disabled:cursor-not-allowed ${loading ? "opacity-50" : ""}`}
          >
            {loadingPlan === diamondPlan
              ? "Redirecting to payment..."
              : isMember
                ? "Upgrade to Diamond"
                : "Become a Diamond Member"}
          </button>
        </div>
      </div>
      )}

      {/* CASH APP TAB CONTENT */}
      {paymentMethod === "cashapp" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Member Tier - Cash App */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col relative overflow-hidden">
          {cashAppMemberCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>
          )}

          <div className="text-center">
            <Image src="/logos/textlogo/siteset3/member100.png" alt="Member" width={974} height={286} priority className="h-[58px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setCashAppMemberCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    cashAppMemberCycle === "monthly"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCashAppMemberCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    cashAppMemberCycle === "yearly"
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
                {cashAppMemberCycle === "monthly" ? "$4" : "$40"}
              </span>
              <span className="text-white/60">/{cashAppMemberCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {cashAppMemberCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $8/year</div>
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
          </ul>

          <Link
            href={`/paywithcashapp/${cashAppMemberCycle === "monthly" ? "member_monthly" : "member_yearly"}`}
            className="mt-6 w-full py-3 rounded-xl bg-green-500/20 border border-green-400/50 text-green-400 font-semibold hover:bg-green-500/30 transition text-center block"
          >
            {isMember ? "Extend Membership" : "Continue with Cash App"}
          </Link>
        </div>

        {/* Diamond Member Tier - Cash App */}
        <div
          id="diamond-card-cashapp"
          className="neon-border rounded-2xl p-6 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 flex flex-col relative overflow-hidden"
        >
          {/* Diamond image positioned to right middle */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
            <img
              src="/logos/diamond3.png"
              alt="Diamond"
              className="w-24 h-24"
            />
          </div>

          {cashAppDiamondCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded z-10">
              BEST VALUE
            </div>
          )}

          <div className="text-center relative z-10">
            <Image src="/logos/textlogo/siteset3/diamond100.png" alt="Diamond Member" width={1536} height={282} priority className="h-[62px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setCashAppDiamondCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    cashAppDiamondCycle === "monthly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCashAppDiamondCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    cashAppDiamondCycle === "yearly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  1 Year
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {cashAppDiamondCycle === "monthly" ? "$9" : "$70"}
              </span>
              <span className="text-white/60">/{cashAppDiamondCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {cashAppDiamondCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $38/year</div>
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
          </ul>

          <Link
            href={`/paywithcashapp/${cashAppDiamondCycle === "monthly" ? "diamond_monthly" : "diamond_yearly"}`}
            className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] text-center block"
          >
            {isMember ? "Upgrade to Diamond" : "Become a Diamond Member"}
          </Link>
        </div>
      </div>
      )}

      {/* CREDIT CARD TAB CONTENT */}
      {paymentMethod === "creditcard" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Member Tier - Credit Card */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col relative overflow-hidden opacity-70">
          {ccMemberCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-emerald-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>
          )}

          <div className="text-center">
            <Image src="/logos/textlogo/siteset3/member100.png" alt="Member" width={974} height={286} priority className="h-[58px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setCcMemberCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    ccMemberCycle === "monthly"
                      ? "bg-sky-500/30 text-sky-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCcMemberCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    ccMemberCycle === "yearly"
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
                {ccMemberCycle === "monthly" ? "$5" : "$50"}
              </span>
              <span className="text-white/60">/{ccMemberCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {ccMemberCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $10/year</div>
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
          </ul>

          {/* 14-day Free Trial (Member) */}
          {isAuthed && membership === "FREE" && !trialUsed && (
            <button
              onClick={handleStartTrial}
              disabled={trialLoading || waiting}
              className="mt-6 w-full py-3 rounded-xl bg-white text-black font-semibold hover:opacity-90 transition text-center block disabled:opacity-50"
            >
              {trialLoading ? "Starting..." : "Start 14-Day Free Trial"}
            </button>
          )}

          {isAuthed && membership === "FREE" && trialUsed && (
            <div className="mt-6 w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm text-center">
              Free trial already used on this account.
            </div>
          )}

          {isOnTrial && (
            <div className="mt-4 p-3 border border-white/10 bg-white/5 rounded-lg text-xs text-white/70">
              <strong className="text-white/90">Trial active:</strong>{" "}
              {trialDaysLeft ?? 14} days left.{" "}
              <span className="text-white/55">Go Diamond to keep everything unlocked.</span>
            </div>
          )}

          <button
            disabled
            className="mt-4 w-full py-3 rounded-xl bg-blue-500/10 border border-blue-400/30 text-blue-300/70 font-semibold cursor-not-allowed text-center block"
          >
            Credit Card — Coming soon
          </button>
        </div>

        {/* Diamond Member Tier - Credit Card */}
        <div
          id="diamond-card-cc"
          className="neon-border rounded-2xl p-6 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 flex flex-col relative overflow-hidden opacity-90"
        >
          {/* Diamond image positioned to right middle */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
            <img
              src="/logos/diamond3.png"
              alt="Diamond"
              className="w-24 h-24"
            />
          </div>

          {ccDiamondCycle === "yearly" && (
            <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded z-10">
              BEST VALUE
            </div>
          )}

          <div className="text-center relative z-10">
            <Image src="/logos/textlogo/siteset3/diamond100.png" alt="Diamond Member" width={1536} height={282} priority className="h-[62px] w-auto mx-auto" />

            {/* Billing Toggle */}
            <div className="flex justify-center mt-3">
              <div className="bg-black/40 rounded-full p-1 flex gap-1">
                <button
                  onClick={() => setCcDiamondCycle("monthly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    ccDiamondCycle === "monthly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCcDiamondCycle("yearly")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    ccDiamondCycle === "yearly"
                      ? "bg-yellow-500/30 text-yellow-300"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  1 Year
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl font-bold text-white">
                {ccDiamondCycle === "monthly" ? "$9" : "$70"}
              </span>
              <span className="text-white/60">/{ccDiamondCycle === "monthly" ? "month" : "year"}</span>
            </div>
            {ccDiamondCycle === "yearly" && (
              <div className="mt-1 text-emerald-400 text-sm">Save $38/year</div>
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

          {/* Diamond positioning copy */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-white">Diamond is where it opens up.</div>
              <div className="text-sm text-white/65 mt-1">
                Trial is a preview. Diamond is the full collection — uninterrupted.
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                <span className="text-yellow-300 font-semibold">Everything unlocked</span>
                <span className="text-white/55"> — the complete experience.</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                <span className="text-yellow-300 font-semibold">Earn to Watch</span>
                <span className="text-white/55"> — get rewarded for engagement.</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                <span className="text-yellow-300 font-semibold">Diamond Ladder</span>
                <span className="text-white/55"> — rise above the crowd.</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80">
                <span className="text-yellow-300 font-semibold">Premium priority</span>
                <span className="text-white/55"> — the tier that gets the best.</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-white/55">
              Don&apos;t just browse… <span className="text-white/80 font-semibold">indulge</span>.
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/5 p-4 text-xs text-yellow-100/80">
            <strong className="text-yellow-200">Credit Card:</strong>{" "}
            Coming soon. For now, Diamond is available via Crypto or Cash App.
          </div>

          <button
            disabled
            className="mt-6 w-full py-3 rounded-xl bg-yellow-500/10 border border-yellow-400/30 text-yellow-200/80 font-bold cursor-not-allowed text-center block"
          >
            Credit Card Diamond — Coming soon
          </button>
        </div>

        {/* Credit Card Coming Soon Notice */}
        <div className="md:col-span-2 neon-border rounded-2xl p-5 bg-blue-500/5 border-blue-400/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-300">Credit Card Payments Coming Soon</h3>
              <p className="text-xs text-white/60 mt-1">
                We&apos;re working on adding credit card support. In the meantime, you can pay with <button onClick={() => setPaymentMethod("crypto")} className="text-purple-400 hover:underline">Crypto</button> or <button onClick={() => setPaymentMethod("cashapp")} className="text-green-400 hover:underline">Cash App</button>.
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* I've Paid - Check Status Button - Crypto only */}
      {paymentMethod === "crypto" && (
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
      )}

      {/* Billing & Payment Info - Crypto */}
      {paymentMethod === "crypto" && (
      <div className="max-w-2xl mx-auto mt-8 neon-border rounded-2xl p-5 bg-black/30">
        <h3 className="text-sm font-semibold text-white mb-3">Billing Information</h3>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span><strong className="text-white/80">One-time payment</strong> — no recurring charges or auto-renewal.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span><strong className="text-white/80">Crypto payments</strong> — we accept BTC, ETH, SOL, USDT, USDC, and 100+ cryptocurrencies via NOWPayments.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span><strong className="text-white/80">Charges appear as:</strong> NOWPayments or crypto network transaction.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">•</span>
            <span><strong className="text-white/80">Need help?</strong> Contact us anytime at <a href="mailto:support@xessex.me" className="text-sky-400 hover:underline">support@xessex.me</a></span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-white/40">
          All crypto payments are handled securely through NOWPayments.
        </p>
      </div>
      )}

      {/* Billing & Payment Info - Cash App */}
      {paymentMethod === "cashapp" && (
      <div className="max-w-2xl mx-auto mt-8 neon-border rounded-2xl p-5 bg-black/30">
        <h3 className="text-sm font-semibold text-white mb-3">How Cash App Payment Works</h3>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">1.</span>
            <span>Select your plan and click continue</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">2.</span>
            <span>You&apos;ll receive a unique verification code</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">3.</span>
            <span>Send payment to <strong className="text-green-400">$vape200100</strong> (Jose Valdez) with the code in the note</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">4.</span>
            <span>Full verification will happen after a short time</span>
          </li>
        </ul>
      </div>
      )}

      <p className="text-center mt-6 text-white/50 text-sm">
        Already Signed Up?{" "}
        <Link href="/login" className="text-sky-400 hover:underline">
          Login Here
        </Link>
        <span className="ml-2 text-white/50">
          Create Account{" "}
          <button
            type="button"
            onClick={() => {
              setSignupPlan(null);
              setSignupError(null);
              setSignupSelectOpen(true);
            }}
            className="text-sky-400 hover:underline"
          >
            here
          </button>{" "}
          first before purchasing membership.
        </span>
      </p>

      {signupOpen && (
        <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
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

              <div>
                <label className="text-xs text-white/60">Referral code (optional)</label>
                <div className="mt-1 flex items-stretch rounded-xl border border-white/10 bg-black/50 overflow-hidden focus-within:border-purple-400/70">
                  <span className="px-3 py-2 text-white/40 font-mono text-sm border-r border-white/10 bg-black/30 flex items-center">
                    XESS-
                  </span>
                  <input
                    type="text"
                    value={signupRefCode}
                    onChange={(e) => {
                      const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setSignupRefCode(raw);
                    }}
                    disabled={signupBusy || signupRegistered}
                    className="flex-1 bg-transparent px-3 py-2 text-white placeholder:text-white/30 focus:outline-none font-mono"
                    placeholder="ABC123"
                  />
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
        <div className="fixed inset-0 z-[75] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
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

      {/* Account Signup Select Modal */}
      {signupSelectOpen && (
        <div className="fixed inset-0 z-[65] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSignupSelectOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl neon-border bg-black/90 p-6">
            <button
              type="button"
              onClick={() => setSignupSelectOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 className="text-xl font-semibold text-white mb-2 text-center">Create Your Account</h2>
            <p className="text-sm text-white/60 mb-6 text-center">
              Choose how you want to sign up
            </p>

            <div className="space-y-4">
              {/* Email Signup Option */}
              <button
                onClick={() => {
                  setSignupSelectOpen(false);
                  setSignupOpen(true);
                }}
                className="w-full p-4 rounded-xl border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20 transition text-left group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/logos/textlogo/siteset3/member100.png"
                      alt="Member"
                      width={974}
                      height={286}
                      className="h-[32px] w-auto"
                    />
                    <span className="text-white font-semibold text-lg">sign up with Email</span>
                  </div>
                  <p className="text-white/60 text-sm">
                    Great choice for users who just want a basic membership to view all content, comments, and more.
                  </p>
                </div>
              </button>

              {/* Wallet Signup Option */}
              <button
                onClick={() => {
                  setSignupSelectOpen(false);
                  setDiamondSignupOpen(true);
                }}
                className="w-full p-4 rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-500/10 to-purple-500/10 hover:from-yellow-500/20 hover:to-purple-500/20 transition text-left group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Image
                      src="/logos/textlogo/siteset3/diamond100.png"
                      alt="Diamond Member"
                      width={1536}
                      height={282}
                      className="h-[34px] w-auto"
                    />
                    <span className="text-yellow-300 font-semibold text-lg">create your account with Wallet</span>
                  </div>
                  <p className="text-white/60 text-sm">
                    Interact with crypto on the site and earn Xess Coin for viewing and rating videos.
                  </p>
                  <p className="text-yellow-400/70 text-xs">
                    Wallet sign-in creates your account automatically.
                  </p>
                </div>
              </button>
            </div>

            {/* Wallet Download Info */}
            <div className="mt-5 p-3 rounded-xl bg-purple-500/10 border border-purple-400/30">
              <p className="text-sm text-white/70">
                You&apos;ll need a Phantom, Backpack, or Solflare wallet to connect your Diamond Membership.{" "}
                <button
                  type="button"
                  onClick={() => setWalletDownloadOpen(true)}
                  className="text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  Download a wallet here
                </button>
              </p>
            </div>

            {/* Privacy Note */}
            <div className="mt-4 text-center">
              <p className="text-xs text-white/50">
                Diamond members only need a wallet — email is optional. If privacy is a concern, Diamond wallet-only is a good option.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diamond Member Signup Modal */}
      <DiamondMemberSignUpModal
        open={diamondSignupOpen}
        onClose={() => setDiamondSignupOpen(false)}
        onCreated={() => {
          setDiamondSignupOpen(false);
          // Refresh auth state and show payment options
          window.dispatchEvent(new Event("auth-changed"));
          toast.success("Diamond account created! Choose your payment method below.");
          // Scroll to Diamond payment options
          setTimeout(() => {
            const diamondCard = document.getElementById("diamond-card-crypto");
            if (diamondCard) {
              diamondCard.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 300);
        }}
      />

      {/* Wallet Download Modal */}
      {walletDownloadOpen && (
        <div className="fixed inset-0 z-[85] flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="absolute inset-0 bg-black/80" onClick={() => setWalletDownloadOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-6">
            <button
              type="button"
              onClick={() => setWalletDownloadOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 className="text-xl font-semibold text-white mb-2 text-center">Wallet Required for Diamond</h2>
            <p className="text-sm text-white/60 mb-4 text-center">
              Diamond membership requires a connected wallet to receive XESS rewards and access exclusive features.
            </p>

            {/* Connect Wallet Button */}
            <Link
              href="/login/diamond"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:from-blue-500 hover:to-cyan-400 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Connect Wallet
            </Link>

            <div className="text-center text-xs text-white/40 mb-4">
              Don&apos;t have a wallet? Download one below:
            </div>

            <div className="space-y-3">
              {/* Phantom */}
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20 transition"
              >
                <Image
                  src="https://phantom.app/img/phantom-icon-purple.svg"
                  alt="Phantom"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl flex-shrink-0"
                  unoptimized
                />
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Phantom</h3>
                  <p className="text-white/60 text-xs">Most popular Solana wallet</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* Backpack */}
              <a
                href="https://backpack.app/downloads"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 transition"
              >
                <Image
                  src="https://backpack.app/backpack.svg"
                  alt="Backpack"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl flex-shrink-0"
                  unoptimized
                />
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Backpack</h3>
                  <p className="text-white/60 text-xs">Multi-chain wallet with xNFT support</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* Solflare */}
              <a
                href="https://solflare.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-orange-400/30 bg-orange-500/10 hover:bg-orange-500/20 transition"
              >
                <Image
                  src="https://solflare.com/favicon.svg"
                  alt="Solflare"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl flex-shrink-0"
                  unoptimized
                />
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Solflare</h3>
                  <p className="text-white/60 text-xs">Feature-rich Solana wallet</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-sky-500/10 border border-sky-400/30">
              <p className="text-xs text-sky-200">
                <strong>Tip:</strong> After installing, create a new wallet and securely save your recovery phrase. You&apos;ll use this wallet to sign in and receive Xess rewards.
              </p>
            </div>

            <button
              onClick={() => setWalletDownloadOpen(false)}
              className="mt-4 w-full py-2 text-white/60 hover:text-white text-sm transition"
            >
              Close
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
