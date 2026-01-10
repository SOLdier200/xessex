"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const safe = {
  get(getter: () => string | null) {
    try { return getter(); } catch { return null; }
  },
  cookieIncludes(s: string) {
    try { return document.cookie.includes(s); } catch { return false; }
  },
  removeRedirectFlag() {
    try { sessionStorage.removeItem("age_ok_redirect"); } catch {}
  },
};

export function AgeGateEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (
      pathname.startsWith("/age") ||
      pathname.startsWith("/leave") ||
      pathname.startsWith("/parental-controls") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/auth/callback")
    ) return;

    const ok =
      safe.get(() => sessionStorage.getItem("age_ok_redirect")) === "1" ||
      safe.get(() => localStorage.getItem("age_ok_tab")) === "1" ||
      safe.get(() => sessionStorage.getItem("age_ok_tab")) === "1" ||
      safe.cookieIncludes("age_ok=1");

    if (ok) {
      safe.removeRedirectFlag();
      return;
    }

    const search = sp?.toString();
    const next = pathname + (search ? `?${search}` : "");
    router.replace(`/age?next=${encodeURIComponent(next)}`);
  }, [pathname, sp, router]);

  return null;
}
