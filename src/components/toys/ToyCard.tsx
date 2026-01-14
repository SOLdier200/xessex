"use client";

import type { ToyProduct } from "@/lib/toys/types";

function Stars({ rating }: { rating: number }) {
  // Simple 5-star display (no icons)
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-300">
      {"★".repeat(full)}
      {half ? "☆" : ""}
      {"☆".repeat(empty)}
      <span className="ml-2 text-zinc-400">{rating.toFixed(1)}</span>
    </div>
  );
}

export function ToyCard({
  product,
  onView,
}: {
  product: ToyProduct;
  onView: (p: ToyProduct) => void;
}) {
  return (
    <div className="group rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 hover:bg-white/7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-50">{product.name}</div>
          <div className="mt-1 text-sm text-zinc-300">{product.short}</div>
          <div className="mt-2">
            <Stars rating={product.rating} />
          </div>
        </div>
        {product.imageUrl ? (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10">
            {/* Keep images neutral only */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 text-xs text-zinc-400">{product.whyPicked}</div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onView(product)}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-100 ring-1 ring-white/10 hover:bg-white/15"
        >
          View
        </button>
        <a
          href={product.buyUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
        >
          Buy
        </a>
      </div>
    </div>
  );
}
