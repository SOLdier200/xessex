"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AgeGateEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    // Don't enforce on the gate itself, leave page, legal pages, or auth callback
    if (
      pathname.startsWith("/age") ||
      pathname.startsWith("/leave") ||
      pathname.startsWith("/parental-controls") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/auth/callback")
    ) return;

    // Check all storage methods (bulletproof for mobile)
    const ok =
      localStorage.getItem("age_ok_tab") === "1" ||
      sessionStorage.getItem("age_ok_tab") === "1" ||
      document.cookie.includes("age_ok=1");
    if (ok) return;

    // Redirect to age gate with return URL
    const search = sp?.toString();
    const next = pathname + (search ? `?${search}` : "");
    router.replace(`/age?next=${encodeURIComponent(next)}`);
  }, [pathname, sp, router]);

  return null;
}
