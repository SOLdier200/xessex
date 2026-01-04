import Link from "next/link";
import TopNav from "../components/TopNav";

// Placeholder data - will be replaced with real user data
const LEADERBOARD_DATA = [
  { rank: 1, username: "DiamondKing", points: 12450, videosRated: 847, badge: "👑" },
  { rank: 2, username: "ContentMaster", points: 11200, videosRated: 723, badge: "💎" },
  { rank: 3, username: "RatingPro", points: 9875, videosRated: 651, badge: "💎" },
  { rank: 4, username: "VideoExpert", points: 8340, videosRated: 589, badge: "🌟" },
  { rank: 5, username: "CuratorElite", points: 7650, videosRated: 512, badge: "🌟" },
  { rank: 6, username: "GradeAce", points: 6890, videosRated: 478, badge: "🌟" },
  { rank: 7, username: "DiamondRater", points: 5420, videosRated: 398, badge: "⭐" },
  { rank: 8, username: "ContentGuru", points: 4870, videosRated: 356, badge: "⭐" },
  { rank: 9, username: "RankMaster", points: 4210, videosRated: 312, badge: "⭐" },
  { rank: 10, username: "VideoJudge", points: 3650, videosRated: 267, badge: "⭐" },
];

function getRankStyle(rank: number): string {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/30 to-yellow-600/20 border-yellow-400/50";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/30 to-gray-500/20 border-gray-300/50";
  if (rank === 3) return "bg-gradient-to-r from-amber-600/30 to-amber-700/20 border-amber-500/50";
  return "bg-black/30 border-white/10";
}

function getRankTextStyle(rank: number): string {
  if (rank === 1) return "text-yellow-400 font-bold";
  if (rank === 2) return "text-gray-300 font-bold";
  if (rank === 3) return "text-amber-500 font-bold";
  return "text-white/70";
}

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Home
        </Link>

        {/* Header */}
        <section className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-5xl">💎</span>
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Diamond Ladder
              </h1>
              <p className="mt-1 text-white/70">
                Top ranked Diamond Members earning rewards for rating content
              </p>
            </div>
          </div>
        </section>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="neon-border rounded-xl p-4 bg-black/30 text-center">
            <div className="text-3xl font-bold text-purple-400">10,247</div>
            <div className="text-sm text-white/60">Total Diamond Members</div>
          </div>
          <div className="neon-border rounded-xl p-4 bg-black/30 text-center">
            <div className="text-3xl font-bold text-green-400">$24,580</div>
            <div className="text-sm text-white/60">Total Rewards Paid</div>
          </div>
          <div className="neon-border rounded-xl p-4 bg-black/30 text-center">
            <div className="text-3xl font-bold text-pink-400">156,892</div>
            <div className="text-sm text-white/60">Videos Rated This Week</div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <section className="neon-border rounded-2xl bg-black/30 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Top 10 This Week</h2>
          </div>

          <div className="divide-y divide-white/5">
            {LEADERBOARD_DATA.map((user) => (
              <div
                key={user.rank}
                className={`flex items-center gap-4 p-4 ${getRankStyle(user.rank)} border-l-4 transition hover:bg-white/5`}
              >
                {/* Rank */}
                <div className={`w-10 text-2xl font-bold text-center ${getRankTextStyle(user.rank)}`}>
                  {user.rank}
                </div>

                {/* Badge */}
                <div className="text-2xl">{user.badge}</div>

                {/* Username */}
                <div className="flex-1">
                  <div className="font-semibold text-white">{user.username}</div>
                  <div className="text-xs text-white/50">{user.videosRated} videos rated</div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className="font-bold text-purple-400">{user.points.toLocaleString()}</div>
                  <div className="text-xs text-white/50">points</div>
                </div>

                {/* Earnings Estimate */}
                <div className="text-right w-24">
                  <div className="font-bold text-green-400">${(user.points * 0.01).toFixed(2)}</div>
                  <div className="text-xs text-white/50">earned</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="mt-6 neon-border rounded-2xl p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-center">
          <h3 className="text-xl font-bold text-white">Want to climb the Diamond Ladder?</h3>
          <p className="mt-2 text-white/70">
            Register as a Diamond Member and start earning <span className="text-green-400 font-bold">$</span> for rating content!
          </p>
          <Link
            href="/signup"
            className="inline-block mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition"
          >
            Become a Diamond Member
          </Link>
        </section>
      </div>
    </main>
  );
}
