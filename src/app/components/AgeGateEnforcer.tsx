"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function safeGetStorage(getter: () => string | null) {
  try {
    return getter();
  } catch {
    return null;
  }
}

function safeCookieIncludes(needle: string) {
  try {
    return document.cookie.includes(needle);
  } catch {
    return false;
  }
}

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

    const redirectFlag = safeGetStorage(() => sessionStorage.getItem("age_ok_redirect"));
    const localOk = safeGetStorage(() => localStorage.getItem("age_ok_tab"));
    const sessionOk = safeGetStorage(() => sessionStorage.getItem("age_ok_tab"));
    const cookieOk = safeCookieIncludes("age_ok=1");

    const ok =
      redirectFlag === "1" ||
      localOk === "1" ||
      sessionOk === "1" ||
      cookieOk;

    if (ok) {
      try { sessionStorage.removeItem("age_ok_redirect"); } catch {}
      return;
    }

    const search = sp?.toString();
    const next = pathname + (search ? `?${search}` : "");
    router.replace(`/age?next=${encodeURIComponent(next)}`);
  }, [pathname, sp, router]);

  return null;
}
