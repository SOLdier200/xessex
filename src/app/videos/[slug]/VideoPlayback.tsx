"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Comments from "@/app/components/Comments";
import StarRating from "@/app/components/StarRating";
import ViewTracker from "@/app/components/ViewTracker";
import AddToPlaylistButton from "@/app/components/AddToPlaylistButton";

const COUNTDOWN_SECONDS = 5;

function formatViews(views: number | null): string {
  if (!views) return "0";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

type VideoPayload = {
  id: string;
  slug: string;
  title: string;
  embedUrl: string;
  viewsCount: number;
  sourceViews: number;
  avgStars: number;
  starsCount: number;
  unlockCost?: number;
  thumbnailUrl?: string | null;
  rank?: number | null;
  kind?: string;
};

type RelatedVideo = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  avgStars: number;
  viewsCount: number | null;
};

type VideoAccess =
  | { ok: true; unlocked: true; reason: "free" | "unlocked" | "staff"; unlockCost: number }
  | { ok: true; unlocked: false; reason: "locked"; unlockCost: number; creditBalance: number }
  | { ok: false; error: "not_found" | "not_authenticated" };

type VideoPlaybackProps = {
  initialVideo: VideoPayload;
  relatedVideos: RelatedVideo[];
  canRateStars: boolean;
  canPostComment: boolean;
  canVoteComments: boolean;
  isAuthed: boolean;
  hasWallet: boolean;
  creditBalance: number;
  access: VideoAccess;
  isAdminOrMod?: boolean;
};

const ENDED_EVENT_TOKENS = new Set([
  "ended",
  "videoended",
  "playerended",
  "ph5playerended",
  "ph5ended",
  "playbackended",
]);

function normalizeEventToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isEndedToken(token: string) {
  if (!token) return false;
  if (ENDED_EVENT_TOKENS.has(token)) return true;
  if (token.includes("suspend")) return false;
  return token.endsWith("ended");
}

function isVideoEndedMessage(data: unknown): boolean {
  if (!data) return false;
  if (data === "ended") return true;
  if (typeof data === "string") {
    if (isEndedToken(normalizeEventToken(data))) return true;
    try {
      return isVideoEndedMessage(JSON.parse(data));
    } catch {
      return false;
    }
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const eventValue =
      obj.event ?? obj.type ?? obj.state ?? obj.message ?? obj.action ?? obj.name ?? obj.status;
    if (isVideoEndedMessage(eventValue)) return true;
    if (isVideoEndedMessage(obj.data)) return true;
  }
  return false;
}

export default function VideoPlayback({
  initialVideo,
  relatedVideos,
  canRateStars,
  canPostComment,
  canVoteComments,
  isAuthed,
  hasWallet,
  creditBalance,
  access,
  isAdminOrMod,
}: VideoPlaybackProps) {
  const [currentVideo, setCurrentVideo] = useState<VideoPayload>(initialVideo);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isFirefoxMobile, setIsFirefoxMobile] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentVideoRef = useRef(currentVideo);
  const loadingRef = useRef(false);

  // Local access state (refreshed per video for autoplay-next)
  const [localUnlocked, setLocalUnlocked] = useState(access.ok && access.unlocked);
  const [localUnlockCost, setLocalUnlockCost] = useState(access.ok ? access.unlockCost : (initialVideo.unlockCost ?? 0));
  const [localCredits, setLocalCredits] = useState(creditBalance);
  const [localIsAuthed, setLocalIsAuthed] = useState(isAuthed);
  const [localHasWallet, setLocalHasWallet] = useState(hasWallet);

  const locked = !localUnlocked && localUnlockCost > 0;
  const canAfford = localCredits >= localUnlockCost;

  // Refresh access state for a given video
  const refreshAccess = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${videoId}/access`, { method: "GET" });
      const json = await res.json();
      if (!res.ok || !json?.ok) return;

      setLocalUnlocked(!!json.unlocked);
      setLocalUnlockCost(Number(json.unlockCost ?? 0));
      setLocalCredits(Number(json.creditBalance ?? 0));
      setLocalIsAuthed(!!json.isAuthed);
      setLocalHasWallet(!!json.hasWallet);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isFirefox = ua.includes("firefox");
    const isAndroid = ua.includes("android");
    const isMobile = ua.includes("mobile") || ua.includes("tablet");
    setIsFirefoxMobile(isFirefox && (isAndroid || isMobile));
  }, []);

  useEffect(() => {
    setCountdown(null);
  }, [currentVideo.id]);

  const playNextVideo = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingNext(true);

    try {
      const excludeViewkey = currentVideoRef.current.slug;
      const res = await fetch(
        `/api/videos/next?excludeViewkey=${encodeURIComponent(excludeViewkey)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.ok || !data.next) return;
      const next = data.next as VideoPayload;
      setCurrentVideo(next);
      setUnlockError(null);
      refreshAccess(next.id);
    } catch {
      // ignore fetch errors
    } finally {
      loadingRef.current = false;
      setIsLoadingNext(false);
    }
  }, [refreshAccess]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      playNextVideo();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, playNextVideo]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isVideoEndedMessage(event.data)) return;
      if (loadingRef.current) return;
      setCountdown((prev) => (prev === null ? COUNTDOWN_SECONDS : prev));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Listen for credits-changed event to refresh credit balance
  useEffect(() => {
    const handleCreditsChange = () => {
      refreshAccess(currentVideo.id);
    };
    window.addEventListener("credits-changed", handleCreditsChange);
    return () => window.removeEventListener("credits-changed", handleCreditsChange);
  }, [currentVideo.id, refreshAccess]);

  async function handleUnlock(): Promise<boolean> {
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/videos/${currentVideo.id}/unlock`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setUnlockError(json?.error ?? "unlock_failed");
        return false;
      }
      setLocalUnlocked(true);
      setLocalCredits(json.creditBalance);
      setShowUnlockModal(false);
      window.dispatchEvent(new CustomEvent("credits-changed"));
      return true;
    } catch {
      setUnlockError("network_error");
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }

  // Show locked overlay
  if (locked) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              {currentVideo.title}
            </h1>
            <div className="mt-1 text-xs text-white/50 font-mono break-all">
              {currentVideo.slug}
            </div>
          </div>
          <Link
            href="/videos"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Videos
          </Link>
        </div>

        <div className={`${currentVideo.kind === "XESSEX" ? "neon-border-gold" : "neon-border"} rounded-2xl overflow-hidden bg-black/30`}>
          <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
            {/* Blurred thumbnail background */}
            {currentVideo.thumbnailUrl ? (
              <img
                src={currentVideo.thumbnailUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 to-purple-900/30" />
            )}

            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-black/50">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="text-center max-w-md">
                <h2 className="text-xl font-semibold text-white">Video Locked</h2>

                {!localIsAuthed || !localHasWallet ? (
                  <p className="mt-2 text-sm text-white/80">
                    Connect your wallet to unlock videos with Special Credits.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-white/80">
                    Cost: <span className="font-bold text-yellow-400">{localUnlockCost}</span> Credits
                    <span className="mx-2">•</span>
                    You have: <span className="font-bold">{localCredits}</span>
                  </p>
                )}

                {unlockError && (
                  <p className="mt-2 text-sm text-red-400">
                    {unlockError === "insufficient_credits" && "Not enough credits"}
                    {unlockError === "no_credit_account" && "No credit account found"}
                    {unlockError === "already_unlocked" && "Already unlocked - refreshing..."}
                    {unlockError === "not_found" && "Video not found"}
                    {unlockError === "network_error" && "Network error - try again"}
                    {!["insufficient_credits", "no_credit_account", "already_unlocked", "not_found", "network_error"].includes(unlockError) && unlockError}
                  </p>
                )}
              </div>

              {(!localIsAuthed || !localHasWallet) ? (
                <Link
                  href="/login/diamond"
                  className="px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold transition"
                >
                  Connect Wallet
                </Link>
              ) : (
                <button
                  onClick={() => setShowUnlockModal(true)}
                  className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition"
                >
                  Unlock Video
                </button>
              )}

              {localIsAuthed && localHasWallet && !canAfford && (
                <p className="text-xs text-white/60">
                  Hold 10,000+ XESS to start earning Special Credits.
                </p>
              )}

              <p className="text-xs text-white/50 max-w-sm text-center">
                Unlock this video to curate and earn more XESS.
              </p>
            </div>
          </div>
        </div>

        {/* Unlock Confirmation Modal */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Unlock Video</h3>
                <button
                  onClick={() => setShowUnlockModal(false)}
                  className="text-white/60 hover:text-white text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                </div>

                <p className="text-lg text-white mb-2">
                  Unlock this video for
                </p>
                <p className="text-3xl font-bold text-yellow-400 mb-4">
                  {localUnlockCost} Credits
                </p>

                <div className="bg-black/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-white/70">Your balance:</p>
                  <p className={`text-xl font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}>
                    {localCredits} Credits
                  </p>
                  {!canAfford && (
                    <p className="text-xs text-red-400 mt-1">
                      You need {localUnlockCost - localCredits} more credits
                    </p>
                  )}
                </div>

                {unlockError && (
                  <p className="text-sm text-red-400 mb-4">
                    {unlockError === "insufficient_credits" && "Not enough credits"}
                    {unlockError === "no_credit_account" && "No credit account found"}
                    {unlockError === "already_unlocked" && "Already unlocked - refreshing..."}
                    {unlockError === "not_found" && "Video not found"}
                    {unlockError === "network_error" && "Network error - try again"}
                    {!["insufficient_credits", "no_credit_account", "already_unlocked", "not_found", "network_error"].includes(unlockError) && unlockError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnlockModal(false)}
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ViewTracker videoId={currentVideo.id} />

      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {currentVideo.title}
          </h1>
          <div className="mt-1 text-xs text-white/50 font-mono break-all">
            {currentVideo.slug}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {currentVideo.rank && (
              <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/50 text-yellow-300 font-bold">
                Rank #{currentVideo.rank}
              </span>
            )}
            <span className="text-xs text-white/30">
              PH Views: {currentVideo.sourceViews.toLocaleString()}
            </span>
            <span className="text-xs text-white/50">
              Xessex Views: {currentVideo.viewsCount.toLocaleString()}
            </span>
            {currentVideo.starsCount > 0 && (
              <span className="text-xs text-yellow-400">
                &#9733; {currentVideo.avgStars.toFixed(1)} ({currentVideo.starsCount})
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Link
            href="/videos"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          >
            Back to Videos
          </Link>
          <AddToPlaylistButton
            videoId={currentVideo.id}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
          />
          {isFirefoxMobile && currentVideo.embedUrl && (
            <a
              href={currentVideo.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
            >
              Open Video in New Tab
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <div className={`${currentVideo.kind === "XESSEX" ? "neon-border-gold" : "neon-border"} rounded-2xl overflow-hidden bg-black/30`}>
            <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
              {currentVideo.embedUrl ? (
                <iframe
                  ref={iframeRef}
                  key={currentVideo.id}
                  src={currentVideo.embedUrl}
                  title={currentVideo.title}
                  className="absolute inset-0 h-full w-full z-10"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  loading="eager"
                  referrerPolicy="origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  Video embed not configured
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-2xl md:text-3xl font-semibold pointer-events-none">
                  Next video starting in {countdown}...
                </div>
              )}

              {isLoadingNext && countdown === null && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-lg pointer-events-none">
                  Loading next video...
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTroubleshoot(true)}
            className="mt-3 text-xs text-white/60 hover:text-white transition"
          >
            Video not playing? Troubleshoot here
          </button>

          <div className="mt-4 md:mt-6">
            <StarRating videoId={currentVideo.id} readOnly={!canRateStars} />
          </div>

          <Comments
            videoId={currentVideo.id}
            canPost={canPostComment}
            canVote={canVoteComments}
            isAdminOrMod={isAdminOrMod}
          />
        </div>

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
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Views bar below thumbnail */}
                  <div className="flex items-center justify-center px-1 py-0.5 text-[9px] text-white/70 bg-black/30 rounded-b-md -mt-1">
                    <span>{formatViews(v.viewsCount)} views</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Credits display */}
          {localIsAuthed && (
            <div className={`mt-6 ${currentVideo.kind === "XESSEX" ? "neon-border-gold" : "neon-border"} rounded-xl p-4 bg-black/30`}>
              <h3 className="text-sm font-semibold text-white mb-2">Special Credits</h3>
              <p className="text-2xl font-bold text-yellow-400">{localCredits}</p>
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

      {showTroubleshoot && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/90 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Video Troubleshooting</h3>
                <p className="mt-1 text-sm text-white/70">
                  If you are using Firefox, make sure &quot;Enhanced Tracking Protection&quot; is disabled or
                  your videos may not play.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTroubleshoot(false)}
                className="text-white/60 hover:text-white text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="mt-4 text-sm text-white/70">
              If you are still having an issue please email{" "}
              <a href="mailto:support@xessex.me" className="text-pink-300 hover:text-pink-200">
                support@xessex.me
              </a>{" "}
              so that we can get it fixed for you right away. Xessex has a very committed team
              actively engaged in building and improving the site and we are dedicated to making
              sure everything works well for every user. Thank you for your feedback.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTroubleshoot(false)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
