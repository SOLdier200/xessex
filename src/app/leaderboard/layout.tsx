import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Earners – Crypto Rewards Leaderboard",
  description:
    "See top users earning crypto rewards for watching videos. Updated daily based on activity.",
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    type: "website",
    url: "https://xessex.me/leaderboard",
    title: "Top Earners – Crypto Rewards Leaderboard",
    description:
      "See top users earning crypto rewards for watching videos. Updated daily based on activity.",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
