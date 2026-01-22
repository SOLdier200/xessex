"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  videoId: string;
}

export default function ViewTracker({ videoId }: ViewTrackerProps) {
  const tracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (tracked.current.has(videoId)) return;
    tracked.current.add(videoId);

    // Track the view after a short delay (to avoid counting bounces)
    const timer = setTimeout(() => {
      fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
      }).catch(() => {
        // Ignore errors
      });
    }, 3000); // Track after 3 seconds of viewing

    return () => clearTimeout(timer);
  }, [videoId]);

  return null;
}
