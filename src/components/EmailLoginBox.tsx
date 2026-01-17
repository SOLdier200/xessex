"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Membership = "FREE" | "MEMBER" | "DIAMOND";

function prettyMembership(m: Membership) {
  if (m === "DIAMOND") return "Diamond Member";
  if (m === "MEMBER") return "Member";
  return "Free";
}

export default function EmailLoginBox() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "error" | "success">("info");

  const [showModal, setShowModal] = useState(false);
  const [membership, setMembership] = useState<Membership>("FREE");
  const [needsWalletLink, setNeedsWalletLink] = useState(false);

  const [banner, setBanner] = useState<{ show: boolean; membership: Membership }>({
    show: false,
    membership: "FREE",
  });

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchMeAndSetBanner() {
    const res = await fetch("/api/auth/me", { method: "GET", cache: "no-store" });
    const j = await res.json().catch(() => null);

    const u = j?.ok ? j.user : null;
    if (!u) return;

    const m: Membership =
      u.role === "DIAMOND" ? "DIAMOND" : u.role === "MEMBER" ? "MEMBER" : "FREE";

    setMembership(m);
    setBanner({ show: true, membership: m });

    // Check if Diamond email user needs to link wallet
    const linked = !!(u.solWallet || u.walletAddress);
    setNeedsWalletLink(m === "DIAMOND" && !linked);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setToastType("info");
    setToast("Logging in...");
    setShowModal(false);

    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j.ok) {
        setToastType("error");
        if (j.error === "INVALID_PASSWORD") {
          setToast("Incorrect password, please try again.");
        } else if (j.error === "USER_NOT_FOUND") {
          setToast("No account found with this email.");
        } else if (j.error === "RATE_LIMITED") {
          setToast(`Too many attempts. Try again in ${j.retryAfter || 60} seconds.`);
        } else if (j.error === "INVALID_INPUT") {
          setToast("Please enter a valid email and password.");
        } else {
          setToast("Login failed. Please try again.");
        }
        return;
      }

      const m: Membership = j.membership || "FREE";
      setMembership(m);

      setToastType("success");
      setToast(`Logging in as ${prettyMembership(m)}...`);

      // Confirm session/cookie worked and show the banner
      await fetchMeAndSetBanner();

      // Notify other components (like WalletStatus) that auth changed
      window.dispatchEvent(new Event("auth-changed"));

      // Show success modal
      setShowModal(true);
    } catch {
      setToastType("error");
      setToast("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      {/* Diamond wallet link banner (highest priority) OR logged-in banner */}
      {needsWalletLink ? (
        <div className="mb-4 rounded-2xl border border-pink-500/40 bg-black/60 px-4 py-4">
          <div className="text-sm font-semibold text-pink-200">
            Link your wallet to receive Xess payments
          </div>
          <div className="mt-1 text-xs text-white/75">
            As a Diamond Member, you must link a Solana wallet to receive payments and enable on-chain Xess features.
          </div>
          <button
            onClick={() => router.push("/link-wallet")}
            className="mt-3 w-full rounded-xl bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-500 transition"
          >
            Go to Wallet Linking
          </button>
        </div>
      ) : banner.show ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="text-sm">
            You&apos;re now logged in —{" "}
            <span className="font-semibold">{prettyMembership(banner.membership)}</span>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute -top-3 right-0 z-50">
          <div
            className={[
              "rounded-xl border px-4 py-2 text-sm shadow-lg",
              "bg-black/80 backdrop-blur",
              toastType === "error" ? "border-red-500/40 text-red-200" : "",
              toastType === "success" ? "border-green-500/40 text-green-200" : "",
              toastType === "info" ? "border-white/10 text-white/90" : "",
            ].join(" ")}
          >
            {toast}
          </div>
        </div>
      )}

      {/* Login form */}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 pr-10 outline-none"
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        </div>

        <button
          disabled={busy}
          className="w-full rounded-xl bg-white/10 px-3 py-2 font-semibold hover:bg-white/15 disabled:opacity-50"
        >
          {busy ? "Logging in..." : "Login with Email"}
        </button>

        <div className="text-sm text-center">
          <a href="/forgot-password" className="underline opacity-80 hover:opacity-100">
            Forgot password?
          </a>
        </div>
      </form>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/80 p-6 shadow-2xl backdrop-blur">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm hover:bg-white/10"
              aria-label="Close"
            >
              X
            </button>

            <div className="text-xl font-semibold neon-text">Successfully logged in!</div>
            <div className="mt-2 text-sm text-white/80">
              You're signed in as <span className="font-semibold">{prettyMembership(membership)}</span>.
            </div>

            {/* Diamond wallet link prompt - routes to /link-wallet */}
            {membership === "DIAMOND" && needsWalletLink && (
              <div className="mt-4 rounded-xl border border-pink-500/30 bg-black/40 p-4">
                <div className="text-sm font-semibold text-pink-200">
                  Link your wallet to receive Xess payments
                </div>
                <div className="mt-1 text-xs text-white/75">
                  As a Diamond Member, you need to link a SOL wallet to receive your payments.
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    router.push("/link-wallet");
                  }}
                  className="mt-3 w-full rounded-xl bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-500"
                >
                  Link Wallet Now
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowModal(false);
                window.location.href = "/";
              }}
              className="mt-6 w-full rounded-xl bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
            >
              Watch Great Content Now!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
