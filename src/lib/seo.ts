/**
 * Yandex-optimized SEO helpers
 *
 * Rules:
 * - 50-60 char titles, keyword first
 * - 140-160 char descriptions
 * - No emojis, no pipes
 * - Literal phrases preferred
 */

export function yandexMeta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const BASE_URL = "https://xessex.me";

// Hardcoded collection slugs for sitemap (must match CATEGORY_INFO in collections pages)
export const COLLECTION_SLUGS = [
  "blonde",
  "brunette",
  "blowjob",
  "threesome",
  "anal",
  "asian",
  "2d",
  "highest-rated",
];
