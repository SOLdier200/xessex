"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopNav from "../components/TopNav";

function ResetPasswordForm() {
  const sp = useSearchParams();

  const email = useMemo(() => sp.get("email") || "", [sp]);
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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

    if (!email || !token) {
      setToastType("error");
      setToast("Missing reset token. Please request a new reset link.");
      return;
    }

    if (newPassword.length < 5) {
      setToastType("error");
      setToast("Password must be at least 5 characters.");
      return;
    }

    if (newPassword !== confirm) {
      setToastType("error");
      setToast("Passwords do not match.");
      return;
    }

    setBusy(true);
    setToastType("info");
    setToast("Resetting password...");

    try {
      const res = await fetch("/api/auth/email/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j.ok) {
        setToastType("error");
        setToast(j.error || "Reset failed");
        return;
      }

      setToastType("success");
      setToast("Password updated!");
      setDone(true);
      setNewPassword("");
      setConfirm("");
    } catch {
      setToastType("error");
      setToast("Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
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

      <h1 className="text-xl font-semibold neon-text">Reset Password</h1>
      <p className="mt-2 text-sm text-white/75">
        {email ? (
          <>
            Resetting password for <span className="font-semibold">{email}</span>
          </>
        ) : (
          "Open the reset link from your email."
        )}
      </p>

      {!done ? (
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            placeholder="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <input
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            placeholder="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <button
            disabled={busy}
            className="w-full rounded-xl bg-pink-600 px-3 py-2 font-semibold text-white hover:bg-pink-500 disabled:opacity-50"
          >
            {busy ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="text-sm text-white/90">Your password has been updated.</div>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-xl bg-white/10 px-4 py-2 font-semibold hover:bg-white/15"
          >
            Go to Login
          </Link>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="underline opacity-80 hover:opacity-100">
          Need a new link?
        </Link>
        <Link href="/login" className="underline opacity-80 hover:opacity-100">
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="text-white/50">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
