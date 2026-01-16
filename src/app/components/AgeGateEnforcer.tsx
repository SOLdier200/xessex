"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAgeGateOk } from "@/lib/ageGateState";

export function AgeGateEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    // Allow search engine crawlers to access content without age gate
    const isBot = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex/i.test(
      navigator.userAgent
    );
    if (isBot) return;

    const ok = getAgeGateOk();

    if (pathname.startsWith("/age")) return;

    if (
      pathname.startsWith("/leave") ||
      pathname.startsWith("/parental-controls") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/2257") ||
      pathname.startsWith("/auth/callback") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/forgot-password")
    ) return;

    if (ok) return;

    const searchStr = sp?.toString();
    const redirectTo = pathname + (searchStr ? `?${searchStr}` : "");
    router.replace(`/age?next=${encodeURIComponent(redirectTo)}`);
  }, [pathname, sp, router]);

  return null;
}
