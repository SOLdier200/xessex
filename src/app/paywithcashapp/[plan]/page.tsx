"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import TopNav from "../../components/TopNav";
import GoogleSignupButton from "../../components/GoogleSignupButton";

const PLAN_INFO: Record<string, { label: string; price: string; tier: string }> = {
  member_monthly: { label: "Member Monthly", price: "$4", tier: "Member" },
  member_yearly: { label: "Member Yearly", price: "$40", tier: "Member" },
  diamond_monthly: { label: "Diamond Monthly", price: "$9", tier: "Diamond" },
  diamond_yearly: { label: "Diamond Yearly", price: "$70", tier: "Diamond" },
};

const CASHAPP_TAG = "$vape200100"; // Cash App: Jose Valdez

export default function CashAppPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const planCode = params.plan as string;
  const plan = PLAN_INFO[planCode];

  const [payerHandle, setPayerHandle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  // Signup modal state
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRefCode, setSignupRefCode] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Success state
  const [success, setSuccess] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [provisionalUntil, setProvisionalUntil] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setIsAuthed(data?.ok && data?.authed);
      setHasWallet(!!data?.user?.walletAddress);
    } catch {
      setIsAuthed(false);
      setHasWallet(false);
    } finally {
      setCheckingAuth(false);
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupBusy) return;

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

    setSignupBusy(true);
    setSignupError(null);

    try {
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
          setSignupError("Email already exists. Please log in first.");
        } else {
          setSignupError("Signup failed. Please try again.");
        }
        return;
      }

      toast.success("Account created!");
      setSignupOpen(false);
      setIsAuthed(true);
      window.dispatchEvent(new Event("auth-changed"));
    } catch {
      setSignupError("Signup failed. Please try again.");
    } finally {
      setSignupBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthed) {
      setSignupOpen(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/payments/manual/cashapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          payerHandle: payerHandle.trim(),
          note: note.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to submit. Please try again.");
        return;
      }

      setVerifyCode(data.verifyCode);
      setProvisionalUntil(data.provisionalUntil);
      setSuccess(true);
      toast.success("Payment request submitted!");
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!plan) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10 text-center py-20">
          <h1 className="text-2xl font-bold text-white">Invalid Plan</h1>
          <p className="text-white/60 mt-2">The plan you selected doesn&apos;t exist.</p>
          <Link href="/paywithcashapp" className="text-sky-400 hover:underline mt-4 inline-block">
            &larr; Back to plans
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10">
          <div className="max-w-lg mx-auto mt-10">
            <div className="neon-border rounded-2xl p-6 bg-black/30 border-green-400/50">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">&#10003;</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Payment Request Submitted!</h1>
                <p className="text-white/70 mt-2">Complete your payment and we&apos;ll verify it shortly.</p>
              </div>

              <div className="mt-6 p-4 bg-black/40 rounded-xl border border-green-400/30">
                <h3 className="text-sm font-semibold text-white mb-2">Your Verification Code</h3>
                <div className="text-2xl font-mono font-bold text-green-400 tracking-wider">
                  {verifyCode}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">Complete Your Payment</h3>
                <ol className="space-y-3 text-sm text-white/70">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">1</span>
                    <span>Open Cash App on your phone</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Send <strong className="text-white">{plan.price}</strong> to <strong className="text-green-400">{CASHAPP_TAG}</strong> (Jose Valdez)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">3</span>
                    <span>
                      <strong className="text-white">Important:</strong> Include your verification code{" "}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(verifyCode);
                          toast.success("Code copied to clipboard!");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 hover:bg-green-500/30 transition group relative"
                        title="Copy code to clipboard"
                      >
                        <strong className="text-green-400">{verifyCode}</strong>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                          Copy code to clipboard
                        </span>
                      </button>
                      {" "}in the payment note
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">4</span>
                    <span>We&apos;ll verify your payment and activate your account shortly</span>
                  </li>
                </ol>
              </div>


              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/videos"
                  className="w-full py-3 rounded-xl bg-green-500/20 border border-green-400/50 text-green-400 font-semibold hover:bg-green-500/30 transition text-center"
                >
                  Start Watching Videos
                </Link>
                <Link
                  href="/profile"
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 font-semibold hover:bg-white/10 transition text-center"
                >
                  Go to Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/paywithcashapp" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to plans
        </Link>

        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold neon-text">Pay with <span className="text-[#00D632]">Cash App</span></h1>
            <p className="mt-2 text-white/70">Complete your {plan.label} purchase</p>
          </div>

          {/* Plan Summary */}
          <div className="neon-border rounded-2xl p-5 bg-black/30 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{plan.label}</div>
                <div className="text-white/60 text-sm">{plan.tier} Membership</div>
              </div>
              <div className="text-2xl font-bold text-white">{plan.price}</div>
            </div>
          </div>

          {checkingAuth ? (
            <div className="text-center py-10 text-white/50">Checking account...</div>
          ) : plan.tier === "Diamond" && isAuthed && !hasWallet ? (
            <div className="neon-border rounded-2xl p-6 bg-black/30 border-blue-400/50">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Wallet Required for Diamond</h2>
                <p className="text-white/70 mb-6">
                  Diamond membership requires a connected wallet to receive XESS rewards and access exclusive features.
                </p>
                <Link
                  href="/login/diamond"
                  className="inline-block w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:from-blue-500 hover:to-cyan-400 transition text-center"
                >
                  Connect Wallet
                </Link>
                <p className="mt-4 text-xs text-white/50">
                  Already have a wallet connected?{" "}
                  <button onClick={checkAuth} className="text-blue-400 hover:underline">
                    Refresh status
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payer Handle */}
              <div>
                <label className="text-sm text-white/70 block mb-1">
                  Your Cash App Name / $Cashtag (optional)
                </label>
                <input
                  type="text"
                  value={payerHandle}
                  onChange={(e) => setPayerHandle(e.target.value)}
                  placeholder="e.g., $YourCashtag or John D."
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-green-400/70"
                />
                <p className="text-xs text-white/40 mt-1">Helps us match your payment faster</p>
              </div>

              {/* Note */}
              <div>
                <label className="text-sm text-white/70 block mb-1">
                  Additional Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any additional info..."
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none focus:border-green-400/70 resize-none"
                />
              </div>

              {/* Info Box */}
              <div className="p-4 bg-green-500/10 border border-green-400/30 rounded-xl text-sm text-green-200">
                <strong>What happens next:</strong>
                <ul className="mt-2 space-y-1 text-green-200/80">
                  <li>• You&apos;ll get a unique verification code</li>
                  <li>• Send {plan.price} to {CASHAPP_TAG} (Jose Valdez) with the code in the note</li>
                  <li>• Full verification will happen after a short time</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-green-500/20 border border-green-400/50 text-green-400 font-semibold hover:bg-green-500/30 transition disabled:opacity-50"
              >
                {loading ? "Submitting..." : isAuthed ? "Get Verification Code" : "Sign Up & Continue"}
              </button>

              {!isAuthed && (
                <p className="text-center text-xs text-white/50">
                  You&apos;ll need to create an account to continue
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Signup Modal */}
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
            <h2 className="text-lg font-semibold text-white mb-2">Create Your Account</h2>
            <p className="text-sm text-white/60 mb-5">
              Sign up to complete your Cash App purchase.
            </p>

            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  disabled={signupBusy}
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
                    disabled={signupBusy}
                    className="w-full bg-transparent text-white outline-none"
                    placeholder="Minimum 5 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    className="text-white/50 hover:text-white/80 transition"
                  >
                    {showSignupPassword ? "Hide" : "Show"}
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
                    disabled={signupBusy}
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
                {signupBusy ? "Creating account..." : "Create Account & Continue"}
              </button>
            </form>

            <div className="my-4 text-center text-xs text-white/40">or</div>

            <GoogleSignupButton
              label="Sign up with Google"
              redirectTo={`/auth/callback?next=${encodeURIComponent(`/paywithcashapp/${planCode}`)}`}
            />

            <p className="mt-4 text-xs text-white/50 text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-sky-400 hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
