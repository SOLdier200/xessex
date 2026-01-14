import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://xessex.com";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/collections`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/videos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/stars`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/membership`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/parental-controls`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
