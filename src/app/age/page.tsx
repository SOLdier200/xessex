"use client";

import { useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

function AgeGateContent() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  function handleCaptchaVerify(token: string) {
    setCaptchaToken(token);
    // Don't auto-proceed - user must click again (trusted gesture for mobile Chrome)
  }

  function proceedToSite() {
    setLoading(true);

    try {
      // Set all storage methods synchronously (bulletproof for mobile)
      document.cookie = "age_ok=1; path=/; max-age=31536000";
      localStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_tab", "1");
    } catch {}

    // Raw navigation - assign is more reliable on Android
    window.location.assign(next);
  }

  function handleCaptchaExpire() {
    setCaptchaToken(null);
  }

  function handleAccept() {
    if (loading) return;

    // Require captcha if site key is configured
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      captchaRef.current?.execute();
      return;
    }

    // Captcha verified or not required - proceed
    proceedToSite();
  }

  function handleLeave() {
    window.location.assign("https://www.google.com");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-6 md:py-10 relative overflow-hidden">
      <div className="w-full max-w-2xl relative z-10">
        <div className="w-full rounded-2xl p-4 md:p-8 bg-black">
          <div className="flex justify-center mb-4">
            <Image
              src="/logos/neonmainlogo1.png"
              alt="Xessex"
              width={400}
              height={150}
              className="w-[101px] md:w-[137px] h-auto drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
              priority
            />
          </div>

          <h1 className="text-xl md:text-3xl font-semibold px-3 md:px-4 py-2 text-center">
            THIS IS AN <span className="animate-pulse-glow">ADULT WEBSITE</span>
          </h1>
          <style jsx>{`
            @keyframes pulse-glow {
              0%, 100% {
                text-shadow: 0 0 10px #ec4899, 0 0 20px #ec4899, 0 0 30px #ec4899;
              }
              50% {
                text-shadow: 0 0 5px #ec4899, 0 0 10px #ec4899;
              }
            }
            .animate-pulse-glow {
              animation: pulse-glow 2s ease-in-out infinite;
              color: #ec4899;
            }
          `}</style>

          <div className="mt-4">
            <p className="px-3 md:px-4 py-3 text-white/90 text-base md:text-lg leading-6 text-center">
              This website contains age-restricted materials including nudity and explicit depictions of sexual activity. By entering, you affirm that you are at least 18 years of age or the age of majority in the jurisdiction you are accessing the website from and you consent to viewing sexually explicit content.
            </p>
          </div>

          <p className="px-3 md:px-4 mt-4 text-white/90 text-base leading-6 text-center">
            By entering, you agree to our <a href="/terms" target="_blank" className="text-pink-400 underline hover:text-pink-300">Terms of Service</a>.
          </p>

          {/* Invisible hCaptcha - triggered programmatically */}
          {HCAPTCHA_SITE_KEY && (
            <div className="flex justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                size="invisible"
                onVerify={handleCaptchaVerify}
                onExpire={handleCaptchaExpire}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500/20 text-white font-semibold text-base py-4 min-h-[56px] hover:bg-pink-500/30 active:bg-pink-500/40 disabled:opacity-60 transition select-none touch-manipulation cursor-pointer"
            >
              {loading ? "Entering…" : captchaToken ? "Tap to Enter" : "I am 18 or older - Enter"}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 bg-pink-500 text-black font-semibold text-base py-4 min-h-[56px] hover:bg-pink-400 active:bg-pink-300 transition select-none touch-manipulation cursor-pointer"
            >
              I am under 18 - Exit
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="px-3 md:px-4 text-white/90 text-base leading-6">
              Our <a href="/parental-controls" target="_blank" className="text-pink-400 underline hover:text-pink-300">parental controls page</a> explains how you can easily block access to this site.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 text-white/50 text-sm">
            <span>© Xessex.me 2026</span>
            <Image
              src="/logos/rta.gif"
              alt="RTA"
              width={60}
              height={20}
              className="h-5 w-auto"
              unoptimized
            />
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
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AgeGateContent />
    </Suspense>
  );
}
