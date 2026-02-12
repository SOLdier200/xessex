import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";
import UptimeTimer from "../components/UptimeTimer";

export const metadata = {
  title: "FAQ | Xessex",
  description: "Frequently Asked Questions about XESSEX - Wallet-Native Video Curation Platform",
};

type FAQItem = {
  q: string;
  a: string | (string | React.ReactNode)[];
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
        a: "Presale is coming February 2026. After presale, XESS will be available on Raydium and other Solana DEXs.",
      },
      {
        q: "What is XESS used for?",
        a: [
          "1. Qualifying for Special Credit tiers (hold to earn Daily* Credits)",
          "2. Future governance voting",
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
        a: "No. XESS is a utility token. It grants access to reward tiers and platform features.",
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
          <><Link href="/rewards" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">View the Rewards page for more details</Link></>,
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
          "• 10,000 XESS → 160 credits/month (Tier 1)",
          "• 25,000 XESS → 480 credits/month (Tier 2)",
          "• 50,000 XESS → 960 credits/month (Tier 3)",
          "• 100,000 XESS → 3,200 credits/month (Tier 4)",
          "• 250,000 XESS → 8,000 credits/month (Tier 5)",
          "• 500,000 XESS → 16,000 credits/month (Tier 6)",
          "• 1,000,000 XESS → 32,000 credits/month (Tier 7)",
          "• 2,500,000 XESS → 48,000 credits/month (Tier 8)",
          "• 5,000,000 XESS → 64,000 credits/month (Tier 9)",
          "• 10,000,000 XESS → 80,000 credits/month (Tier 10)",
        ],
      },
      {
        q: "How do I claim my XESS rewards?",
        a: "Rewards are distributed twice a week. When your rewards are ready, you can claim them directly from the platform — just connect your wallet and hit the claim button.",
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
          "• Increases by 10 each unlock: 10, 20, 30, 40... up to 500",
          "• After 50 unlocks: capped at 500 credits per video",
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
        q: "Are there any restricted features?",
        a: "Moderation tools are restricted to admins and mods. Everything else is open to all users.",
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
        a: "Your account is tied to your wallet. However, we offer an Email Account Recovery option. Go to your Profile and save a recovery email. If you lose wallet access, contact support and we can transfer your account stats (unlocked videos, rewards history) to a new wallet. Note: XESS tokens in your lost wallet cannot be recovered, but your platform progress is preserved.",
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
        a: "The private presale offers XESS at a discounted rate before public listing. 200M tokens (20% of supply) are allocated for private presale, and 150M tokens (15% of supply) are reserved for public sale.",
      },
      {
        q: "What are the presale terms?",
        a: "100% of tokens are delivered immediately upon purchase. No vesting, no lockups.",
      },
      {
        q: "When is the public sale?",
        a: "After presale completion, expected March or April 2026. 150M tokens (15%) will be available at public sale with immediate delivery.",
      },
      {
        q: "Is there a minimum investment?",
        a: "There are no minimum amounts set. You can buy as much as 10 million XESS or as little as you want.",
      },
      {
        q: "How do I participate in presale?",
        a: [
          <>Visit the launch page at <a href="https://presale.xessex.me/launch" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">presale.xessex.me/launch</a> to participate. Payments are accepted in SOL and stablecoins.</>,
          <>To get on the whitelist for the private sale, email <a href="mailto:support@xessex.me" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">support@xessex.me</a> with your wallet address.</>,
        ],
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
          "• Q3 2026: DAO governance, mobile app",
          "• Q4 2026: Multi-chain expansion",
        ],
      },
      {
        q: "Will Xessex expand beyond adult content?",
        a: "Yes! We will be expanding beyond adult content into comedy and other verticals. The platform model is designed to work for any content type, and future categories will depend on community demand and governance votes.",
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
        a: [
          <>For help &amp; support: <a href="mailto:help@xessex.me" className="text-cyan-400 hover:text-cyan-300">help@xessex.me</a></>,
          <>For general contact: <a href="mailto:contact@xessex.me" className="text-cyan-400 hover:text-cyan-300">contact@xessex.me</a></>,
          <>For legal inquiries: <a href="mailto:legal@xessex.me" className="text-cyan-400 hover:text-cyan-300">legal@xessex.me</a></>,
          <>For complaints: <a href="mailto:complaints@xessex.me" className="text-cyan-400 hover:text-cyan-300">complaints@xessex.me</a></>,
          "Do not trust DMs claiming to be team members.",
        ],
      },
      {
        q: "Is this project legitimate?",
        a: [
          "XESS is already minted on Solana mainnet with mint authority revoked. The token contract is immutable. Verify the mint address: HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE",
          <>Xessex has a <UptimeTimer /> history of honest operations and trusted by users since its inception.</>,
          <><Link href="/contact" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">Contact us</Link> if you have any questions.</>,
        ],
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
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 py-12">
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
