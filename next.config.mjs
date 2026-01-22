/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "pub-77b523433fb04971ba656a572f298a11.r2.dev" },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async redirects() {
    return [
      {
        source: "/membership",
        destination: "/signup",
        permanent: true,
      },
      {
        source: "/members",
        destination: "/signup",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
