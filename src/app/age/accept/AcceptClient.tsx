"use client";

import { useEffect, useRef } from "react";
import { setAgeGateOk } from "@/lib/ageGateState";

type AcceptClientProps = {
  next?: string;
};

function sanitizeNext(nextValue?: string) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  if (nextValue.startsWith("/age")) return "/";
  return nextValue;
}

export default function AcceptClient({ next }: AcceptClientProps) {
  const safeNext = sanitizeNext(next);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function acceptAge() {
      try {
        // Call server API to set httpOnly cookie (reliable on iOS/wallet browsers)
        const res = await fetch("/api/age/accept", { method: "POST" });
        if (!res.ok) {
          console.error("[age-accept] API failed:", res.status);
        }
      } catch (err) {
        console.error("[age-accept] API error:", err);
      }

      // Also set client-side state as fallback
      setAgeGateOk(true);

      // Small delay before redirect to ensure cookie is set
      await new Promise((r) => setTimeout(r, 100));

      // Use window.location for a full navigation (more reliable than router.replace on iOS)
      window.location.href = safeNext || "/";
    }

    acceptAge();
  }, [safeNext]);

  return null;
}
