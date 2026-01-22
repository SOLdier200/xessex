import Link from "next/link";
import Image from "next/image";

type Allocation = {
  name: string;
  pct: number; // 0-100
  amount: number; // XESS amount
  purpose: string;
  notes?: string[];
};

const TOTAL_SUPPLY = 1_000_000_000;

const ALLOCATIONS: Allocation[] = [
  {
    name: "Pump.fun public launch",
    pct: 30,
    amount: 300_000_000,
    purpose: "Bonding curve sale → price discovery → Raydium liquidity",
    notes: ["Public launch allocation for open price discovery and initial liquidity formation."],
  },
  {
    name: "User Rewards (emissions)",
    pct: 30,
    amount: 300_000_000,
    purpose: "Likes, MVM, comments, holder drip",
    notes: [
      "Distributed based on on-site activity + weekly systems (likes/MVM/comments).",
      "Referral rewards apply only for Diamond → Diamond referrals (per program rules).",
    ],
  },
  {
    name: "Creator / Team",
    pct: 15,
    amount: 150_000_000,
    purpose: "Vesting over time",
    notes: ["Vested distribution to align long-term incentives and reduce sudden sell pressure."],
  },
  {
    name: "Liquidity reserve",
    pct: 10,
    amount: 100_000_000,
    purpose: "Extra LP for Raydium, Orca, etc",
    notes: ["Used to deepen liquidity and support additional pools as the ecosystem grows."],
  },
  {
    name: "Exchange + growth fund",
    pct: 10,
    amount: 100_000_000,
    purpose: "CEXs, marketing, partnerships",
    notes: ["Listings, partnerships, and growth initiatives to expand reach and utility."],
  },
  {
    name: "Community Treasury (DAO)",
    pct: 5,
    amount: 50_000_000,
    purpose: "Token-holder-governed",
    notes: ["Treasury intended for community governance and future initiatives."],
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

export default function TokenomicsPage() {
  const pctTotal = sumPct(ALLOCATIONS);
  const amtTotal = sumAmt(ALLOCATIONS);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-white">XESS Tokenomics</h1>
              <p className="text-white/60 mt-2">
                Fixed-supply design with a clean, transparent allocation model.
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  Home
                </Link>
                <Link
                  href="/terms"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  Privacy
                </Link>
              </div>
            </div>

            {/* Fixed supply badge */}
            <div className="bg-black/40 rounded-xl p-5 border border-white/10 min-w-[260px]">
              <div className="text-xs text-white/50 mb-1">XESS Fixed Supply</div>
              <div className="text-2xl font-bold text-white">{formatInt(TOTAL_SUPPLY)} XESS</div>
              <div className="text-sm text-emerald-400 font-semibold mt-1">No inflation. Ever.</div>

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

              {pctTotal !== 100 || amtTotal !== TOTAL_SUPPLY ? (
                <div className="text-xs text-yellow-400 mt-3">
                  Note: allocation totals don&apos;t match supply (check values).
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Allocation table */}
        <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Final Allocation</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="text-left py-3 pr-4 font-semibold">Bucket</th>
                  <th className="text-right py-3 px-4 font-semibold">%</th>
                  <th className="text-right py-3 px-4 font-semibold">XESS</th>
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
                    <td className="py-4 pl-4 text-white/70">{a.purpose}</td>
                  </tr>
                ))}

                <tr className="border-t border-white/10">
                  <td className="py-4 pr-4 text-white font-bold">TOTAL</td>
                  <td className="py-4 px-4 text-right font-bold text-white">{pctTotal}%</td>
                  <td className="py-4 px-4 text-right font-bold text-white font-mono">
                    {formatInt(amtTotal)}
                  </td>
                  <td className="py-4 pl-4 text-white/50">Fixed supply distribution</td>
                </tr>
              </tbody>
            </table>
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
                  <div className="h-full bg-white/30" style={{ width: `${clampPct(a.pct)}%` }} />
                </div>

                {a.notes?.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-white/60 list-disc pl-5">
                    {a.notes.map((n, idx) => (
                      <li key={idx}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
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
              &quot;User Rewards (emissions)&quot; refers to distribution from the fixed rewards bucket (not inflation).
            </p>
            <p className="text-xs text-white/50">
              This page is informational and does not constitute financial advice.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
