import { MetadataRoute } from "next";

/**
 * Sitemap Index - points to sub-sitemaps
 * Yandex prefers split sitemaps for large sites
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://xessex.me";
  const now = new Date();

  return [
    { url: `${base}/sitemap-pages.xml`, lastModified: now },
    { url: `${base}/sitemap-videos.xml`, lastModified: now },
    { url: `${base}/sitemap-collections.xml`, lastModified: now },
  ];
}
