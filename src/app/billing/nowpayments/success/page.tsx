"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type StatusResp =
  | { ok: false; error: string }
  | {
      ok: true;
      status: string;
      tier: string;
      expiresAt: string;
      nowPaymentsInvoiceId: string | null;
      nowPaymentsPaymentId: string | null;
    };

function SuccessContent() {
  const sp = useSearchParams();
  const orderId = useMemo(() => sp.get("order_id") || "", [sp]);

  const [data, setData] = useState<StatusResp | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let stop = false;

    async function poll() {
      while (!stop) {
        const res = await fetch(
          `/api/billing/nowpayments/status?order_id=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => null)) as StatusResp | null;
        if (json) setData(json);

        // Stop polling once it becomes ACTIVE
        if (json && "ok" in json && json.ok && json.status === "ACTIVE") break;

        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    poll();
    return () => {
      stop = true;
    };
  }, [orderId]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Payment received</h1>
      <p className="mt-2 text-sm opacity-80">
        We're confirming your payment now. You should have access immediately
        (provisional), then it locks in once the network confirms.
      </p>

      <div className="mt-6 rounded-xl border p-4">
        <div className="text-sm">
          <div>
            <span className="opacity-70">Order:</span> {orderId || "—"}
          </div>
          <div className="mt-2">
            <span className="opacity-70">Status:</span>{" "}
            {data ? (data.ok ? data.status : data.error) : "Checking..."}
          </div>
          {data && data.ok && (
            <div className="mt-2">
              <span className="opacity-70">Access until:</span>{" "}
              {new Date(data.expiresAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <a
        className="mt-6 inline-block rounded-lg bg-white/10 px-4 py-2"
        href="/content"
      >
        Enter Xessex
      </a>
    </div>
  );
}

export default function NowPaymentsSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl p-6">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
