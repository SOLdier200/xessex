"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LockedFeaturedCardProps = {
  viewkey: string;
  title: string;
  thumb: string | null;
  duration: string;
  performers: string;
  isAuthed: boolean;
  variant: "featured" | "topRanked" | "xessex";
  viewsCount?: number | null;
  showMetaBelow?: boolean;
  className?: string;
};

export default function LockedFeaturedCard({
  viewkey,
  title,
  thumb,
  duration,
  performers,
  isAuthed,
  variant,
  viewsCount,
  showMetaBelow = false,
  className,
}: LockedFeaturedCardProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [nextCost, setNextCost] = useState(10);

  // Fetch unlock summary when modal opens
  useEffect(() => {
    if (!showModal || !isAuthed) return;
    fetch("/api/videos/unlocks/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCreditBalance(d.creditBalance);
          setNextCost(d.nextCost);
        }
      })
      .catch(() => {});
  }, [showModal, isAuthed]);

  const canAfford = creditBalance >= nextCost;

  async function handleUnlock() {
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/videos/${viewkey}/unlock`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setUnlockError(json?.error ?? "unlock_failed");
        return;
      }
      setShowModal(false);
      window.dispatchEvent(new CustomEvent("credits-changed"));
      router.refresh();
    } catch {
      setUnlockError("network_error");
    } finally {
      setIsUnlocking(false);
    }
  }

  const isFeatured = variant === "featured";
  const isXessex = variant === "xessex";
  const borderClass = isXessex ? "neon-border-gold" : isFeatured ? "" : "border-yellow-400/30";
  const headerClass = isXessex ? "text-yellow-400" : isFeatured ? "neon-text" : "text-yellow-400";
  const headerText = isXessex ? "Xessex Original" : isFeatured ? "Featured Video" : "Top Ranked Video";

  const formatViews = (views: number | null | undefined) => {
    const v = Number(views ?? 0);
    if (!Number.isFinite(v) || v <= 0) return "0";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${Math.floor(v)}`;
  };

  return (
    <>
      <section className={`${isXessex ? "neon-border-gold" : "neon-border"} rounded-2xl p-4 md:p-6 bg-black/30 ${!isXessex ? borderClass : ""} ${className || ""}`}>
        <h2 className={`text-lg font-semibold ${headerClass} mb-4`}>{headerText}</h2>
        <div className="block w-full">
          <div className="relative aspect-video rounded-xl overflow-hidden">
            {thumb && (
              <img
                src={thumb}
                alt="Locked video"
                className="w-full h-full object-cover"
              />
            )}
            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
              <span className="text-4xl">🔒</span>
              {isAuthed ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-3 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition"
                >
                  Unlock Video
                </button>
              ) : (
                <Link
                  href="/login/diamond"
                  className="mt-3 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold transition border border-white/20"
                >
                  Login to Unlock
                </Link>
              )}
            </div>
            {!showMetaBelow && viewsCount != null && (
              <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
                {formatViews(viewsCount)} XESS Views
              </div>
            )}
          </div>
          {showMetaBelow && (
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>{duration}</span>
              {viewsCount != null && (
                <span>{formatViews(viewsCount)} XESS Views</span>
              )}
            </div>
          )}
          <h3 className="mt-3 text-sm font-semibold text-white/50 italic">
            🔒 Unlock to reveal
          </h3>
        </div>
      </section>

      {/* Unlock Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Unlock Video</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setUnlockError(null);
                }}
                className="text-white/60 hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>

              <p className="text-lg text-white mb-2">
                Unlock this video for
              </p>
              <p className="text-3xl font-bold text-yellow-400 mb-4">
                {nextCost} Credits
              </p>

              <div className="bg-black/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-white/70">Your balance:</p>
                <p className={`text-xl font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}>
                  {creditBalance} Credits
                </p>
                {!canAfford && (
                  <p className="text-xs text-red-400 mt-1">
                    You need {nextCost - creditBalance} more credits
                  </p>
                )}
              </div>

              {unlockError && (
                <p className="text-sm text-red-400 mb-4">
                  {unlockError === "insufficient_credits" && "Not enough credits"}
                  {unlockError === "no_credit_account" && "No credit account found"}
                  {unlockError === "already_unlocked" && "Already unlocked!"}
                  {unlockError === "not_found" && "Video not found"}
                  {unlockError === "network_error" && "Network error - try again"}
                  {!["insufficient_credits", "no_credit_account", "already_unlocked", "not_found", "network_error"].includes(unlockError) && unlockError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setUnlockError(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                disabled={isUnlocking || !canAfford}
                className="flex-1 px-4 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking ? "Unlocking..." : "Confirm Unlock"}
              </button>
            </div>

            <p className="text-xs text-white/50 text-center mt-4">
              Want to unlock new videos faster? Go to{" "}
              <a href="/swap" className="text-cyan-400 hover:text-cyan-300 underline">
                Swap
              </a>{" "}
              to get XESS tokens to hold in your wallet and earn special credits!
            </p>
          </div>
        </div>
      )}
    </>
  );
}
