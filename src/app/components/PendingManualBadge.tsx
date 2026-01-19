"use client";

import { useEffect, useState } from "react";

export default function PendingManualBadge() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/me/is-admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/manual-payments/count?status=PENDING", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(Number(data.count || 0));
      } catch {
        // ignore
      }
    }

    load();
    const t = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAdmin]);

  if (!isAdmin || !count) return null;

  return (
    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 rounded-full bg-red-500/80 text-white text-xs font-bold">
      {count}
    </span>
  );
}
