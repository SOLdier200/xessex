"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAgeGateOk } from "@/lib/ageGateState";

export function AgeGateEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const ok = getAgeGateOk();

    if (pathname.startsWith("/age")) return;

    if (
      pathname.startsWith("/leave") ||
      pathname.startsWith("/parental-controls") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/auth/callback")
    ) return;

    if (ok) return;

    const searchStr = sp?.toString();
    const redirectTo = pathname + (searchStr ? `?${searchStr}` : "");
    router.replace(`/age?next=${encodeURIComponent(redirectTo)}`);
  }, [pathname, sp, router]);

  return null;
}
