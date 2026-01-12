"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
  const router = useRouter();
  const safeNext = sanitizeNext(next);

  useEffect(() => {
    try {
      const secure = window.location.protocol === "https:";
      const cookieSuffix = `path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure ? "; secure" : ""}`;

      document.cookie = `age_ok=1; ${cookieSuffix}`;
      document.cookie = `age_verified=true; ${cookieSuffix}`;

      localStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_tab", "1");
      sessionStorage.setItem("age_ok_redirect", "1");
    } catch {
      // ignore storage errors
    }

    router.replace(safeNext || "/");
  }, [safeNext, router]);

  return null;
}
