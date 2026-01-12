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

    const redirectOk = safe.get(() => sessionStorage.getItem("age_ok_redirect")) === "1";
    const localOk = safe.get(() => localStorage.getItem("age_ok_tab")) === "1";
    const sessionOk = safe.get(() => sessionStorage.getItem("age_ok_tab")) === "1";
    const ageOkCookie = safe.cookieIncludes("age_ok=1");
    const ageVerifiedCookie =
      safe.cookieIncludes("age_verified=true") || safe.cookieIncludes("age_verified=1");
    const ok = redirectOk || localOk || sessionOk || ageOkCookie || ageVerifiedCookie;

    if (ok) {
      if (!ageVerifiedCookie && (redirectOk || localOk || sessionOk || ageOkCookie)) {
        try {
          document.cookie = "age_verified=true; path=/; max-age=31536000; samesite=lax";
        } catch {}
      }
      safe.removeRedirectFlag();
      return;
    }

    const search = sp?.toString();
    const next = pathname + (search ? `?${search}` : "");
    router.replace(`/age?next=${encodeURIComponent(next)}`);
  }, [pathname, sp, router]);

  return null;
}
