"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export default function AgeGateContent() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [loading, setLoading] = useState(false);

  function accept(event?: FormEvent<HTMLFormElement>) {
    if (loading) {
      event?.preventDefault();
      return;
    }
    setLoading(true);

    try {
      document.cookie = "age_ok=1; path=/; max-age=31536000; samesite=lax";
      document.cookie = "age_verified=true; path=/; max-age=31536000; samesite=lax";
    } catch {}

    try {
      localStorage.setItem("age_ok_tab", "1");
    } catch {}

    try {
      sessionStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_redirect", "1");
    } catch {}
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
            <a href="/terms" className="text-pink-400 underline">
              Terms of Service
            </a>.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <form
              action="/age/accept"
              method="GET"
              onSubmit={accept}
              className="flex-1"
            >
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border-2 border-pink-500 bg-pink-500/20 text-white font-semibold py-4 min-h-[56px] touch-manipulation cursor-pointer"
              >
                {loading ? "Entering..." : "I am 18 or older - Enter"}
              </button>
            </form>

            <a
              href="https://www.google.com"
              className="flex-1 inline-flex items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-500 font-semibold py-4 min-h-[56px] touch-manipulation cursor-pointer"
              style={{ color: "black" }}
            >
              I am under 18 - Exit
            </a>
          </div>

          <p className="mt-6 text-center text-white/90">
            Our{" "}
            <a href="/parental-controls" className="text-pink-400 underline">
              parental controls page
            </a>{" "}
            explains how to block access.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 text-white/50 text-sm">
            <span>© Xessex.me 2026</span>
            <img src="/logos/rta.gif" alt="RTA - Restricted to Adults" width={88} height={31} />
          </div>
        </div>
      </div>
    </main>
  );
}
