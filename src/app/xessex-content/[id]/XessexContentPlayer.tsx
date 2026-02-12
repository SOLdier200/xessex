"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Props = {
  contentId: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string | null; // null = locked
  unlockCost: number;
  creditBalance: number;
  isAuthed: boolean;
  hasWallet: boolean;
  unlocked: boolean;
};

export default function XessexContentPlayer({
  contentId,
  title,
  thumbnailUrl,
  videoUrl: initialVideoUrl,
  unlockCost,
  creditBalance: initialBalance,
  isAuthed,
  hasWallet,
  unlocked: initialUnlocked,
}: Props) {
  const [isUnlocked, setIsUnlocked] = useState(initialUnlocked);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [credits, setCredits] = useState(initialBalance);
  const [showModal, setShowModal] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = credits >= unlockCost;

  const refreshAccess = useCallback(async () => {
    try {
      const res = await fetch(`/api/xessex-content/${contentId}/access`);
      const data = await res.json();
      if (data.ok) {
        setCredits(data.creditBalance ?? 0);
        if (data.unlocked && !isUnlocked) {
          setIsUnlocked(true);
          // Fetch the page again to get the video URL
          window.location.reload();
        }
      }
    } catch {}
  }, [contentId, isUnlocked]);

  useEffect(() => {
    const handler = () => refreshAccess();
    window.addEventListener("credits-changed", handler);
    return () => window.removeEventListener("credits-changed", handler);
  }, [refreshAccess]);

  async function handleUnlock() {
    setError(null);
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/xessex-content/${contentId}/unlock`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unlock_failed");
        return;
      }
      setCredits(data.creditBalance);
      setIsUnlocked(true);
      setShowModal(false);
      window.dispatchEvent(new CustomEvent("credits-changed"));
      // Reload to get video URL from server
      window.location.reload();
    } catch {
      setError("network_error");
    } finally {
      setIsUnlocking(false);
    }
  }

  // Unlocked state — native video player
  if (isUnlocked && videoUrl) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
          <Link
            href="/xessex-content"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Gallery
          </Link>
        </div>

        <div className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
          <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      </div>
    );
  }

  // Locked state
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
        <Link
          href="/xessex-content"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
        >
          Back to Gallery
        </Link>
      </div>

      <div className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
        <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
          {/* Blurred GIF background */}
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60"
          />

          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-black/50">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold text-white">Video Locked</h2>

              {!isAuthed || !hasWallet ? (
                <p className="mt-2 text-sm text-white/80">
                  Connect your wallet to unlock videos with Special Credits.
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/80">
                  Cost:{" "}
                  <span className="font-bold text-yellow-400">
                    {unlockCost.toLocaleString()}
                  </span>{" "}
                  Credits
                  <span className="mx-2">&bull;</span>
                  You have:{" "}
                  <span className="font-bold">{credits.toLocaleString()}</span>
                </p>
              )}

              {error && (
                <p className="mt-2 text-sm text-red-400">
                  {error === "insufficient_credits" && "Not enough credits"}
                  {error === "no_credit_account" && "No credit account found"}
                  {error === "network_error" && "Network error - try again"}
                  {!["insufficient_credits", "no_credit_account", "network_error"].includes(error) && error}
                </p>
              )}
            </div>

            {!isAuthed || !hasWallet ? (
              <Link
                href="/login/diamond"
                className="px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold transition"
              >
                Connect Wallet
              </Link>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition"
              >
                Unlock Video
              </button>
            )}

            {isAuthed && hasWallet && !canAfford && (
              <p className="text-xs text-white/60">
                Hold 10,000+ XESS to start earning Special Credits.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Unlock Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Unlock Video</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/60 hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <p className="text-lg text-white mb-2">Unlock this video for</p>
              <p className="text-3xl font-bold text-yellow-400 mb-4">
                {unlockCost.toLocaleString()} Credits
              </p>

              <div className="bg-black/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-white/70">Your balance:</p>
                <p
                  className={`text-xl font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}
                >
                  {credits.toLocaleString()} Credits
                </p>
                {!canAfford && (
                  <p className="text-xs text-red-400 mt-1">
                    You need {(unlockCost - credits).toLocaleString()} more
                    credits
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-400 mb-4">
                  {error === "insufficient_credits" && "Not enough credits"}
                  {error === "no_credit_account" && "No credit account found"}
                  {error === "network_error" && "Network error - try again"}
                  {!["insufficient_credits", "no_credit_account", "network_error"].includes(error) && error}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
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

            {!canAfford && (
              <p className="text-xs text-white/50 text-center mt-4">
                Hold 10,000+ XESS to start earning Special Credits
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
