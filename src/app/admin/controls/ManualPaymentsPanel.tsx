"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";

type Row = {
  id: string;
  status: Status;
  requestedTier: "MEMBER" | "DIAMOND";
  planCode: string;
  amountUsd: number;
  currency: string;
  payerHandle?: string | null;
  note?: string | null;
  verifyCode: string;
  provisionalUntil: string;
  createdAt: string;
  user: { id: string; email?: string | null; walletAddress?: string | null };
};

export default function ManualPaymentsPanel() {
  const [status, setStatus] = useState<Status>("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});

  const tabs: Status[] = useMemo(() => ["PENDING", "APPROVED", "DENIED", "EXPIRED"], []);

  const money = (cents: number) => `${(cents / 100).toFixed(2)}`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/manual-payments?status=${status}`, { cache: "no-store" });
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: string) {
    if (!confirm("Approve this payment and grant full access?")) return;
    const res = await fetch(`/api/admin/manual-payments/${id}/approve`, { method: "POST" });
    if (!res.ok) alert("Approve failed");
    await load();
  }

  async function deny(id: string) {
    if (!confirm("Deny this payment and revoke provisional access?")) return;
    const res = await fetch(`/api/admin/manual-payments/${id}/deny`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminNote: adminNote[id] || "" }),
    });
    if (!res.ok) alert("Deny failed");
    await load();
  }

  return (
    <div id="manual-payments" className="neon-border rounded-2xl p-6 bg-black/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center">
          <span className="text-2xl">💸</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Manual Payments</h2>
          <p className="text-sm text-white/60">Cash App submissions (provisional → approve/deny)</p>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl border border-white/20 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setStatus(t)}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${
              status === t
                ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                : "border-white/10 bg-black/20 text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-white/10">
              <th className="text-left py-2 pr-3">User</th>
              <th className="text-left py-2 pr-3">Plan</th>
              <th className="text-left py-2 pr-3">Requested</th>
              <th className="text-left py-2 pr-3">Amount</th>
              <th className="text-left py-2 pr-3">Verify Code</th>
              <th className="text-left py-2 pr-3">Provisional Until</th>
              <th className="text-left py-2 pr-3">Submitted</th>
              <th className="text-left py-2 pr-3">Actions</th>
            </tr>
          </thead>

          <tbody className="text-white">
            {loading ? (
              <tr>
                <td className="py-6 text-white/60" colSpan={8}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="py-6 text-white/60" colSpan={8}>
                  No results.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-3">
                    <div className="font-semibold">{r.user?.email || r.user?.id}</div>
                    {r.user?.walletAddress ? (
                      <div className="text-white/60 font-mono text-xs">{r.user.walletAddress}</div>
                    ) : null}
                    {r.payerHandle ? <div className="text-white/60 mt-1">payer: {r.payerHandle}</div> : null}
                    {r.note ? <div className="text-white/60 mt-1">note: {r.note}</div> : null}
                  </td>

                  <td className="py-3 pr-3">{r.planCode}</td>
                  <td className="py-3 pr-3">{r.requestedTier}</td>
                  <td className="py-3 pr-3">
                    {money(r.amountUsd)} {r.currency}
                  </td>
                  <td className="py-3 pr-3 font-mono">{r.verifyCode}</td>
                  <td className="py-3 pr-3">{new Date(r.provisionalUntil).toLocaleString()}</td>
                  <td className="py-3 pr-3">{new Date(r.createdAt).toLocaleString()}</td>

                  <td className="py-3 pr-3">
                    {r.status === "PENDING" ? (
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        <button
                          onClick={() => approve(r.id)}
                          className="w-full px-4 py-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 font-semibold hover:bg-emerald-500/25 transition"
                        >
                          Approve
                        </button>

                        <input
                          value={adminNote[r.id] || ""}
                          onChange={(e) => setAdminNote((s) => ({ ...s, [r.id]: e.target.value }))}
                          placeholder="Admin note (optional)"
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30"
                        />

                        <button
                          onClick={() => deny(r.id)}
                          className="w-full px-4 py-2 rounded-xl border border-red-400/40 bg-red-500/15 text-red-200 font-semibold hover:bg-red-500/25 transition"
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <div className="text-white/60">{r.status}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
