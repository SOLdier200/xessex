"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LockedVideoCardProps = {
  viewkey: string;
  title: string;
  thumb: string | null;
  duration: string;
  rank?: number | null;
  viewsCount?: number | null;
  isAuthed: boolean;
  size?: "normal" | "small";
  showMetaBelow?: boolean;
  className?: string;
  borderVariant?: "pink" | "blue" | "gold";
};

export default function LockedVideoCard({
  viewkey,
  title,
  thumb,
  duration,
  rank,
  viewsCount,
  isAuthed,
  size = "normal",
  showMetaBelow = false,
  className,
  borderVariant = "pink",
}: LockedVideoCardProps) {
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

  const formatViews = (views: number | null | undefined) => {
    const v = Number(views ?? 0);
    if (!Number.isFinite(v) || v <= 0) return "0";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return `${Math.floor(v)}`;
  };

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
      // Success - close modal and refresh to show unlocked video
      setShowModal(false);
      router.refresh();
    } catch {
      setUnlockError("network_error");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <>
      <div
        className={`${borderVariant === "gold" ? "neon-border-gold" : borderVariant === "blue" ? "neon-border-blue" : "neon-border"} rounded-2xl bg-black/30 overflow-hidden relative group ${className || ""}`}
      >
        <div className="relative aspect-video bg-black/60">
          {thumb ? (
            <img
              src={thumb}
              alt="Premium video"
              className="w-full h-full object-cover blur-md scale-110 opacity-60"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              No Thumbnail
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            {isAuthed ? (
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold transition"
              >
                Unlock
              </button>
            ) : (
              <Link
                href="/login/diamond"
                className="mt-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition border border-white/20"
              >
                Login to Unlock
              </Link>
            )}
          </div>
          {/* Rank badge if has rank */}
          {rank != null && (
            <div
              className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
              style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
            >
              #{rank}
            </div>
          )}
          {!showMetaBelow && (
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
              {duration}
            </div>
          )}
          {!showMetaBelow && viewsCount != null && (
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-xs text-white">
              {formatViews(viewsCount)} XESS Views
            </div>
          )}
        </div>
        {showMetaBelow && (
          <div className="flex items-center justify-between px-2 py-1 text-[10px] md:text-xs text-white/70 bg-black/30">
            <span>{duration}</span>
            {viewsCount != null && (
              <span>{formatViews(viewsCount)} XESS Views</span>
            )}
          </div>
        )}
        {size !== "small" && (
          <div className="p-2 md:p-3">
            <div className="font-semibold text-white/40 text-xs md:text-sm italic">
              Locked Video
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs text-yellow-400">
              <span>Credits to unlock</span>
            </div>
          </div>
        )}
      </div>

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
