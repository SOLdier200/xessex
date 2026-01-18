import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import TopNav from "../components/TopNav";

const pageTitle = "Earn Crypto Watching Porn | Get Paid to Watch Videos on Xessex";
const pageDescription =
  "Earn crypto watching porn on Xessex. Watch premium HD adult videos and get paid in XESS tokens and Solana rewards on a crypto-powered adult platform.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/earn-crypto-watching-porn",
  },
  keywords: [
    "earn crypto watching porn",
    "get paid to watch porn",
    "earn tokens watching adult videos",
    "adult crypto rewards",
    "porn rewards",
    "solana adult platform",
    "xess token",
  ],
};

export default function EarnCryptoWatchingPornPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Earn Crypto Watching Porn",
    description: "Watch premium adult videos and earn crypto rewards on Xessex.",
    keywords: [
      "earn crypto watching porn",
      "get paid to watch porn",
      "adult crypto rewards",
      "porn token",
      "solana adult platform",
    ],
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: 18,
    },
    isFamilyFriendly: false,
  };

  return (
    <main className="min-h-screen">
      <TopNav />
      <Script
        id="earn-crypto-jsonld"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-5 py-10">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-white">
            Earn Crypto Watching Porn
          </h1>
          <p className="mt-4 text-white/70">
            Xessex is the adult platform where you can earn crypto for watching porn and
            supporting premium content. Members earn XESS rewards by watching, grading, and
            engaging with curated HD adult videos.
          </p>
          <p className="mt-4 text-white/70">
            Unlike traditional adult sites, Xessex rewards viewers with real crypto powered by
            Solana. Every watch, vote, and interaction contributes to your rewards balance.
          </p>
          <p className="mt-4 text-white/70">
            If you want to get paid to watch porn and access top-ranked XXX videos, Xessex combines
            premium adult entertainment with a modern, reward-driven experience.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-pink-500 px-5 py-3 font-semibold text-black hover:bg-pink-400 transition"
            >
              Start Earning Rewards
            </Link>
            <Link
              href="/rewards"
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-semibold text-white/80 hover:bg-white/10 transition"
            >
              View Rewards Program
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-sm text-white/60">Step 1</div>
              <div className="mt-1 font-semibold text-white">Watch curated HD content</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-sm text-white/60">Step 2</div>
              <div className="mt-1 font-semibold text-white">Grade and engage</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-sm text-white/60">Step 3</div>
              <div className="mt-1 font-semibold text-white">Earn XESS rewards</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
