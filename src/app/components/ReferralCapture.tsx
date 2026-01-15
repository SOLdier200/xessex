"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Captures ?ref= query parameter and stores in localStorage
 * Include this component on signup/landing pages to track referrals
 */
export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("ref_code", ref);
    }
  }, [searchParams]);

  return null;
}
