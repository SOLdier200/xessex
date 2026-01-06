import { STORE_LABELS, TOYS } from "./data";
import { StoreKey, ToyProduct, ToyType, ToyUseCase } from "./types";

export const TYPE_LABELS: Record<ToyType, string> = {
  vibrators: "Vibrators",
  couples: "Couples",
  anal: "Anal",
  air_pulse: "Air Pulse",
  accessories: "Accessories",
};

export const USECASE_LABELS: Record<ToyUseCase, string> = {
  discreet: "Discreet",
  beginners: "Beginners",
  premium: "Premium",
  couples: "Couples",
};

export function groupByStore(items: ToyProduct[]): Record<StoreKey, ToyProduct[]> {
  return items.reduce((acc, p) => {
    (acc[p.store] ||= []).push(p);
    return acc;
  }, {} as Record<StoreKey, ToyProduct[]>);
}

export function storeTitle(store: StoreKey): string {
  return STORE_LABELS[store] ?? store;
}

export function ensureTop3PerStore(items: ToyProduct[]): boolean {
  const grouped = groupByStore(items);
  return (Object.keys(grouped) as StoreKey[]).every((s) => grouped[s].length === 3);
}

// Optional sanity check (won't throw, just returns message you could log)
export function getCurationWarning(): string | null {
  if (!ensureTop3PerStore(TOYS)) {
    return "Curation rule violated: each store must have exactly 3 items.";
  }
  return null;
}
