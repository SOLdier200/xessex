import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Earn Crypto Watching Porn – Adult Rewards Platform",
  description:
    "Earn crypto by watching adult videos. Xessex rewards real users weekly for viewing verified content.",
  alternates: {
    canonical: "/earn-crypto-watching-porn",
  },
  openGraph: {
    type: "website",
    url: "https://xessex.me/earn-crypto-watching-porn",
    title: "Earn Crypto Watching Porn – Adult Rewards Platform",
    description:
      "Earn crypto by watching adult videos. Xessex rewards real users weekly for viewing verified content.",
  },
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

          <p className="mt-4 text-xl md:text-2xl font-semibold text-pink-400 italic">
            &ldquo;You used to think a porn addiction was unhealthy, but here at Xessex it&apos;ll make you wealthy!&rdquo;
          </p>

          <p className="mt-4 text-white/80">
            If you&apos;re tired of trying to watch adult content and having to go through a dozen videos
            to find one decent one, you&apos;ve found your new source for porn! We are literally made to
            solve that problem. All our videos are great quality, and on top of that we have a{" "}
            <span className="text-pink-400 font-semibold">Ranking system that pays YOU</span> for your
            valuable opinions. Unlock more videos with the credits you earn and help us build a legendary
            organized porn list where we aim to discover the hottest video on the web!
          </p>

          <p className="mt-4 text-white/70">
            Xessex is a next-generation adult platform where you can earn crypto by watching porn.
            Instead of just consuming content, users earn real digital rewards for watching
            premium HD adult videos, engaging with creators, and participating in the community.
          </p>
          <p className="mt-4 text-white/70">
            This is not a gimmick. Xessex is built on Solana, one of the fastest blockchains in the
            world, allowing instant, low-fee payouts in XESS tokens simply for
            watching videos and interacting with content.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            How Earning Crypto for Watching Porn Works
          </h2>
          <p className="mt-4 text-white/70">
            Most adult sites take your time and give nothing back. Xessex flips that model.
          </p>
          <p className="mt-4 text-white/70">
            When you watch premium content on Xessex, your activity contributes to a reward system
            that distributes tokens to active users. The more you engage - watching, voting,
            ranking, and supporting creators - the more you earn.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 list-disc list-inside">
            <li>Earn crypto watching adult videos</li>
            <li>Receive XESS token rewards for engagement on the site from ranking videos, liking comments, making comments, referrals, liquidity pools, rewards for holding XESS tokens, and more</li>
            <li>Hold XESS tokens to earn Special Credit rewards which can be used for video unlocks and weekly drawings</li>
            <li>Get paid for time spent watching content</li>
          </ul>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            High-Quality HD Adult Videos Only
          </h2>
          <p className="mt-4 text-white/70">
            Xessex is focused on quality, not quantity. Every video is curated and optimized for a
            fast, private streaming experience.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 list-disc list-inside">
            <li>HD or higher resolution</li>
            <li>Verified and curated content</li>
            <li>Ranked by real users</li>
            <li>Optimized for fast, private streaming</li>
            <li>Available only to registered users</li>
          </ul>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Earn XESS Tokens
          </h2>
          <p className="mt-4 text-white/70">
            Xessex runs on its own crypto reward system. When you watch videos or engage on the
            platform, you earn:
          </p>
          <ul className="mt-4 space-y-2 text-white/70 list-disc list-inside">
            <li>XESS Coin - the main reward token</li>
            <li>Activity-based bonuses</li>
          </ul>
          <p className="mt-4 text-white/70">
            Special Credits are distributed automatically based on how much XESS your wallet is holding during the daily snapshot.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Powered by Solana: Fast, Private, Low Fees
          </h2>
          <p className="mt-4 text-white/70">
            Xessex uses Solana blockchain technology to make crypto rewards fast and affordable.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 list-disc list-inside">
            <li>Weekly reward payouts</li>
            <li>No high gas fees</li>
            <li>Private wallet-based access</li>
            <li>Secure transactions</li>
            <li>Global accessibility</li>
          </ul>
          <p className="mt-4 text-white/70">
            Unlike traditional adult platforms that rely on banks or credit cards, Xessex gives you
            full control over your rewards and payments.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Get Paid to Watch Porn - Not Just Click Ads
          </h2>
          <p className="mt-4 text-white/70">
            Most sites monetize you with ads, popups, trackers, and spam. Xessex pays you directly.
            By watching videos, ranking content, and participating, you are part of a system where
            value flows back to the users instead of being extracted from them.
          </p>
          <p className="mt-4 text-white/70">
            This makes Xessex ideal for people searching for earn crypto watching porn, get paid to
            watch adult videos, crypto porn rewards, and Solana adult platform opportunities.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Safe, Private, and Secure
          </h2>
          <p className="mt-4 text-white/70">
            Xessex is age-restricted and RTA compliant. Wallet-based access options and encrypted sessions help you stay in control
            while earning rewards and accessing premium content.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Why Xessex Ranks Best for Crypto Adult Rewards
          </h2>
          <p className="mt-4 text-white/70">
            Xessex is a full platform built around quality content and real rewards. You get
            top-ranked videos, premium HD content, Solana-based payments, and ownership of the
            rewards you earn.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Weekly Reward Drawing &amp; Special Credits (Coming Soon)
          </h2>
          <p className="mt-4 text-white/70">
            Hold XESS tokens in your linked wallet and earn daily Special Credits automatically.
            The more you hold, the more credits you earn — no claiming required, they just appear
            in your account. Use Special Credits to enter our weekly reward drawing for a chance to win
            big prizes from the community pot, boosted by system matching and rollover jackpots
            from unclaimed prizes.
          </p>
          <p className="mt-4 text-white/70">
            Enter the weekly <strong className="text-pink-400">Special Credits Reward Drawing</strong> (1 credit = 1 ticket).
            Prize pools are funded by ticket purchases plus a 1:1 system match, with unclaimed prizes
            rolling over to create growing jackpots. Winners take 1st place (50%), 2nd place (30%),
            and 3rd place (20%) — but you must claim your prize before the next draw or it rolls
            into the next week&apos;s pot!
          </p>
          <p className="mt-4 text-white/70">
            Special Credit rewards are based on your XESS holdings — hold at least
            10,000 XESS to start earning. Higher tiers unlock more monthly credits, up to 16,000 credits
            per month for holders of 5 million+ XESS.
          </p>

          <h2 className="mt-8 text-2xl font-semibold text-white">
            Start Earning Crypto Watching Porn Today
          </h2>
          <p className="mt-4 text-white/70">
            Joining Xessex takes minutes. Watching videos earns rewards immediately. No complicated
            setup. Just create your account, watch premium content, and earn XESS token
            rewards.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login/diamond"
              className="rounded-xl border border-pink-400/50 bg-black px-6 py-4 font-bold text-pink-400 hover:bg-pink-500/10 transition"
            >
              Start Earning Rewards
            </Link>
            <Link
              href="/rewards"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-4 font-semibold text-white hover:bg-white/20 transition"
            >
              View Rewards Program
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
