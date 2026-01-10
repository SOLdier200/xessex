"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

export default function AgeGatePage() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  function handleCaptchaVerify(token: string) {
    setCaptchaToken(token);
  }

  function handleCaptchaExpire() {
    setCaptchaToken(null);
  }

  function proceed() {
    setLoading(true);

    try {
      document.cookie = "age_ok=1; path=/; max-age=31536000";
      localStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_tab", "1");
    } catch {}

    // Delay avoids Android Chrome gesture-loss bug
    setTimeout(() => {
      window.location.href = next;
    }, 50);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    // If captcha required but not done yet
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      captchaRef.current?.execute();
      return;
    }

    proceed();
  }

  function handleLeave() {
    window.location.href = "https://www.google.com";
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

          {HCAPTCHA_SITE_KEY && (
            <div className="flex justify-center mt-4">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                size="invisible"
                onVerify={handleCaptchaVerify}
                onExpire={handleCaptchaExpire}
              />
            </div>
          )}

          {/* FORM FIXES ANDROID CHROME */}
          <form onSubmit={onSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">

            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500/20 text-white font-semibold py-4 min-h-[56px]"
            >
              {loading
                ? "Entering..."
                : captchaToken
                ? "Tap to Enter"
                : "I am 18 or older - Enter"}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500 text-black font-semibold py-4 min-h-[56px]"
            >
              I am under 18 - Exit
            </button>
          </form>

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
