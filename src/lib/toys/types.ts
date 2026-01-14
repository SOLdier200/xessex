export type ToyType =
  | "vibrators"
  | "couples"
  | "anal"
  | "air_pulse"
  | "accessories";

export type ToyUseCase = "discreet" | "beginners" | "premium" | "couples";

export type StoreKey = "lovehoney" | "adameve" | "lelo" | "womanizer";

export type ToyProduct = {
  id: string;
  name: string;
  store: StoreKey;

  // categorization
  type: ToyType;
  useCases: ToyUseCase[];

  // display
  short: string; // 1-liner
  whyPicked: string; // editorial note
  rating: number; // ex: 4.8
  reviewCount?: number;

  // links
  buyUrl: string; // external link (affiliate ok)

  // optional
  imageUrl?: string; // keep neutral product images only
  priceNote?: string; // "Typically $99–$149"
};
