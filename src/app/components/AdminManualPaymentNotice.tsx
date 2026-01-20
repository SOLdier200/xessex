"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminManualPaymentNotice() {
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

  if (!isAdmin || count <= 0) return null;

  return (
    <div className="mb-4">
      <Link
        href="/admin/controls"
        className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-emerald-100 hover:bg-emerald-500/20 transition"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/30 animate-pulse">
          <svg
            className="h-4 w-4 text-emerald-50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </span>
        <span className="text-sm font-semibold">
          Manual payments waiting for review ({count})
        </span>
      </Link>
    </div>
  );
}
