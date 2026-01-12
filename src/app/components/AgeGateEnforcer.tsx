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

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  if (nextValue.startsWith("/age")) return "/";
  return nextValue;
}

export function AgeGateEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const nextParam = safe.get(() => sp?.get("next"));
    const next = sanitizeNext(nextParam);

    const redirectOk = safe.get(() => sessionStorage.getItem("age_ok_redirect")) === "1";
    const localOk = safe.get(() => localStorage.getItem("age_ok_tab")) === "1";
    const sessionOk = safe.get(() => sessionStorage.getItem("age_ok_tab")) === "1";
    const ageOkCookie = safe.cookieIncludes("age_ok=1");
    const ageVerifiedCookie =
      safe.cookieIncludes("age_verified=true") || safe.cookieIncludes("age_verified=1");
    const ok = redirectOk || localOk || sessionOk || ageOkCookie || ageVerifiedCookie;

    if (pathname.startsWith("/age")) {
      if (ok) {
        router.replace(next || "/");
      }
      return;
    }

    if (
      pathname.startsWith("/leave") ||
      pathname.startsWith("/parental-controls") ||
      pathname.startsWith("/terms") ||
      pathname.startsWith("/auth/callback")
    ) return;

    if (ok) {
      if (!ageVerifiedCookie && (redirectOk || localOk || sessionOk || ageOkCookie)) {
        try {
          document.cookie = "age_verified=true; path=/; max-age=31536000; samesite=lax";
        } catch {}
      }
      safe.removeRedirectFlag();
      return;
    }

    const searchStr = sp?.toString();
    const redirectTo = pathname + (searchStr ? `?${searchStr}` : "");
    router.replace(`/age?next=${encodeURIComponent(redirectTo)}`);
  }, [pathname, sp, router]);

  return null;
}
