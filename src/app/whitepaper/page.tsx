import Link from "next/link";

export const metadata = {
  title: "Whitepaper | Xessex",
  description: "Read the official XESS whitepaper",
};

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          XESS Whitepaper
        </h1>

        <p className="text-white/60 mb-8">
          The official documentation for the XESS token and Xessex platform.
        </p>

        <div className="space-y-8">
          <section className="bg-gray-900/50 border border-blue-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-blue-300">Abstract</h2>
            <p className="text-white/70 leading-relaxed">
              XESS is a utility token built on Solana that powers the Xessex ecosystem.
              The token is designed to reward community engagement, incentivize quality content creation,
              and provide value to platform participants through weekly distributions and referral programs.
            </p>
          </section>

          <section className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-purple-300">Vision</h2>
            <p className="text-white/70 leading-relaxed">
              Our vision is to create a sustainable ecosystem where users are rewarded for their
              contributions and engagement. The XESS token serves as the foundation for this
              reward-based economy.
            </p>
          </section>

          <section className="bg-gray-900/50 border border-cyan-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Full Document</h2>
            <p className="text-white/70 mb-4">
              The complete whitepaper is currently being finalized. Check back soon for the full document.
            </p>
            <button
              disabled
              className="px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-semibold opacity-50 cursor-not-allowed"
            >
              Download PDF (Coming Soon)
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
