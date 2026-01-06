"use client";

import React, { useMemo, useState } from "react";
import { TOYS } from "@/lib/toys/data";
import type { StoreKey, ToyProduct, ToyType, ToyUseCase } from "@/lib/toys/types";
import { groupByStore, storeTitle, getCurationWarning } from "@/lib/toys/utils";
import { ToyFilters } from "@/components/toys/ToyFilters";
import { ToyCard } from "@/components/toys/ToyCard";
import { ToyModal } from "@/components/toys/ToyModal";

type Filters = {
  types: Set<ToyType>;
  stores: Set<StoreKey>;
  useCases: Set<ToyUseCase>;
};

const DEFAULT_FILTERS: Filters = {
  types: new Set(),
  stores: new Set(),
  useCases: new Set(),
};

export default function ToysPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<ToyProduct | null>(null);

  // Log curation warning once
  useMemo(() => {
    const warning = getCurationWarning();
    if (warning) console.warn(warning);
  }, []);

  const filtered = useMemo(() => {
    return TOYS.filter((p) => {
      if (filters.types.size > 0 && !filters.types.has(p.type)) return false;
      if (filters.stores.size > 0 && !filters.stores.has(p.store)) return false;
      if (
        filters.useCases.size > 0 &&
        !p.useCases.some((uc) => filters.useCases.has(uc))
      )
        return false;
      return true;
    });
  }, [filters]);

  const grouped = useMemo(() => groupByStore(filtered), [filtered]);

  const totalSelectedFilters =
    filters.types.size + filters.stores.size + filters.useCases.size;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-50">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Curated Toys</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Top-rated picks from leading adult stores. Minimalist, discreet, editorial-only.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-8">
          <ToyFilters
            filters={filters}
            setFilters={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
        </div>

        {/* Count */}
        <div className="mb-6 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-sm text-zinc-300">
            Showing <span className="font-semibold text-zinc-50">{filtered.length}</span>{" "}
            curated items{totalSelectedFilters > 0 ? " (filtered)" : ""}.
          </div>
          <div className="text-xs text-zinc-500">
            We avoid explicit imagery and keep descriptions editorial.
          </div>
        </div>

        {/* Store sections */}
        <div className="mt-8 space-y-10">
          {(Object.keys(grouped) as StoreKey[])
            .sort((a, b) => storeTitle(a).localeCompare(storeTitle(b)))
            .map((store) => {
              const items = grouped[store] ?? [];
              if (items.length === 0) return null;

              return (
                <section key={store} className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{storeTitle(store)}</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Top rated picks (curated).
                      </p>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {items.map((p) => (
                      <ToyCard key={p.id} product={p} onView={setSelected} />
                    ))}
                  </div>
                </section>
              );
            })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10">
              <div className="text-lg font-semibold">No matches</div>
              <div className="mt-2 text-sm text-zinc-400">
                Try resetting filters to see the full curated list.
              </div>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-zinc-500">
          Links may be affiliate/referral links. Picks are curated and may change over time.
        </div>
      </div>

      <ToyModal open={!!selected} product={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
