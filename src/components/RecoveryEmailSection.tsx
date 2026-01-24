"use client";

import { useState } from "react";

type Props = {
  currentEmail: string | null;
  isVerified: boolean;
  onUpdated?: () => void;
};

export default function RecoveryEmailSection({
  currentEmail,
  isVerified,
  onUpdated,
}: Props) {
  const [email, setEmail] = useState(currentEmail || "");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(!currentEmail);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setStatus("working");
      setError("");

      const res = await fetch("/api/diamond/recovery-email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).then((r) => r.json());

      if (!res?.ok) {
        throw new Error(res?.error || "Failed to set recovery email.");
      }

      setStatus("success");
      setIsEditing(false);
      onUpdated?.();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Recovery Email</h3>
        {currentEmail && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-pink-400 hover:text-pink-300"
          >
            Change
          </button>
        )}
      </div>

      <p className="text-xs text-white/60 mb-4">
        If you ever lose access to your wallet, you can use this email to
        restore your Diamond membership to a new wallet.
      </p>

      {status === "success" ? (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <svg
              className="h-4 w-4"
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
            <span>Verification email sent!</span>
          </div>
          <p className="text-xs text-white/70 mt-1">
            Check your inbox and click the link to verify your recovery email.
          </p>
        </div>
      ) : isEditing ? (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-white placeholder-white/30 outline-none focus:border-[#ff4fd8] text-sm"
            required
          />

          {error && (
            <div className="mt-2 text-xs text-red-400">{error}</div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={status === "working"}
              className="flex-1 rounded-xl bg-[#ff4fd8] px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "working"
                ? "Sending..."
                : currentEmail
                  ? "Update & Verify"
                  : "Set & Verify"}
            </button>
            {currentEmail && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEmail(currentEmail);
                  setStatus("idle");
                  setError("");
                }}
                className="rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-center justify-between rounded-xl bg-black/30 p-3">
            <span className="text-white text-sm">{currentEmail}</span>
            {isVerified ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <svg
                  className="h-3 w-3"
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
                Verified
              </span>
            ) : (
              <span className="text-xs text-yellow-400">Pending verification</span>
            )}
          </div>
          {!isVerified && (
            <button
              onClick={handleSubmit}
              disabled={status === "working"}
              className="mt-2 w-full rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
            >
              {status === "working" ? "Sending..." : "Resend Verification Email"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
