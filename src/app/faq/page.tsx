import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "FAQ | Xessex",
  description: "Frequently Asked Questions about XESSEX - Wallet-Native Video Curation Platform",
};

type FAQItem = {
  q: string;
  a: string | string[];
};

type FAQSection = {
  id: string;
  title: string;
  color: string;
  items: FAQItem[];
};

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "general",
    title: "GENERAL",
    color: "blue",
    items: [
      {
        q: "What is Xessex?",
        a: "Xessex is a wallet-native video curation platform where users earn rewards for participation. Your wallet is your identity — no subscriptions, no passwords.",
      },
      {
        q: "Do I need to pay to use Xessex?",
        a: "No. There are no subscriptions. You earn access by holding XESS tokens and accumulating Special Credits. Some videos are free; others require unlocking with credits.",
      },
      {
        q: "How do I sign up?",
        a: "Connect a Solana wallet (Phantom, Solflare, etc.). That's it. Your wallet address becomes your account.",
      },
      {
        q: "Is this a decentralized platform?",
        a: "Partially. Rewards and token economics run on-chain (Solana). The content catalog and user interface are centralized for performance and safety.",
      },
      {
        q: "Is Xessex only for adult content?",
        a: "At launch, yes. The model is designed for verticals where traditional payment processors fail. Adult content is the first use case.",
      },
    ],
  },
  {
    id: "token",
    title: "TOKEN & ECONOMICS",
    color: "purple",
    items: [
      {
        q: "What is XESS?",
        a: "XESS is the platform's native token on Solana. It's already minted with a fixed supply of 1 billion. No inflation, no minting ever.",
      },
      {
        q: "Where can I buy XESS?",
        a: "Presale is available now. After presale, XESS will be available on Raydium and other Solana DEXs.",
      },
      {
        q: "What is XESS used for?",
        a: [
          "1. Qualifying for Special Credit tiers (hold to earn monthly credits)",
          "2. Receiving weekly reward distributions",
          "3. Participating in weekly prize drawings",
          "4. Future governance voting",
        ],
      },
      {
        q: "Can I buy access or unlocks with XESS?",
        a: "No. XESS is never spent inside the platform. You hold it to qualify for tiers and receive rewards. Unlocks use Special Credits only.",
      },
      {
        q: "What happens if XESS price drops?",
        a: "The platform still works. Access is based on credits earned from holding, not token value. The system is designed to survive market volatility.",
      },
      {
        q: "Is XESS a security?",
        a: "No. XESS is a utility token. It grants access to reward tiers and platform features. It does not represent ownership, equity, or profit-sharing.",
      },
    ],
  },
  {
    id: "rewards",
    title: "REWARDS & CREDITS",
    color: "cyan",
    items: [
      {
        q: "How do I earn rewards?",
        a: [
          "XESS rewards are distributed weekly based on:",
          "• Likes Pool (70%): Votes on comments",
          "• MVM Pool (20%): Most Valued Members",
          "• Comments Pool (5%): Quality comments",
          "• Referrals Pool (5%): Bringing new users",
        ],
      },
      {
        q: "What are Special Credits?",
        a: "Special Credits are internal, non-transferable points used to unlock videos. You earn them monthly based on your XESS holdings tier.",
      },
      {
        q: "Can I buy Special Credits?",
        a: "No. Credits cannot be purchased, transferred, or sold. They are only earned by holding XESS.",
      },
      {
        q: "How do credit tiers work?",
        a: [
          "Your monthly credit allocation depends on your XESS balance:",
          "• 10,000 XESS → 10 credits/month (Tier 1)",
          "• 25,000 XESS → 30 credits/month (Tier 2)",
          "• 50,000 XESS → 60 credits/month (Tier 3)",
          "• 100,000 XESS → 200 credits/month (Tier 4)",
          "• 250,000 XESS → 500 credits/month (Tier 5)",
          "• 500,000 XESS → 1,000 credits/month (Tier 6)",
          "• 1,000,000 XESS → 2,000 credits/month (Tier 7)",
          "• 2,500,000 XESS → 3,000 credits/month (Tier 8)",
          "• 5,000,000 XESS → 4,000 credits/month (Tier 9)",
        ],
      },
      {
        q: "How do I claim my XESS rewards?",
        a: "Weekly rewards are published as Merkle roots on-chain. You claim via the platform interface — your wallet signs the claim transaction.",
      },
      {
        q: "What if I don't have a wallet linked when I earn rewards?",
        a: "Rewards are tracked by user ID. You can link any wallet later and claim accumulated rewards.",
      },
    ],
  },
  {
    id: "access",
    title: "ACCESS & UNLOCKS",
    color: "green",
    items: [
      {
        q: "How do video unlocks work?",
        a: [
          "Video unlock costs follow a progressive ladder:",
          "• First video: 10 credits",
          "• Gradually increases: 20, 30, 40... up to 500",
          "• After 26 unlocks: capped at 500 credits per video",
          "• Free videos: Always 0 credits",
          "Once unlocked, a video is yours forever.",
        ],
      },
      {
        q: "Do unlocks expire?",
        a: "No. Once you unlock a video, it stays unlocked permanently on your account.",
      },
      {
        q: "Can I unlock videos without holding XESS?",
        a: "Only free videos (0-cost) are accessible without credits. To earn credits for paid unlocks, you need to hold XESS.",
      },
      {
        q: "What can all authenticated users do?",
        a: "All users with a connected wallet can: comment on videos, rate videos with stars, vote on comments, and participate in the community.",
      },
      {
        q: "Are there any restricted features?",
        a: "Moderation tools are restricted to admins and mods. Everything else is open to all authenticated users.",
      },
    ],
  },
  {
    id: "security",
    title: "SECURITY & SAFETY",
    color: "red",
    items: [
      {
        q: "Is my wallet safe?",
        a: "Xessex never has access to your private keys. We only use your public address for identification. Sign-in uses message signing, not transactions.",
      },
      {
        q: "What data does Xessex collect?",
        a: "Your wallet address, viewing history, votes, and comments. No email required. No passwords stored.",
      },
      {
        q: "Can Xessex access my funds?",
        a: "No. We cannot move, spend, or access any tokens in your wallet. Claiming rewards requires your explicit signature.",
      },
      {
        q: "What if I lose access to my wallet?",
        a: "Your account is tied to your wallet. If you lose access, you lose your account, unlocks, and unclaimed rewards. Use proper wallet backup.",
      },
      {
        q: "Is the content moderated?",
        a: "Yes. All content is reviewed before publishing. Illegal content is prohibited. Community reports are investigated.",
      },
    ],
  },
  {
    id: "presale",
    title: "PRESALE & INVESTORS",
    color: "yellow",
    items: [
      {
        q: "What is the presale?",
        a: "The private presale offers XESS at a discounted rate before public listing. 200M tokens (20% of supply) are allocated.",
      },
      {
        q: "What are the presale terms?",
        a: "20% unlocks at TGE (Token Generation Event). Remaining 80% vests linearly over 6 months.",
      },
      {
        q: "When is the public sale?",
        a: "After presale completion. 150M tokens (15%) will be available at public sale with 100% TGE unlock.",
      },
      {
        q: "Is there a minimum investment?",
        a: "Minimum amounts are set per presale round. Contact the team for current round details.",
      },
      {
        q: "How do I participate in presale?",
        a: "Visit the presale page on the website or contact the team directly. Payments accepted in SOL and stablecoins.",
      },
    ],
  },
  {
    id: "governance",
    title: "GOVERNANCE & FUTURE",
    color: "indigo",
    items: [
      {
        q: "Will there be a DAO?",
        a: "Yes. The Treasury/Ecosystem allocation (5% of supply) will eventually be DAO-controlled for partnerships and operations.",
      },
      {
        q: "Can token holders vote on platform decisions?",
        a: "Governance features are planned for future releases. XESS holders will be able to vote on key decisions.",
      },
      {
        q: "What's on the roadmap?",
        a: [
          "• Q1 2026: Presale, token launch, core platform",
          "• Q2 2026: Rewards v2, creator tools",
          "• Q3 2026: DAO governance, mobile apps",
          "• Q4 2026: Multi-chain expansion",
        ],
      },
      {
        q: "Will Xessex expand beyond adult content?",
        a: "The model is designed to work for any content vertical. Future expansion depends on community demand and governance votes.",
      },
    ],
  },
  {
    id: "risks",
    title: "RISKS",
    color: "orange",
    items: [
      {
        q: "What are the main risks?",
        a: [
          "• Token price volatility — XESS may lose value",
          "• Regulatory uncertainty — crypto regulations evolve",
          "• Platform risk — service may change or discontinue",
          "• Smart contract risk — bugs are possible despite audits",
          "• Market risk — no guaranteed liquidity",
        ],
      },
      {
        q: "Is this financial advice?",
        a: "No. Nothing on Xessex constitutes financial advice. Do your own research. Only invest what you can afford to lose.",
      },
      {
        q: "Are rewards guaranteed?",
        a: "Rewards depend on platform activity and your participation. Amounts vary weekly based on pool allocations and user activity.",
      },
      {
        q: "What if the platform shuts down?",
        a: "XESS tokens remain on Solana blockchain regardless of platform status. Unclaimed rewards may become inaccessible.",
      },
    ],
  },
  {
    id: "final",
    title: "FINAL",
    color: "emerald",
    items: [
      {
        q: "Where can I get more information?",
        a: "Read the Whitepaper for technical details. Check Tokenomics for allocation breakdown. Join our community channels.",
      },
      {
        q: "How do I contact the team?",
        a: "Use the contact form on the website or reach out via official social channels. Do not trust DMs claiming to be team members.",
      },
      {
        q: "Is this project legitimate?",
        a: "XESS is already minted on Solana mainnet with mint authority revoked. The token contract is immutable. Verify the mint address: HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE",
      },
    ],
  },
];

const colorMap: Record<string, { border: string; title: string }> = {
  blue: { border: "border-blue-500/30", title: "text-blue-300" },
  purple: { border: "border-purple-500/30", title: "text-purple-300" },
  cyan: { border: "border-cyan-500/30", title: "text-cyan-300" },
  green: { border: "border-green-500/30", title: "text-green-300" },
  red: { border: "border-red-500/30", title: "text-red-300" },
  yellow: { border: "border-yellow-500/30", title: "text-yellow-300" },
  indigo: { border: "border-indigo-500/30", title: "text-indigo-300" },
  orange: { border: "border-orange-500/30", title: "text-orange-300" },
  emerald: { border: "border-emerald-500/30", title: "text-emerald-300" },
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={855}
              height={285}
              className="h-[240px] w-auto"
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

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Frequently Asked Questions
        </h1>
        <p className="text-xl text-white/70 mb-8">Everything you need to know about XESSEX</p>

        {/* Table of Contents */}
        <nav className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {FAQ_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="text-cyan-400 hover:text-cyan-300"
              >
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        {/* FAQ Sections */}
        <div className="space-y-8">
          {FAQ_SECTIONS.map((section) => {
            const colors = colorMap[section.color] || colorMap.blue;
            return (
              <section
                key={section.id}
                id={section.id}
                className={`bg-gray-900/50 border ${colors.border} rounded-2xl p-6`}
              >
                <h2 className={`text-2xl font-semibold mb-6 ${colors.title}`}>
                  {section.title}
                </h2>
                <div className="space-y-6">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                      <h3 className="text-lg font-semibold text-white mb-2">{item.q}</h3>
                      {Array.isArray(item.a) ? (
                        <div className="text-white/70 space-y-1">
                          {item.a.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/70">{item.a}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-white/50 text-sm mb-4">
            Still have questions? Read our detailed documentation.
          </p>
          <div className="flex justify-center gap-6 text-sm">
            <Link href="/whitepaper" className="text-cyan-400 hover:text-cyan-300">
              Whitepaper
            </Link>
            <Link href="/tokenomics" className="text-cyan-400 hover:text-cyan-300">
              Tokenomics
            </Link>
            <Link href="/" className="text-cyan-400 hover:text-cyan-300">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
