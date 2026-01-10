"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export default function AgeGateContent() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [loading, setLoading] = useState(false);

  function accept() {
    if (loading) return;
    setLoading(true);

    try {
      document.cookie = "age_ok=1; path=/; max-age=31536000; samesite=lax";
      localStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_tab", "1");

      // One-load bypass for Android timing/race
      sessionStorage.setItem("age_ok_redirect", "1");
    } catch {}

    // MUST be synchronous + direct user gesture
    window.location.assign(next);
  }

  function leave() {
    window.location.assign("https://www.google.com");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-6 md:py-10">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl p-4 md:p-8 bg-black">
          <div className="flex justify-center mb-4">
            <Image
              src="/logos/neonmainlogo1.png"
              alt="Xessex"
              width={400}
              height={150}
              className="w-[101px] md:w-[137px] h-auto"
              priority
            />
          </div>

          <h1 className="text-xl md:text-3xl font-semibold text-center">
            THIS IS AN <span className="text-pink-400">ADULT WEBSITE</span>
          </h1>

          <p className="mt-4 text-center text-white/90">
            This website contains age-restricted materials including nudity and explicit depictions of sexual activity.
          </p>

          <p className="mt-4 text-center text-white/90">
            By entering, you agree to our{" "}
            <a href="/terms" target="_blank" className="text-pink-400 underline">
              Terms of Service
            </a>.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={loading}
              onPointerUp={(e) => {
                e.preventDefault();
                accept();
              }}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500/20 text-white font-semibold py-4 min-h-[56px] touch-manipulation"
            >
              {loading ? "Entering..." : "I am 18 or older - Enter"}
            </button>

            <button
              type="button"
              disabled={loading}
              onPointerUp={(e) => {
                e.preventDefault();
                leave();
              }}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500 text-black font-semibold py-4 min-h-[56px] touch-manipulation"
            >
              I am under 18 - Exit
            </button>
          </div>

          <p className="mt-6 text-center text-white/90">
            Our{" "}
            <a href="/parental-controls" target="_blank" className="text-pink-400 underline">
              parental controls page
            </a>{" "}
            explains how to block access.
          </p>

          <div className="mt-6 text-center text-white/50 text-sm">
            © Xessex.me 2026
          </div>
        </div>
      </div>
    </main>
  );
}
