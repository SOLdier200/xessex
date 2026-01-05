"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

function AgeGateContent() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (loading) return;
    setLoading(true);

    try {
      // Set per-tab sessionStorage flag
      sessionStorage.setItem("age_ok_tab", "1");

      // Set session cookie via API
      await fetch("/api/age/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });

      // Navigate to destination
      window.location.href = next;
    } catch (err) {
      console.error("Age verification error:", err);
      setLoading(false);
    }
  }

  function handleLeave() {
    window.location.href = "https://www.google.com";
  }

  return (
    <main className="min-h-screen bg-[#050a1a] text-white flex items-center justify-center relative overflow-hidden px-4">
      {/* Robot image */}
      <div className="absolute top-4 md:top-10 left-1/2 -translate-x-1/2 pointer-events-none">
        <Image
          src="/logos/robot.png"
          alt=""
          width={500}
          height={500}
          className="object-contain w-[200px] md:w-[500px] h-auto"
          priority
        />
      </div>

      {/* Card */}
      <div className="py-6 md:py-10 relative z-10 mt-32 md:mt-40 w-full max-w-2xl">
        <div className="w-full border-2 border-pink-500 rounded-2xl p-4 md:p-8 bg-black/30">
          <h1 className="text-xl md:text-2xl font-semibold border-2 border-pink-500 rounded-xl px-3 md:px-4 py-2 inline-block">
            Adults Only (18+)
          </h1>

          <div className="mt-4 grid gap-3 text-sm leading-6">
            <p className="border-2 border-pink-500 rounded-xl px-3 md:px-4 py-3 text-white/90">
              This website contains age-restricted material. By entering, you confirm that you are at least 18 years old.
            </p>

            <p className="border-2 border-pink-500 rounded-xl px-3 md:px-4 py-3 text-white/90">
              By continuing, you confirm that you are legally permitted to view adult-oriented material where you are located.
            </p>

            <p className="border-2 border-pink-500 rounded-xl px-3 md:px-4 py-3 text-white/80 text-xs md:text-sm">
              This site is compatible with parental control tools. Parents can block access using device or network-level controls.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 rounded-xl bg-white/30 text-white font-medium py-3 hover:bg-white/40 active:bg-white/50 disabled:opacity-60 transition"
            >
              {loading ? "Entering…" : "I am 18+ — Enter"}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 text-white font-medium py-3 hover:bg-white/5 active:bg-white/10 transition"
            >
              Leave
            </button>
          </div>

          <div className="mt-6">
            <a
              href="/leave"
              className="inline-block border-2 border-pink-500 rounded-xl px-4 py-2 text-sm hover:bg-white/5"
            >
              Learn how to block this site
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AgeGatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050a1a] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AgeGateContent />
    </Suspense>
  );
}
