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
    fetch(`/api/ratings?videoId=${videoId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAverage(data.avgStars);
          setCount(data.starsCount);
          if (data.userRating) {
            setRating(data.userRating);
          }
        }
      })
      .finally(() => setLoading(false));

    // Check if user can rate (only if not readOnly)
    if (!readOnly) {
      fetch("/api/auth/status")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setCanRate(data.canRateStars);
          }
        });
    }
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
        body: JSON.stringify({ videoId, stars }),
      });

      const data = await res.json();

      if (data.ok) {
        setRating(stars);
        setAverage(data.avgStars);
        setCount(data.starsCount);
        toast.success(
          "Thanks for your contribution to Xessex, you will be paid for your work after the Next Epoch"
        );
      } else if (res.status === 429) {
        // Rate limited
        toast.error(`Please wait ${data.waitSeconds} seconds before changing your rating`);
      } else if (res.status === 401) {
        toast.error("Please log in to rate videos");
      } else if (res.status === 403) {
        toast.error("Diamond membership required to rate videos");
      } else {
        toast.error(data.error || "Failed to submit rating");
      }
    } catch {
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
                isInteractive
                  ? "cursor-pointer hover:scale-110 active:scale-95"
                  : "cursor-default"
              } ${star <= displayRating ? "text-yellow-400" : "text-white/30"}`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="text-xs md:text-sm text-white/60">
          {average > 0 ? (
            <>
              <span className="text-yellow-400 font-semibold">
                {average.toFixed(1)}
              </span>
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
