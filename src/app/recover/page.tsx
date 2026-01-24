"use client";

import { useState } from "react";
import Link from "next/link";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setStatus("working");
      setError("");

      const res = await fetch("/api/diamond/recover/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).then((r) => r.json());

      // Always show success (to prevent email enumeration)
      setStatus("success");
    } catch (e) {
      // Still show success to prevent enumeration
      setStatus("success");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Recover Diamond Membership</h1>
        <p className="mt-2 text-white/70">
          Lost access to your wallet? Enter the recovery email you registered
          with your Diamond account.
        </p>

        {status === "success" ? (
          <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-5">
            <div className="flex items-center gap-2 text-green-400">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-semibold">Check your email</span>
            </div>
            <p className="mt-2 text-white/70">
              If a Diamond account exists with this recovery email, you&apos;ll
              receive a link to restore your membership to a new wallet.
            </p>
            <p className="mt-2 text-sm text-white/50">
              The link expires in 30 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <label className="block">
                <span className="text-sm text-white/70">Recovery Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#ff4fd8]"
                  required
                />
              </label>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "working"}
                className="mt-4 w-full rounded-xl bg-[#ff4fd8] px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "working" ? "Sending..." : "Send Recovery Link"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login/diamond"
            className="text-sm text-white/50 hover:text-white/70"
          >
            Back to Diamond Login
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold text-white/90">How recovery works</h3>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-white/70">
            <li>Enter the recovery email you registered with your Diamond account</li>
            <li>Check your inbox for a recovery link (expires in 30 minutes)</li>
            <li>Click the link and connect your new wallet</li>
            <li>Sign a message to prove you control the new wallet</li>
            <li>Your Diamond membership moves to the new wallet</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
