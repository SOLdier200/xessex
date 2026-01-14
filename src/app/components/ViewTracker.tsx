"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  videoId: string;
}

export default function ViewTracker({ videoId }: ViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    // Only track once per page load
    if (tracked.current) return;
    tracked.current = true;

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
