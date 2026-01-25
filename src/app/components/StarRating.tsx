"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface StarRatingProps {
  videoId: string;
  readOnly?: boolean;
}

export default function StarRating({ videoId, readOnly = false }: StarRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [average, setAverage] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canRate, setCanRate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setRating(null);
    setHovered(null);
    setAverage(0);
    setCount(0);

    (async () => {
      try {
        // GET rating stats (include cookies explicitly)
        const res = await fetch(`/api/ratings?videoId=${encodeURIComponent(videoId)}`, {
          credentials: "include",
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // If HTML/redirect/etc returned, JSON parsing fails
          if (!cancelled) {
            toast.error("Session issue loading ratings. Refresh the page.");
          }
          return;
        }

        if (!cancelled && data?.ok) {
          setAverage(typeof data.avgStars === "number" ? data.avgStars : 0);
          setCount(typeof data.starsCount === "number" ? data.starsCount : 0);
          setRating(typeof data.userRating === "number" ? data.userRating : null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[StarRating] GET failed:", e);
          toast.error("Could not load ratings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Check if user can rate (only if not readOnly)
      if (!readOnly) {
        try {
          const res = await fetch("/api/auth/status", { credentials: "include" });
          const data = await res.json().catch(() => null);
          if (!cancelled && data?.ok) setCanRate(!!data.canRateStars);
        } catch (e) {
          console.warn("[StarRating] auth status check failed:", e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId, readOnly]);

  const handleRate = async (stars: number) => {
    if (readOnly || submitting) return;

    if (!canRate) {
      toast.error("Diamond membership required to rate videos");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // critical (cookies/session)
        body: JSON.stringify({ videoId, stars }),
      });

      // Prevent "Network error" when server returns HTML/redirect
      let data: any = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => "");
        console.error("[StarRating] Non-JSON response:", res.status, text.slice(0, 300));
        toast.error("Session expired or blocked. Refresh and try again.");
        return;
      }

      if (data?.ok) {
        setRating(stars);
        setAverage(data.avgStars);
        setCount(data.starsCount);
        toast.success(
          "Star rating received, helping rate videos accurately helps Xessex succeed, raises the value of our token, and benefits us all, thank you for your contribution."
        );
        return;
      }

      // Handle known statuses
      if (res.status === 429) {
        toast.error(`Please wait ${data?.waitSeconds ?? 20} seconds before changing your rating`);
      } else if (res.status === 401) {
        toast.error("Please log in to rate videos");
      } else if (res.status === 403) {
        toast.error("Diamond membership required to rate videos");
      } else {
        toast.error(data?.error || "Failed to submit rating");
      }
    } catch (e) {
      console.error("[StarRating] POST failed:", e);
      toast.error("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hovered ?? rating ?? 0;
  const hasRated = rating !== null;
  const isInteractive = !readOnly && canRate;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-white/10 rounded w-32 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-48"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => isInteractive && setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              disabled={!isInteractive || submitting}
              className={`text-2xl md:text-3xl transition-all ${
                isInteractive ? "cursor-pointer hover:scale-110 active:scale-95" : "cursor-default"
              } ${star <= displayRating ? "text-yellow-400" : "text-white/30"}`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="text-xs md:text-sm text-white/60">
          {average > 0 ? (
            <>
              <span className="text-yellow-400 font-semibold">{average.toFixed(1)}</span>
              <span className="mx-1">/</span>
              <span>5</span>
              <span className="ml-2">
                ({count} {count === 1 ? "rating" : "ratings"})
              </span>
            </>
          ) : (
            <span>No ratings yet</span>
          )}
        </div>
      </div>

      {hasRated && (
        <p className="mt-2 text-xs md:text-sm text-green-400">
          You rated this video {rating} {rating === 1 ? "star" : "stars"}
        </p>
      )}
    </div>
  );
}
