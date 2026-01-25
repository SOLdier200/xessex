import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/signup", "/login", "/age"],
      },
    ],
    sitemap: "https://xessex.me/sitemap.xml",
    host: "https://xessex.me",
  };
}
