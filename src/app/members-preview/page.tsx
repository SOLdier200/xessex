import Link from "next/link";
import TopNav from "../components/TopNav";

export const metadata = {
  robots: { index: false, follow: true },
  title: "Members Area - Xessex",
  description: "Exclusive content for Xessex members. Sign up to access premium features.",
};

export default function MembersPreviewPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="px-4 md:px-6 pb-10">
        <div className="max-w-2xl mx-auto">
          <section className="neon-border rounded-2xl p-6 md:p-8 bg-black/30">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Members Area
            </h1>
            <p className="text-white/70 mb-6">
              This content is available to logged-in members. Sign in or create an account to access exclusive features, premium videos, and more.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login/diamond"
                className="px-6 py-3 rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-100 font-semibold hover:bg-pink-500/30 transition"
              >
                Connect Wallet
              </Link>
            </div>
          </section>

          <section className="mt-6 neon-border rounded-2xl p-6 bg-black/30">
            <h2 className="text-lg font-semibold text-white mb-3">
              Member Benefits
            </h2>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>Access to the full video catalog</li>
              <li>Rate and comment on videos</li>
              <li>Earn rewards for your engagement</li>
              <li>Join the Diamond Ladder rankings</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
