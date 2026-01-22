"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageViewTracker() {
  const pathname = usePathname();
  const tracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Don't track admin pages or API routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return;
    }

    // Only track each path once per session
    if (tracked.current.has(pathname)) {
      return;
    }

    tracked.current.add(pathname);

    fetch("/api/track-view", { method: "POST" }).catch(() => {
      // Silent fail
    });
  }, [pathname]);

  return null;
}
