"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

function PartialContent() {
  const sp = useSearchParams();
  const orderId = sp.get("order_id") || "";

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex justify-center mb-6">
        <Image
          src="/logos/neonmainlogo1.png"
          alt="Xessex"
          width={180}
          height={60}
          priority
          className="h-14 w-auto"
        />
      </div>
      <h1 className="text-2xl font-semibold">Partial payment received</h1>
      <p className="mt-2 text-sm opacity-80">
        We received an underpayment for this invoice. This usually happens when
        the sender pays less than the required amount after fees or rate
        changes.
      </p>

      <div className="mt-6 rounded-xl border p-4 text-sm">
        <span className="opacity-70">Order:</span> {orderId || "—"}
      </div>

      <div className="mt-6 text-sm opacity-80">
        Please contact support with your transaction hash + this Order ID so we
        can fix it quickly.
      </div>

      <a
        className="mt-6 inline-block rounded-lg bg-white/10 px-4 py-2"
        href="/signup"
      >
        Start a new payment
      </a>
    </div>
  );
}

export default function NowPaymentsPartialPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl p-6">Loading...</div>}>
      <PartialContent />
    </Suspense>
  );
}
