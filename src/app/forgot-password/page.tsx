"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "../components/TopNav";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "error" | "success">("info");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setToastType("info");
    setToast("Sending reset link...");

    try {
      const res = await fetch("/api/auth/email/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j.ok) {
        setToastType("error");
        setToast(j.error || "Failed to send reset link");
        return;
      }

      // Always show generic success
      setToastType("success");
      setToast("If that email exists, a reset link was sent.");
      setEmail("");
    } catch {
      setToastType("error");
      setToast("Failed to send reset link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-md">
          <div className="relative neon-border rounded-2xl bg-black/30 p-6">
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

            <h1 className="text-xl font-semibold neon-text">Forgot Password</h1>
            <p className="mt-2 text-sm text-white/75">
              Enter your email and we'll send you a password reset link.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <button
                disabled={busy}
                className="w-full rounded-xl bg-white/10 px-3 py-2 font-semibold hover:bg-white/15 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-4 text-sm">
              <Link href="/login" className="underline opacity-80 hover:opacity-100">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
