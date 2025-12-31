"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AgeGatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnter(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/age", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept: true }),
      });
      if (res.ok) {
        router.push("/");
      }
    } catch (err) {
      console.error("Age verification error:", err);
      setLoading(false);
    }
  }

  function handleLeave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push("/leave");
  }

  return (
    <main className="min-h-screen bg-[#050a1a] text-white flex items-center justify-center relative overflow-hidden">
      {/* Robot image - positioned higher */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 pointer-events-none">
        <Image
          src="/logos/robot.png"
          alt=""
          width={500}
          height={500}
          className="object-contain"
          priority
        />
      </div>

      {/* Card - translucent */}
      <div className="px-6 py-10 relative z-10 mt-40">
        <div className="w-full max-w-2xl border-2 border-pink-500 rounded-2xl p-8 bg-black/30">
          <h1 className="text-2xl font-semibold border-2 border-pink-500 rounded-xl px-4 py-2 inline-block">
            Adults Only (18+)
          </h1>

          <div className="mt-4 grid gap-3 text-sm leading-6">
            <p className="border-2 border-pink-500 rounded-xl px-4 py-3 text-white/90">
              You&apos;re visiting from the United States. This website is intended for adults aged 18 or older.
            </p>

            <p className="border-2 border-pink-500 rounded-xl px-4 py-3 text-white/90">
              By continuing, you confirm that you are 18+ and legally permitted to view adult-oriented material
              where you are located.
            </p>

            <p className="border-2 border-pink-500 rounded-xl px-4 py-3 text-white/80">
              This site is intended to be compatible with parental control and filtering tools. If you&apos;re a parent
              or guardian, you can block access using device or network-level controls.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleEnter}
              disabled={loading}
              className="flex-1 rounded-xl bg-white/30 text-white font-medium py-3 hover:bg-white/40 disabled:opacity-60"
            >
              {loading ? "Entering…" : "I am 18+ — Enter"}
            </button>

            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="flex-1 rounded-xl border-2 border-pink-500 text-white font-medium py-3 hover:bg-white/5 disabled:opacity-60"
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
