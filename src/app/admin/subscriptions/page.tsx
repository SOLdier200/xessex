"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tier = "MEMBER" | "DIAMOND";
type Status = "ACTIVE" | "PENDING" | "PARTIAL" | "EXPIRED" | "CANCELED";

type PaymentMethod = "CRYPTO" | "CARD" | "CASHAPP";

type Row = {
  id: string;
  userId: string;
  tier: Tier;
  status: Status;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  nowPaymentsOrderId: string | null;
  nowPaymentsInvoiceId: string | null;
  nowPaymentsPaymentId: string | null;
  lastTxSig: string | null;
  paymentMethod: PaymentMethod;
  amountCents: number | null;
  manualPaymentId: string | null;
  verifyCode: string | null;
  user: { id: string; email: string | null; createdAt: string };
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function trunc(s: string | null, n = 10) {
  if (!s) return "—";
  if (s.length <= n) return s;
  return s.slice(0, Math.ceil(n / 2)) + "…" + s.slice(-Math.floor(n / 2));
}

function statusColor(status: Status) {
  switch (status) {
    case "ACTIVE":
      return "text-green-400";
    case "PARTIAL":
      return "text-yellow-400 font-semibold";
    case "PENDING":
      return "text-blue-400";
    case "EXPIRED":
      return "text-gray-500";
    case "CANCELED":
      return "text-red-400";
    default:
      return "";
  }
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [partialOnly, setPartialOnly] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [showTxModal, setShowTxModal] = useState<string | null>(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (tier) sp.set("tier", tier);
    if (paymentMethod) sp.set("paymentMethod", paymentMethod);
    if (q.trim()) sp.set("q", q.trim());
    if (partialOnly) sp.set("partialOnly", "1");
    sp.set("limit", String(limit));
    return sp.toString();
  }, [status, tier, paymentMethod, q, partialOnly, limit]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/list?${params}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        if (res.status === 403) {
          setError("Access denied. Admin wallet required.");
        } else {
          setError(json?.error || "LOAD_FAILED");
        }
        setRows([]);
        return;
      }
      setRows(json.rows || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function activateAnyway(r: Row) {
    if (!confirm(`Activate subscription for ${r.user?.email || r.userId}?`)) return;
    const res = await fetch("/api/admin/subscriptions/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId: r.id }),
    });
    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      alert(json?.error || "ACTIVATE_FAILED");
      return;
    }
    alert(`Activated! Tier: ${json.tier}, Expires: ${json.expiresAt}, Days granted: ${json.daysGranted}`);
    await load();
  }

  async function cancelSub(r: Row) {
    if (!confirm(`Cancel subscription for ${r.user?.email || r.userId}?`)) return;
    const res = await fetch("/api/admin/subscriptions/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId: r.id }),
    });
    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      alert(json?.error || "CANCEL_FAILED");
      return;
    }
    await load();
  }

  async function lookup(r: Row) {
    const orderId = r.nowPaymentsOrderId || "";
    const tx = r.lastTxSig || "";
    const invoiceId = r.nowPaymentsInvoiceId || "";
    const paymentId = r.nowPaymentsPaymentId || "";

    const sp = new URLSearchParams();
    if (orderId) sp.set("order_id", orderId);
    else if (tx) sp.set("tx", tx);
    else if (paymentId) sp.set("payment_id", paymentId);
    else if (invoiceId) sp.set("invoice_id", invoiceId);

    const res = await fetch(`/api/admin/billing/nowpayments/lookup?${sp.toString()}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      alert(json?.error || "LOOKUP_FAILED");
      return;
    }

    const s = json.subscription;
    alert(
      [
        `User: ${json.user?.email || s.userId}`,
        `Tier: ${s.tier}`,
        `Status: ${s.status}`,
        `Expires: ${s.expiresAt || "—"}`,
        `Order: ${s.nowPaymentsOrderId || "—"}`,
        `Invoice: ${s.nowPaymentsInvoiceId || "—"}`,
        `Payment: ${s.nowPaymentsPaymentId || "—"}`,
        `TX: ${s.txHash || "—"}`,
      ].join("\n")
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin: Subscriptions</h1>
          <Link
            href="/admin"
            className="rounded-full border border-pink-400/50 bg-pink-500/20 px-4 py-2 text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Admin Panel
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs text-gray-400">Status</div>
            <select
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-400">Tier</div>
            <select
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">All</option>
              <option value="MEMBER">MEMBER</option>
              <option value="DIAMOND">DIAMOND</option>
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-400">Payment</div>
            <select
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="">All</option>
              <option value="CRYPTO">Crypto</option>
              <option value="CARD">Card</option>
              <option value="CASHAPP">CashApp</option>
            </select>
          </div>

          <label className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={partialOnly}
              onChange={(e) => setPartialOnly(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span className="text-sm text-gray-300">PARTIAL only</span>
          </label>

          <div className="min-w-[280px] flex-1">
            <div className="mb-1 text-xs text-gray-400">Search (email / order / tx / payment / invoice)</div>
            <input
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="sx_M60_... | user@email.com | tx hash"
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-400">Limit</div>
            <select
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <button
            className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="overflow-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-gray-800 bg-gray-900/50">
              <tr className="text-left text-gray-400">
                <th className="p-3">User</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Status</th>
                <th className="p-3">Method</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Order / Code</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Actions</th>
                <th className="p-3">TX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  <td className="p-3">
                    <div className="font-medium">{r.user?.email || "—"}</div>
                    <div className="text-xs text-gray-500">{trunc(r.userId, 14)}</div>
                  </td>
                  <td className="p-3">{r.tier}</td>
                  <td className={`p-3 ${statusColor(r.status)}`}>{r.status}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      r.paymentMethod === "CASHAPP"
                        ? "bg-green-500/20 text-green-400"
                        : r.paymentMethod === "CARD"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {r.paymentMethod || "CRYPTO"}
                    </span>
                  </td>
                  <td className="p-3 text-gray-300">
                    {r.amountCents ? `$${(r.amountCents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="p-3 text-gray-300">{fmt(r.expiresAt)}</td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {r.paymentMethod === "CASHAPP"
                      ? (r.verifyCode || "—")
                      : trunc(r.nowPaymentsOrderId, 18)}
                  </td>
                  <td className="p-3 text-gray-400">{fmt(r.updatedAt)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded border border-gray-600 px-2 py-1 text-xs hover:bg-gray-700"
                        onClick={() => lookup(r)}
                      >
                        Lookup
                      </button>
                      <button
                        className="rounded border border-green-600/50 px-2 py-1 text-xs text-green-400 hover:bg-green-900/30"
                        onClick={() => activateAnyway(r)}
                      >
                        Activate
                      </button>
                      <button
                        className="rounded border border-red-600/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                        onClick={() => cancelSub(r)}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                  <td className="p-3">
                    {r.lastTxSig ? (
                      <button
                        className="rounded border border-cyan-600/50 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-900/30"
                        onClick={() => setShowTxModal(r.lastTxSig)}
                        title="View Transaction"
                      >
                        View TX
                      </button>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && !error && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={10}>
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Admin access is controlled by <code className="text-gray-400">ADMIN_WALLETS</code> env var.
          Search supports email, order_id, payment_id, invoice_id, tx hash, and verify code.
        </div>

        {/* TX Modal */}
        {showTxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Transaction ID</h3>
                <button
                  onClick={() => setShowTxModal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="bg-black/50 rounded-lg p-4 font-mono text-sm text-cyan-400 break-all">
                {showTxModal}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(showTxModal);
                    alert("Copied to clipboard!");
                  }}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
                >
                  Copy TX
                </button>
                <a
                  href={`https://solscan.io/tx/${showTxModal}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-cyan-600/50 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/30 text-center"
                >
                  View on Solscan
                </a>
                <button
                  onClick={() => setShowTxModal(null)}
                  className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
