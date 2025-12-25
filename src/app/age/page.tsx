"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AgeGateContent() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  function accept() {
    // 30 days cookie
    document.cookie = `age_ok=1; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
    window.location.href = next;
  }

  function leave() {
    window.location.href = "https://www.google.com";
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg bg-zinc-900 rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Adults Only (18+)</h1>
        <p className="text-gray-300 mb-6 leading-relaxed">
          xessex.me contains sexually explicit material intended for adults. By continuing,
          you confirm you are at least 18 years old (or the age of majority where you live)
          and that viewing adult content is legal in your location.
        </p>

        <div className="flex gap-4 justify-center mb-6">
          <button
            onClick={accept}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors"
          >
            I am 18+ — Enter
          </button>
          <button
            onClick={leave}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold transition-colors"
          >
            Leave
          </button>
        </div>

        <p className="text-xs text-gray-500">
          We don&apos;t host videos. Content is embedded/linked from third-party partners.
        </p>
      </div>
    </main>
  );
}

export default function AgeGatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AgeGateContent />
    </Suspense>
  );
}
