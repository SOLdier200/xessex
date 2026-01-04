import Link from "next/link";
import TopNav from "../components/TopNav";

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Back to Home
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold neon-text">Choose Your Membership</h1>
          <p className="mt-2 text-white/70">Select the plan that's right for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Member Tier */}
          <div className="neon-border rounded-2xl p-6 bg-black/30 border-sky-400/30 flex flex-col">
            <div className="text-center">
              <span className="text-4xl">⭐</span>
              <h2 className="mt-3 text-2xl font-bold text-sky-400">Member</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">$3</span>
                <span className="text-white/60">/month</span>
              </div>
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                Full access to all videos
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                HD streaming quality
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                Save favorites
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                No ads
              </li>
              <li className="flex items-center gap-2 text-white/50">
                <span className="text-red-400">✗</span>
                Earn to Watch (not included)
              </li>
            </ul>

            <button className="mt-6 w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition">
              Become a Member
            </button>
          </div>

          {/* Diamond Member Tier */}
          <div className="neon-border rounded-2xl p-6 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 border-yellow-400/50 flex flex-col relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
              BEST VALUE
            </div>

            <div className="text-center">
              <span className="text-4xl">💎</span>
              <h2 className="mt-3 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-400">
                Diamond Member
              </h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">$19.99</span>
                <span className="text-white/60">/month</span>
              </div>
            </div>

            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                Full access to all videos
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                4K streaming quality
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                Save favorites
              </li>
              <li className="flex items-center gap-2 text-white/80">
                <span className="text-emerald-400">✓</span>
                No ads
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">✓</span>
                <span className="text-yellow-400 font-semibold">Earn <span className="text-green-400">$</span> for rating videos</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">✓</span>
                <span className="text-yellow-400 font-semibold">Diamond Ladder rankings</span>
              </li>
              <li className="flex items-center gap-2 text-white">
                <span className="text-yellow-400">✓</span>
                <span className="text-yellow-400 font-semibold">Exclusive Diamond badge</span>
              </li>
            </ul>

            <button className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-purple-500 text-black font-bold hover:from-yellow-400 hover:to-purple-400 transition shadow-[0_0_20px_rgba(234,179,8,0.3)]">
              Become a Diamond Member
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-white/50 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-400 hover:underline">
            Connect your wallet
          </Link>
        </p>
      </div>
    </main>
  );
}
