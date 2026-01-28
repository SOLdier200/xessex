import Link from "next/link";
import Image from "next/image";
import VerifyTokenClient from "./VerifyTokenClient";

export const metadata = {
  title: "Verify XESS Token | Xessex",
  description:
    "Verify the official XESS token mint and on-chain details on Solana mainnet. Learn how to avoid scams and confirm authenticity.",
};

export default function VerifyTokenPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[80px] w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Verify the Official XESS Token
          </h1>
          <p className="mt-3 text-white/70">
            This page helps you confirm you&apos;re viewing the real XESS token on Solana mainnet.
            If the mint address doesn&apos;t match, it&apos;s not XESS.
          </p>
        </div>

        <div className="mt-6">
          <VerifyTokenClient />
        </div>

        {/* How to Verify */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <h2 className="text-2xl font-semibold">How to Verify</h2>
          <ol className="mt-4 space-y-3 text-white/75 list-decimal pl-5">
            <li>
              Copy the mint address above using the Copy button.
            </li>
            <li>
              Open a trusted explorer (Solscan / SolanaFM / Solana Explorer) and paste the mint.
            </li>
            <li>
              Confirm the mint address matches exactly and the token metadata looks consistent.
            </li>
            <li>
              If a token claims to be XESS but has a different mint address, it is not official.
            </li>
          </ol>
        </div>

        {/* Anti-scam */}
        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Avoid Scams</h2>
          <ul className="mt-4 space-y-3 text-red-50/80 list-disc pl-5">
            <li>Never trust screenshots. Always verify the mint address on-chain.</li>
            <li>Ignore DMs claiming &quot;airdrops,&quot; &quot;support,&quot; or &quot;urgent verification.&quot;</li>
            <li>Do not sign transactions you don&apos;t understand.</li>
            <li>Xessex will never ask for your seed phrase or private key.</li>
          </ul>
        </div>

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <div className="flex justify-center gap-6 text-sm">
            <Link href="/whitepaper" className="text-cyan-400 hover:text-cyan-300">
              Whitepaper
            </Link>
            <Link href="/tokenomics" className="text-cyan-400 hover:text-cyan-300">
              Tokenomics
            </Link>
            <Link href="/faq" className="text-cyan-400 hover:text-cyan-300">
              FAQ
            </Link>
            <Link href="/" className="text-cyan-400 hover:text-cyan-300">
              Home
            </Link>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-6 text-xs text-white/45 text-center">
          <p>
            Disclosure: This page is provided for informational purposes only and does not constitute financial advice,
            an offer, or solicitation. Token participation involves risk.
          </p>
        </div>
      </div>
    </main>
  );
}
