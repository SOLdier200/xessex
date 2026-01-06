"use client";

import React from "react";
import type { StoreKey, ToyType, ToyUseCase } from "@/lib/toys/types";
import { STORE_LABELS } from "@/lib/toys/data";
import { TYPE_LABELS, USECASE_LABELS } from "@/lib/toys/utils";

type Filters = {
  types: Set<ToyType>;
  stores: Set<StoreKey>;
  useCases: Set<ToyUseCase>;
};

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
      <input
        type="checkbox"
        className="h-4 w-4 accent-white"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-zinc-200">{label}</span>
    </label>
  );
}

export function ToyFilters({
  filters,
  setFilters,
  onReset,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  onReset: () => void;
}) {
  function toggleInSet<T extends string>(set: Set<T>, key: T, on: boolean) {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  }

  const storeKeys = Object.keys(STORE_LABELS) as StoreKey[];
  const typeKeys = Object.keys(TYPE_LABELS) as ToyType[];
  const useKeys = Object.keys(USECASE_LABELS) as ToyUseCase[];

  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Filter</div>
          <div className="text-sm text-zinc-200">Curated picks only</div>
        </div>
        <button
          onClick={onReset}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-100 ring-1 ring-white/10 hover:bg-white/15"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Toy Type</div>
          <div className="mt-2 space-y-1">
            {typeKeys.map((k) => (
              <CheckboxRow
                key={k}
                label={TYPE_LABELS[k]}
                checked={filters.types.has(k)}
                onChange={(on) =>
                  setFilters({
                    ...filters,
                    types: toggleInSet(filters.types, k, on),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Store</div>
          <div className="mt-2 space-y-1">
            {storeKeys.map((k) => (
              <CheckboxRow
                key={k}
                label={STORE_LABELS[k]}
                checked={filters.stores.has(k)}
                onChange={(on) =>
                  setFilters({
                    ...filters,
                    stores: toggleInSet(filters.stores, k, on),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Use Case</div>
          <div className="mt-2 space-y-1">
            {useKeys.map((k) => (
              <CheckboxRow
                key={k}
                label={USECASE_LABELS[k]}
                checked={filters.useCases.has(k)}
                onChange={(on) =>
                  setFilters({
                    ...filters,
                    useCases: toggleInSet(filters.useCases, k, on),
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
