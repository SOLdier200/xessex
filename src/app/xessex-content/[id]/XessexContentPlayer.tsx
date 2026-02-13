"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Comments from "@/app/components/Comments";
import StarRating from "@/app/components/StarRating";
import ViewTracker from "@/app/components/ViewTracker";

function formatViews(views: number | null): string {
  if (!views) return "0";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

type RelatedVideo = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  avgStars: number;
  viewsCount: number | null;
};

type Props = {
  contentId: string;
  videoDbId: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string | null; // null = locked
  unlockCost: number;
  creditBalance: number;
  isAuthed: boolean;
  hasWallet: boolean;
  unlocked: boolean;
  canRateStars: boolean;
  canPostComment: boolean;
  canVoteComments: boolean;
  isAdminOrMod?: boolean;
  viewsCount: number;
  avgStars: number;
  starsCount: number;
  rank: number | null;
  relatedVideos: RelatedVideo[];
};

export default function XessexContentPlayer({
  contentId,
  videoDbId,
  title,
  thumbnailUrl,
  videoUrl: initialVideoUrl,
  unlockCost,
  creditBalance: initialBalance,
  isAuthed,
  hasWallet,
  unlocked: initialUnlocked,
  canRateStars,
  canPostComment,
  canVoteComments,
  isAdminOrMod,
  viewsCount,
  avgStars,
  starsCount,
  rank,
  relatedVideos,
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
      window.location.reload();
    } catch {
      setError("network_error");
    } finally {
      setIsUnlocking(false);
    }
  }

  // ── Locked state ──
  if (!isUnlocked || !videoUrl) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {rank && (
                <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/50 text-yellow-300 font-bold">
                  Rank #{rank}
                </span>
              )}
              <span className="text-xs text-white/50">
                Xessex Views: {viewsCount.toLocaleString()}
              </span>
              {starsCount > 0 && (
                <span className="text-xs text-yellow-400">
                  &#9733; {avgStars.toFixed(1)} ({starsCount})
                </span>
              )}
            </div>
          </div>
          <Link
            href="/xessex-content"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Gallery
          </Link>
        </div>

        <div className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
          <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60"
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-black/50">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
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
                  <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
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
                      You need {(unlockCost - credits).toLocaleString()} more credits
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

  // ── Unlocked state — full video page experience ──
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ViewTracker videoId={videoDbId} />

      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {rank && (
              <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/50 text-yellow-300 font-bold">
                Rank #{rank}
              </span>
            )}
            <span className="text-xs text-white/50">
              Xessex Views: {viewsCount.toLocaleString()}
            </span>
            {starsCount > 0 && (
              <span className="text-xs text-yellow-400">
                &#9733; {avgStars.toFixed(1)} ({starsCount})
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Link
            href="/xessex-content"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Gallery
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main content column */}
        <div className="lg:col-span-2">
          <div className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
            <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
              <video
                src={videoUrl}
                controls
                playsInline
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          {/* Star Rating */}
          <div className="mt-4 md:mt-6">
            <StarRating videoId={videoDbId} readOnly={!canRateStars} />
          </div>

          {/* Comments */}
          <Comments
            videoId={videoDbId}
            canPost={canPostComment}
            canVote={canVoteComments}
            isAdminOrMod={isAdminOrMod}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 mt-4 lg:mt-0">
          <h2 className="text-lg font-semibold neon-text mb-4">More Videos</h2>

          {relatedVideos.length === 0 ? (
            <p className="text-white/50 text-sm">No other videos available.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-2">
              {relatedVideos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.slug}`}
                  className="block group"
                >
                  <div className="relative w-full aspect-video bg-black/60 rounded-md overflow-hidden">
                    {v.thumbnailUrl ? (
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center px-1 py-0.5 text-[9px] text-white/70 bg-black/30 rounded-b-md -mt-1">
                    <span>{formatViews(v.viewsCount)} views</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Credits display */}
          {isAuthed && (
            <div className="mt-6 neon-border-gold rounded-xl p-4 bg-black/30">
              <h3 className="text-sm font-semibold text-white mb-2">Special Credits</h3>
              <p className="text-2xl font-bold text-yellow-400">{credits}</p>
              <p className="text-xs text-white/50 mt-1">
                Earn credits by holding XESS tokens
              </p>
            </div>
          )}

          {/* Ad placement box */}
          <div className="mt-6 rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-center">
            <p className="text-sm text-white/70 font-medium">Place your AD Here!</p>
            <p className="text-xs text-white/50 mt-1">
              Contact{" "}
              <a
                href="mailto:support@xessex.me"
                className="text-pink-400 hover:text-pink-300 transition"
              >
                support@xessex.me
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
