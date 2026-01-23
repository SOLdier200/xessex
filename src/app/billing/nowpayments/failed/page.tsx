"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

function FailedContent() {
  const sp = useSearchParams();
  const orderId = sp.get("order_id") || "";

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex justify-center mb-6">
        <Image
          src="/logos/mainsitelogo.png"
          alt="Xessex"
          width={180}
          height={60}
          priority
          className="h-14 w-auto"
        />
      </div>
      <h1 className="text-2xl font-semibold">Payment canceled or failed</h1>
      <p className="mt-2 text-sm opacity-80">
        No worries — you can try again. If you saw a wallet error, pick a
        different coin and retry.
      </p>

      <div className="mt-6 rounded-xl border p-4 text-sm">
        <span className="opacity-70">Order:</span> {orderId || "—"}
      </div>

      <a
        className="mt-6 inline-block rounded-lg bg-white/10 px-4 py-2"
        href="/signup"
      >
        Back to Membership
      </a>
    </div>
  );
}

export default function NowPaymentsFailedPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl p-6">Loading...</div>}>
      <FailedContent />
    </Suspense>
  );
}
