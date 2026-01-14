"use client";

import React, { useEffect } from "react";
import type { ToyProduct } from "@/lib/toys/types";

export function ToyModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ToyProduct | null;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Close modal overlay"
      />
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 text-zinc-50 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">
              Editor Pick
            </div>
            <h2 className="mt-1 text-xl font-semibold">{product.name}</h2>
            <p className="mt-1 text-sm text-zinc-300">{product.short}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs uppercase tracking-widest text-zinc-400">
                Why we picked it
              </div>
              <p className="mt-2 text-sm text-zinc-200">{product.whyPicked}</p>
            </div>

            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs uppercase tracking-widest text-zinc-400">
                Rating
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold">{product.rating.toFixed(1)}</div>
                <div className="text-xs text-zinc-400">
                  {product.reviewCount ? `${product.reviewCount.toLocaleString()} reviews` : ""}
                </div>
              </div>
              {product.priceNote ? (
                <div className="mt-2 text-xs text-zinc-400">{product.priceNote}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <a
              href={product.buyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
            >
              Buy on Store
            </a>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm text-zinc-100 ring-1 ring-white/10 hover:bg-white/15"
            >
              Back
            </button>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Note: Links may be affiliate/referral links. We only list curated picks.
          </p>
        </div>
      </div>
    </div>
  );
}
