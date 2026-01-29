"use client";

import { useEffect, useMemo, useState } from "react";

type BreakdownRow = {
  system: "legacy" | "onchain";
  epochNo: number;
  epochId?: string | null;
  legacyLabel?: string | null;
  weekKey?: string | null;
  setOnChain?: boolean | null;
  claimableAtomic: string;
  claimedAtomic: string;
  unclaimedAtomic: string;
  status: string;
  txSig: string | null;
  claimedAt: string | null;
};

type UserRow = {
  userId: string;
  email: string | null;
  role: string | null;
  solWallet: string | null;
  walletAddress: string | null;
  claimableAtomic: string;
  claimedAtomic: string;
  unclaimedAtomic: string;
  breakdown: BreakdownRow[];
};

function formatAtomic(atomicStr: string, decimals = 9) {
  const n = BigInt(atomicStr);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = (n % base).toString().padStart(decimals, "0").slice(0, 4);
  return `${whole.toString()}.${frac}`;
}

function shortWallet(w: string) {
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

export default function UnclaimedXessAdminPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [verifyOnchain, setVerifyOnchain] = useState(false);
  const [systemFilter, setSystemFilter] = useState<"all" | "legacy" | "onchain">("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (verifyOnchain) qs.set("verifyOnchain", "1");
      const res = await fetch(`/api/admin/unclaimed-xess?${qs.toString()}`, {
        method: "GET",
        headers: { "cache-control": "no-cache" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");

      setRows(json.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyOnchain]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows
      .map((u) => {
        let breakdown = u.breakdown;

        if (systemFilter !== "all") {
          breakdown = breakdown.filter((b) => b.system === systemFilter);
        }

        if (pendingOnly) {
          breakdown = breakdown.filter((b) => b.system === "onchain" && b.setOnChain === false);
        }

        const claimable = breakdown.reduce((acc, b) => acc + BigInt(b.claimableAtomic), 0n);
        const claimed = breakdown.reduce((acc, b) => acc + BigInt(b.claimedAtomic), 0n);
        const unclaimed = breakdown.reduce((acc, b) => acc + BigInt(b.unclaimedAtomic), 0n);

        return {
          ...u,
          breakdown,
          claimableAtomic: claimable.toString(),
          claimedAtomic: claimed.toString(),
          unclaimedAtomic: unclaimed.toString(),
        };
      })
      .filter((u) => u.breakdown.length > 0)
      .filter((u) => {
        if (!q) return true;
        return (
          u.userId.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.solWallet ?? "").toLowerCase().includes(q) ||
          (u.walletAddress ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (BigInt(b.unclaimedAtomic) > BigInt(a.unclaimedAtomic) ? 1 : -1));
  }, [rows, systemFilter, pendingOnly, search]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Unclaimed XESS</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Users: <b>{filtered.length}</b>
            {verifyOnchain ? " (receipt verified)" : " (no receipt check)"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={verifyOnchain}
              onChange={(e) => setVerifyOnchain(e.target.checked)}
            />
            Verify on-chain receipts
          </label>

          <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value as any)}>
            <option value="all">All systems</option>
            <option value="legacy">Legacy only</option>
            <option value="onchain">On-chain only</option>
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            Pending on-chain epoch only
          </label>

          <input
            placeholder="Search email / userId / wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "6px 10px", minWidth: 240 }}
          />

          <button onClick={load} style={{ padding: "6px 10px" }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 16, opacity: 0.8 }}>Loading...</div>
      ) : err ? (
        <div style={{ marginTop: 16, color: "#ff6b6b" }}>
          {err}
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            If you're not ADMIN/MOD, the API will return 403 (expected).
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {filtered.map((u) => (
            <details key={u.userId} style={{ border: "1px solid #222", borderRadius: 12, padding: 12 }}>
              <summary
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{u.email ?? u.userId}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {u.userId} {u.role ? `- ${u.role}` : ""}
                  </div>
                  <div style={{ fontFamily: "monospace", opacity: 0.85, marginTop: 6 }}>
                    {u.solWallet ? `solWallet ${shortWallet(u.solWallet)}` : ""}
                    {u.walletAddress ? `  walletAddress ${shortWallet(u.walletAddress)}` : ""}
                    {!u.solWallet && !u.walletAddress ? "-" : ""}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{formatAtomic(u.unclaimedAtomic)} XESS</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    claimable {formatAtomic(u.claimableAtomic)} / claimed {formatAtomic(u.claimedAtomic)}
                  </div>
                </div>
              </summary>

              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                      <th style={{ padding: 8 }}>System</th>
                      <th style={{ padding: 8 }}>Epoch</th>
                      <th style={{ padding: 8 }}>Week/Range</th>
                      <th style={{ padding: 8 }}>Unclaimed</th>
                      <th style={{ padding: 8 }}>Status</th>
                      <th style={{ padding: 8 }}>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.breakdown.map((b, i) => (
                      <tr key={`${b.system}:${b.epochNo}:${i}`} style={{ borderBottom: "1px solid #222" }}>
                        <td style={{ padding: 8, fontWeight: 800 }}>{b.system}</td>
                        <td style={{ padding: 8 }}>{b.epochNo}</td>
                        <td style={{ padding: 8, fontFamily: "monospace" }}>
                          {b.system === "onchain"
                            ? `${b.weekKey ?? "-"}${b.setOnChain === false ? " (PENDING)" : ""}`
                            : b.legacyLabel ?? "-"}
                        </td>
                        <td style={{ padding: 8, fontWeight: 900 }}>{formatAtomic(b.unclaimedAtomic)} XESS</td>
                        <td style={{ padding: 8 }}>{b.status}</td>
                        <td style={{ padding: 8, fontFamily: "monospace" }}>
                          {b.txSig ? shortWallet(b.txSig) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                  Pending filter checks on-chain rows where ClaimEpoch.setOnChain === false.
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
