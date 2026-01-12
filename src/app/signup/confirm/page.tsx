"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TopNav from "../../components/TopNav";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const sig = searchParams.get("sig");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sig) {
      setStatus("error");
      setMessage("No transaction signature provided.");
      return;
    }

    async function confirm() {
      try {
        const res = await fetch("/api/subscriptions/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signature: sig }),
        });

        const data = await res.json();

        if (data.ok) {
          setStatus("success");
          setMessage("Your subscription is now active!");
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to confirm subscription.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Failed to confirm subscription.");
      }
    }

    confirm();
  }, [sig]);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-xl neon-border rounded-2xl p-6 bg-black/30 text-center">
          {status === "loading" && (
            <>
              <div className="text-2xl font-semibold neon-text">Confirming...</div>
              <p className="mt-2 text-white/70">Please wait while we verify your payment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-2xl font-semibold text-green-400">Success!</div>
              <p className="mt-2 text-white/70">{message}</p>
              <Link
                href="/"
                className="inline-block mt-6 rounded-xl bg-pink-500 px-6 py-2 font-semibold text-black hover:bg-pink-400"
              >
                Start Watching
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-2xl font-semibold text-red-400">Error</div>
              <p className="mt-2 text-white/70">{message}</p>
              <Link
                href="/signup"
                className="inline-block mt-6 rounded-xl bg-pink-500 px-6 py-2 font-semibold text-black hover:bg-pink-400"
              >
                Try Again
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 pb-10 flex justify-center">
          <div className="w-full max-w-xl neon-border rounded-2xl p-6 bg-black/30 text-center">
            <div className="text-2xl font-semibold neon-text">Loading...</div>
          </div>
        </div>
      </main>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
