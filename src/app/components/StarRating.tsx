"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface StarRatingProps {
  viewkey: string;
}

export default function StarRating({ viewkey }: StarRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [average, setAverage] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    fetch(`/api/ratings?viewkey=${viewkey}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAverage(data.average);
          setCount(data.count);
          if (data.userRating) {
            setRating(data.userRating);
            setHasRated(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [viewkey]);

  const handleRate = async (stars: number) => {
    if (hasRated || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewkey, stars }),
      });

      const data = await res.json();

      if (data.ok) {
        setRating(stars);
        setHasRated(true);
        setCount((c) => c + 1);
        setAverage((avg) => {
          const newTotal = avg * count + stars;
          return Math.round((newTotal / (count + 1)) * 10) / 10;
        });
        toast.success(
          "Thanks for your contribution to Xessex, you will be paid for your work after the Next Epoch"
        );
      } else if (res.status === 401) {
        toast.error("Please log in to rate videos");
      } else if (res.status === 403) {
        toast.error("Diamond membership required to rate videos");
      } else if (res.status === 409) {
        toast.error("You have already rated this video");
        setHasRated(true);
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

  if (loading) {
    return (
      <div className="neon-border rounded-xl p-4 bg-black/30 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-32 mb-3"></div>
        <div className="h-8 bg-white/10 rounded w-48"></div>
      </div>
    );
  }

  return (
    <div className="neon-border rounded-xl p-3 md:p-4 bg-black/30">
      <h3 className="text-base md:text-lg font-semibold neon-text mb-2 md:mb-3">Rate This Video</h3>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => !hasRated && setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              disabled={hasRated || submitting}
              className={`text-2xl md:text-3xl transition-all ${
                hasRated
                  ? "cursor-default"
                  : "cursor-pointer hover:scale-110 active:scale-95"
              } ${
                star <= displayRating
                  ? "text-yellow-400"
                  : "text-white/30"
              }`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="text-xs md:text-sm text-white/60">
          {average > 0 ? (
            <>
              <span className="text-yellow-400 font-semibold">{average}</span>
              <span className="mx-1">/</span>
              <span>5</span>
              <span className="ml-2">({count} {count === 1 ? "rating" : "ratings"})</span>
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
