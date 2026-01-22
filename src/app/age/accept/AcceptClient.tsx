"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAgeGateOk } from "@/lib/ageGateState";

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
    setAgeGateOk(true);
    router.replace(safeNext || "/");
  }, [safeNext, router]);

  return null;
}
