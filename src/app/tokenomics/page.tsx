import Link from "next/link";
import Image from "next/image";
import TopNav from "../components/TopNav";

type Allocation = {
  name: string;
  pct: number;
  amount: number;
  vesting: string;
  purpose: string;
};

const TOTAL_SUPPLY = 1_000_000_000;

const ALLOCATIONS: Allocation[] = [
  {
    name: "Private Presale",
    pct: 20,
    amount: 200_000_000,
    vesting: "100% immediate",
    purpose: "Strategic capital + early liquidity",
  },
  {
    name: "Public Sale",
    pct: 15,
    amount: 150_000_000,
    vesting: "100% TGE",
    purpose: "Fair access + price discovery",
  },
  {
    name: "Liquidity Pools",
    pct: 20,
    amount: 200_000_000,
    vesting: "Locked 6–12 months",
    purpose: "Market stability + DEX liquidity",
  },
  {
    name: "Rewards Emissions (Weekly)",
    pct: 20,
    amount: 200_000_000,
    vesting: "Weekly distribution",
    purpose: "Core user incentives",
  },
  {
    name: "Team / Creators",
    pct: 15,
    amount: 150_000_000,
    vesting: "12-month cliff, then vest",
    purpose: "Long-term alignment",
  },
  {
    name: "Treasury / Ecosystem",
    pct: 5,
    amount: 50_000_000,
    vesting: "DAO-controlled",
    purpose: "Partnerships + ops",
  },
  {
    name: "A.I. Content",
    pct: 5,
    amount: 50_000_000,
    vesting: "Content production",
    purpose: "AI-generated content creation",
  },
];

function formatInt(n: number) {
  return n.toLocaleString("en-US");
}

function clampPct(p: number) {
  return Math.max(0, Math.min(100, p));
}

function sumPct(items: Allocation[]) {
  return items.reduce((a, b) => a + b.pct, 0);
}

function sumAmt(items: Allocation[]) {
  return items.reduce((a, b) => a + b.amount, 0);
}

export const metadata = {
  title: "Tokenomics | Xessex",
  description: "XESS Tokenomics - Fixed supply, transparent allocation, no inflation",
};

export default function TokenomicsPage() {
  const pctTotal = sumPct(ALLOCATIONS);
  const amtTotal = sumAmt(ALLOCATIONS);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 mb-4 sm:mb-6 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <h1>
                <Image
                  src="/logos/Tokenomics100.png"
                  alt="XESSEX TOKENOMICS (FINAL — LOCKED)"
                  width={800}
                  height={200}
                  className="h-[40px] sm:h-[52px] w-auto max-w-full"
                />
              </h1>
              <div className="mt-2">
                <Image
                  src="/logos/1,000,000,000Xess100.png"
                  alt="Total Supply: 1,000,000,000 XESS"
                  width={938}
                  height={276}
                  className="h-[28px] sm:h-[36px] w-auto max-w-full"
                />
              </div>
              <p className="text-emerald-400 text-xs sm:text-sm font-semibold mt-1">
                Status: Already minted on mainnet (fixed, immutable, no future minting)
              </p>
              <p className="text-white/50 text-xs sm:text-sm mt-2">
                This is a hard cap. Supply cannot be increased.
              </p>
            </div>

            {/* Fixed supply badge */}
            <div className="bg-black/40 rounded-xl p-3 sm:p-5 border border-emerald-400/30 md:min-w-[280px]">
              <div className="text-xs text-white/50 mb-1">XESS Fixed Supply</div>
              <div className="mt-1">
                <Image
                  src="/logos/1,000,000,000Xess100.png"
                  alt="1,000,000,000 XESS"
                  width={938}
                  height={276}
                  className="h-[26px] sm:h-[32px] w-auto max-w-full"
                />
              </div>
              <div className="text-xs sm:text-sm text-emerald-400 font-semibold mt-1">NO MINTING EVER</div>

              <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-black/40 rounded-xl p-2 sm:p-3 text-center">
                  <div className="text-xs sm:text-sm text-white/60">Allocated</div>
                  <div className="text-white font-bold text-sm sm:text-base">{formatInt(amtTotal)}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-2 sm:p-3 text-center">
                  <div className="text-xs sm:text-sm text-white/60">Percent</div>
                  <div className={`font-bold text-sm sm:text-base ${pctTotal === 100 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {pctTotal}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final Allocation Table */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 mb-4 sm:mb-6 overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">1. Final Allocation Table (Authoritative)</h2>

          {/* Scroll hint for mobile */}
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-2 sm:hidden">
            <span>Swipe to see full table</span>
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm" style={{ minWidth: "580px" }}>
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="text-left py-2 sm:py-3 pr-3 sm:pr-4 font-semibold">Allocation</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold">%</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold">Tokens</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Vesting / Lock</th>
                  <th className="text-left py-2 sm:py-3 pl-2 sm:pl-4 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ALLOCATIONS.map((a) => (
                  <tr key={a.name} className="border-b border-white/5">
                    <td className="py-3 sm:py-4 pr-3 sm:pr-4">
                      <div className="text-white font-semibold whitespace-nowrap">{a.name}</div>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-4 text-right text-white">{a.pct}%</td>
                    <td className="py-3 sm:py-4 px-2 sm:px-4 text-right text-white font-mono whitespace-nowrap">{formatInt(a.amount)}</td>
                    <td className="py-3 sm:py-4 px-2 sm:px-4 text-white/70 text-xs whitespace-nowrap">{a.vesting}</td>
                    <td className="py-3 sm:py-4 pl-2 sm:pl-4 text-white/70 whitespace-nowrap">{a.purpose}</td>
                  </tr>
                ))}

                <tr className="border-t border-white/20 bg-black/40">
                  <td className="py-3 sm:py-4 pr-3 sm:pr-4 text-white font-bold">TOTAL</td>
                  <td className="py-3 sm:py-4 px-2 sm:px-4 text-right font-bold text-emerald-400">{pctTotal}%</td>
                  <td colSpan={3} className="py-3 sm:py-4 px-2 sm:px-4">
                    <Image
                      src="/logos/1,000,000,000Xess100.png"
                      alt="1,000,000,000 XESS"
                      width={938}
                      height={276}
                      className="h-[20px] sm:h-[24px] w-auto"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 mb-4 sm:mb-6 overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">2. Updated Vesting Schedule (Investor-Grade)</h2>

          {/* Scroll hint for mobile */}
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-2 sm:hidden">
            <span>Swipe to see full table</span>
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm font-mono" style={{ minWidth: "480px" }}>
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="text-left py-2 sm:py-3 pr-3 sm:pr-4">TIME →</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">TGE</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">3m</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">6m</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">9m</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">12m</th>
                  <th className="text-center py-2 sm:py-3 px-1.5 sm:px-2">18m</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                <tr className="border-b border-white/5">
                  <td className="py-2.5 sm:py-3 pr-3 sm:pr-4 text-yellow-400">Private</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-emerald-400">100%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2.5 sm:py-3 pr-3 sm:pr-4 text-purple-400">Team</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">0%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">0%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">0%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">0%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">25%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">100%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2.5 sm:py-3 pr-3 sm:pr-4 text-blue-400">Treasury</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">0%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">20%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">40%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">60%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">80%</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">100%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2.5 sm:py-3 pr-3 sm:pr-4 text-cyan-400">Liquidity</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-white/40 text-[10px] sm:text-sm">LOCKED</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-white/40 text-[10px] sm:text-sm">LOCKED</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-white/40 text-[10px] sm:text-sm">LOCKED</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-white/40 text-[10px] sm:text-sm">LOCKED</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-emerald-400">UNLOCK</td>
                  <td className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2">-</td>
                </tr>
                <tr>
                  <td className="py-2.5 sm:py-3 pr-3 sm:pr-4 text-green-400">Rewards</td>
                  <td colSpan={6} className="text-center py-2.5 sm:py-3 px-1.5 sm:px-2 text-white/60 text-[10px] sm:text-sm">Weekly emissions (linear over years) — unused tokens burned</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
            <div className="text-emerald-400 font-semibold text-sm sm:text-base mb-2">This schedule is investor-safe:</div>
            <ul className="text-xs sm:text-sm text-white/70 space-y-1 list-disc pl-5">
              <li>No early insider dump risk</li>
              <li>LP locked for 6-12 months</li>
              <li>Emissions predictable</li>
              <li>Fixed supply, no inflation</li>
              <li>Unused rewards burned (deflationary)</li>
            </ul>
          </div>
        </div>

        {/* Visual breakdown */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 mb-4 sm:mb-6 overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Allocation Breakdown</h2>

          <div className="space-y-2 sm:space-y-3">
            {ALLOCATIONS.map((a) => (
              <div key={a.name} className="bg-black/40 rounded-xl p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm sm:text-base truncate">{a.name}</div>
                    <div className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">{a.purpose}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-sm sm:text-base">{a.pct}%</div>
                    <div className="text-[10px] sm:text-xs text-white/50 font-mono">{formatInt(a.amount)}</div>
                  </div>
                </div>

                <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{ width: `${clampPct(a.pct)}%` }} />
                </div>

                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-white/50">{a.vesting}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Info */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 mb-4 sm:mb-6 overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Token Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Mint Address</div>
              <div className="text-white font-mono text-xs sm:text-sm break-all">HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE</div>
            </div>
            <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Network</div>
              <div className="text-white font-semibold text-sm">Solana Mainnet</div>
            </div>
            <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Supply</div>
              <div>
                <Image
                  src="/logos/1,000,000,000Xess100.png"
                  alt="1,000,000,000 XESS"
                  width={938}
                  height={276}
                  className="h-[20px] sm:h-[23px] w-auto max-w-full"
                />
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-3 sm:p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Minting</div>
              <div className="text-emerald-400 font-semibold text-xs sm:text-sm">Mint Authority/Freeze authority revoked</div>
            </div>
          </div>
        </div>

        {/* Notes / disclosures */}
        <div className="neon-border rounded-2xl p-3 sm:p-6 bg-black/30 overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-2">Notes</h2>
          <div className="space-y-2 text-xs sm:text-sm text-white/60">
            <p>
              XESS has a fixed total supply of <span className="text-white/80 font-semibold">{formatInt(TOTAL_SUPPLY)}</span>{" "}
              with no inflation.
            </p>
            <p>
              &quot;Rewards Emissions&quot; refers to distribution from the fixed rewards bucket (not inflation).
            </p>
            <p>
              <span className="text-red-400 font-semibold">Token Burns:</span> Unused weekly reward emissions are permanently burned.
              This creates significant deflationary pressure as unclaimed and unallocated rewards are removed from circulation forever.
            </p>
            <p>
              A.I. Content allocation funds AI-generated content creation for the platform.
            </p>
            <p className="text-[10px] sm:text-xs text-white/50 pt-3 sm:pt-4 border-t border-white/10">
              This page is informational and does not constitute financial advice.
            </p>
          </div>

          <div className="mt-4 sm:mt-6 flex justify-center gap-4 text-sm">
            <Link href="/whitepaper" className="text-cyan-400 hover:text-cyan-300">Whitepaper</Link>
            <Link href="/faq" className="text-cyan-400 hover:text-cyan-300">FAQ</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
