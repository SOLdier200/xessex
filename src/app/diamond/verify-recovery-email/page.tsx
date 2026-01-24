"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function VerifyRecoveryEmailContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";

  const [state, setState] = useState<"working" | "success" | "error">(
    "working"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("Missing token.");

        const res = await fetch("/api/diamond/recovery-email/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        }).then((r) => r.json());

        if (!res?.ok) throw new Error(res?.error || "Verification failed.");

        setState("success");
        setTimeout(() => router.push("/profile"), 2000);
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Verify Recovery Email</h1>

        {state === "working" && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ff4fd8] border-t-transparent" />
              <span>Verifying your email...</span>
            </div>
          </div>
        )}

        {state === "success" && (
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
              <span className="font-semibold">Email verified!</span>
            </div>
            <p className="mt-2 text-white/70">
              Your recovery email has been verified. You can now use it to
              restore your Diamond membership if you ever lose access to your
              wallet.
            </p>
            <p className="mt-2 text-sm text-white/50">
              Redirecting to profile...
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
            <div className="flex items-center gap-2 text-red-400">
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span className="font-semibold">Verification failed</span>
            </div>
            <p className="mt-2 text-white/70">{error || "Something went wrong."}</p>
            <Link
              href="/profile"
              className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              Back to Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyRecoveryEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ff4fd8] border-t-transparent" />
        </div>
      }
    >
      <VerifyRecoveryEmailContent />
    </Suspense>
  );
}
