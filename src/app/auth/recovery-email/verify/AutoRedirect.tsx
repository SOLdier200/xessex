"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRedirect({
  to,
  delayMs = 2000,
  enabled = true,
}: {
  to: string;
  delayMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => router.push(to), delayMs);
    return () => clearTimeout(t);
  }, [to, delayMs, enabled, router]);

  return null;
}
