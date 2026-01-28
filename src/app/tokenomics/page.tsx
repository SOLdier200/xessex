import Link from "next/link";
import Image from "next/image";

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
    vesting: "20% TGE, 6-month linear",
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
    pct: 15,
    amount: 150_000_000,
    vesting: "Locked 6–12 months",
    purpose: "Market stability",
  },
  {
    name: "Rewards Emissions (Weekly)",
    pct: 20,
    amount: 200_000_000,
    vesting: "Weekly distribution",
    purpose: "Core user incentives",
  },
  {
    name: "Rewards Drawings Pool",
    pct: 5,
    amount: 50_000_000,
    vesting: "Weekly drawings",
    purpose: "Retention + hype",
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
    name: "Burn Reserve",
    pct: 5,
    amount: 50_000_000,
    vesting: "Burned per policy",
    purpose: "Deflationary pressure",
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
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Logo and Back button */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[100px] md:h-[144px] w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition"
          >
            ← Back
          </Link>
        </div>

        {/* Header */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-white">XESSEX TOKENOMICS (FINAL — LOCKED)</h1>
              <p className="text-white/60 mt-2">
                Total Supply: 1,000,000,000 XESS (1B)
              </p>
              <p className="text-emerald-400 text-sm font-semibold mt-1">
                Status: Already minted on mainnet (fixed, immutable, no future minting)
              </p>
              <p className="text-white/50 text-sm mt-2">
                This is a hard cap. Supply cannot be increased.
              </p>
            </div>

            {/* Fixed supply badge */}
            <div className="bg-black/40 rounded-xl p-5 border border-emerald-400/30 min-w-[280px]">
              <div className="text-xs text-white/50 mb-1">XESS Fixed Supply</div>
              <div className="text-2xl font-bold text-white">{formatInt(TOTAL_SUPPLY)} XESS</div>
              <div className="text-sm text-emerald-400 font-semibold mt-1">NO MINTING EVER</div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-xl p-3 text-center">
                  <div className="text-sm text-white/60">Allocated</div>
                  <div className="text-white font-bold">{formatInt(amtTotal)}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-3 text-center">
                  <div className="text-sm text-white/60">Percent</div>
                  <div className={`font-bold ${pctTotal === 100 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {pctTotal}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final Allocation Table */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">1. Final Allocation Table (Authoritative)</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="text-left py-3 pr-4 font-semibold">Allocation</th>
                  <th className="text-right py-3 px-4 font-semibold">%</th>
                  <th className="text-right py-3 px-4 font-semibold">Tokens</th>
                  <th className="text-left py-3 px-4 font-semibold">Vesting / Lock</th>
                  <th className="text-left py-3 pl-4 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ALLOCATIONS.map((a) => (
                  <tr key={a.name} className="border-b border-white/5">
                    <td className="py-4 pr-4">
                      <div className="text-white font-semibold">{a.name}</div>
                    </td>
                    <td className="py-4 px-4 text-right text-white">{a.pct}%</td>
                    <td className="py-4 px-4 text-right text-white font-mono">{formatInt(a.amount)}</td>
                    <td className="py-4 px-4 text-white/70 text-xs">{a.vesting}</td>
                    <td className="py-4 pl-4 text-white/70">{a.purpose}</td>
                  </tr>
                ))}

                <tr className="border-t border-white/20 bg-black/40">
                  <td className="py-4 pr-4 text-white font-bold">TOTAL</td>
                  <td className="py-4 px-4 text-right font-bold text-emerald-400">{pctTotal}%</td>
                  <td className="py-4 px-4 text-right font-bold text-emerald-400 font-mono">
                    {formatInt(amtTotal)}
                  </td>
                  <td colSpan={2} className="py-4 pl-4 text-white/50">SUPPLY = 1,000,000,000 XESS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">2. Updated Vesting Schedule (Investor-Grade)</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="text-left py-3 pr-4">TIME →</th>
                  <th className="text-center py-3 px-2">TGE</th>
                  <th className="text-center py-3 px-2">3m</th>
                  <th className="text-center py-3 px-2">6m</th>
                  <th className="text-center py-3 px-2">9m</th>
                  <th className="text-center py-3 px-2">12m</th>
                  <th className="text-center py-3 px-2">18m</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-yellow-400">Private</td>
                  <td className="text-center py-3 px-2">20%</td>
                  <td className="text-center py-3 px-2">40%</td>
                  <td className="text-center py-3 px-2">60%</td>
                  <td className="text-center py-3 px-2">80%</td>
                  <td className="text-center py-3 px-2">100%</td>
                  <td className="text-center py-3 px-2">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-purple-400">Team</td>
                  <td className="text-center py-3 px-2">0%</td>
                  <td className="text-center py-3 px-2">0%</td>
                  <td className="text-center py-3 px-2">0%</td>
                  <td className="text-center py-3 px-2">0%</td>
                  <td className="text-center py-3 px-2">25%</td>
                  <td className="text-center py-3 px-2">100%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-blue-400">Treasury</td>
                  <td className="text-center py-3 px-2">0%</td>
                  <td className="text-center py-3 px-2">20%</td>
                  <td className="text-center py-3 px-2">40%</td>
                  <td className="text-center py-3 px-2">60%</td>
                  <td className="text-center py-3 px-2">80%</td>
                  <td className="text-center py-3 px-2">100%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-cyan-400">Liquidity</td>
                  <td className="text-center py-3 px-2 text-white/40">LOCKED</td>
                  <td className="text-center py-3 px-2 text-white/40">LOCKED</td>
                  <td className="text-center py-3 px-2 text-white/40">LOCKED</td>
                  <td className="text-center py-3 px-2 text-white/40">LOCKED</td>
                  <td className="text-center py-3 px-2 text-emerald-400">UNLOCK</td>
                  <td className="text-center py-3 px-2">-</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 text-red-400">Burn Pool</td>
                  <td colSpan={6} className="text-center py-3 px-2 text-white/60">Policy-based burns over time (1% per year for 5 years)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-green-400">Rewards</td>
                  <td colSpan={6} className="text-center py-3 px-2 text-white/60">Weekly emissions (linear over years)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
            <div className="text-emerald-400 font-semibold mb-2">This schedule is investor-safe:</div>
            <ul className="text-sm text-white/70 space-y-1 list-disc pl-5">
              <li>No early insider dump risk</li>
              <li>LP locked</li>
              <li>Emissions predictable</li>
              <li>Burn reduces long-term supply</li>
            </ul>
          </div>
        </div>

        {/* Visual breakdown */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Allocation Breakdown</h2>

          <div className="space-y-3">
            {ALLOCATIONS.map((a) => (
              <div key={a.name} className="bg-black/40 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{a.name}</div>
                    <div className="text-xs text-white/60 mt-1">{a.purpose}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{a.pct}%</div>
                    <div className="text-xs text-white/50 font-mono">{formatInt(a.amount)} XESS</div>
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{ width: `${clampPct(a.pct)}%` }} />
                </div>

                <div className="mt-2 text-xs text-white/50">{a.vesting}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Info */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Token Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-xl p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Mint Address</div>
              <div className="text-white font-mono text-sm break-all">HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Network</div>
              <div className="text-white font-semibold">Solana Mainnet</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Supply</div>
              <div className="text-white font-semibold">1,000,000,000 XESS (fixed)</div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/10">
              <div className="text-white/50 text-xs mb-1">Minting</div>
              <div className="text-emerald-400 font-semibold">Mint Authority/Freeze authority revoked</div>
            </div>
          </div>
        </div>

        {/* Notes / disclosures */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-lg font-semibold text-white mb-2">Notes</h2>
          <div className="space-y-2 text-sm text-white/60">
            <p>
              XESS has a fixed total supply of <span className="text-white/80 font-semibold">{formatInt(TOTAL_SUPPLY)}</span>{" "}
              with no inflation.
            </p>
            <p>
              &quot;Rewards Emissions&quot; refers to distribution from the fixed rewards bucket (not inflation).
            </p>
            <p>
              Burn Reserve: 1% of supply burned per year for 5 years (from burn reserve).
            </p>
            <p className="text-xs text-white/50 pt-4 border-t border-white/10">
              This page is informational and does not constitute financial advice.
            </p>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link href="/whitepaper" className="text-cyan-400 hover:text-cyan-300">Whitepaper</Link>
            <Link href="/faq" className="text-cyan-400 hover:text-cyan-300">FAQ</Link>
            <Link href="/" className="text-cyan-400 hover:text-cyan-300">Home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
