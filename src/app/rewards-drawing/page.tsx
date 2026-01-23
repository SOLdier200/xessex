"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type DrawingStatusResp = {
  ok: boolean;
  error?: string;
  weekKey: string;
  closesAt: string; // ISO
  creditsBalanceMicro: string;
  drawing: null | {
    id: string;
    status: "OPEN" | "CLOSED" | "DRAWN";
    ticketPriceMicro: string | null;
    totalTickets: string;
    yourTickets: string;
    chanceAnyPct: number;
    pools: { user: string; match: string; rollover: string; total: string };
  };
  pendingWins: Array<{
    winnerId: string;
    weekKey: string;
    place: number;
    prizeCreditsMicro: string;
    expiresAt: string; // ISO
  }>;
};

function fmtInt(n: string) {
  try {
    return BigInt(n).toLocaleString();
  } catch {
    return n;
  }
}

function microToCreditsStr(micro: string) {
  try {
    const v = BigInt(micro);
    const whole = v / 1000n;
    const frac = v % 1000n;
    if (frac === 0n) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return micro;
  }
}

function placeLabel(p: number) {
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  return `${p}th`;
}

function Countdown({ closesAtIso }: { closesAtIso: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const text = useMemo(() => {
    const closesAt = new Date(closesAtIso).getTime();
    const ms = closesAt - now;
    if (!Number.isFinite(closesAt) || ms <= 0) return "Closed (drawing soon)";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${d}d ${h}h ${m}m ${sec}s`;
  }, [closesAtIso, now]);

  return <span className="text-white">{text}</span>;
}

/**
 * Use Special Credits to enter the drawing (not "buy" - credits are earned, not purchased)
 */
function EnterDrawingWithCredits({ onSuccess }: { onSuccess: () => void }) {
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qtyBig = useMemo(() => {
    try {
      return BigInt(qty.trim() || "0");
    } catch {
      return 0n;
    }
  }, [qty]);

  const enter = async () => {
    setErr(null);
    if (qtyBig <= 0n) {
      setErr("Enter a valid number of entries.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/rewards-drawing/enter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: qtyBig.toString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "entry_failed");
      onSuccess();
      setQty("1");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-black/40 p-4">
      <div className="text-white font-semibold mb-2">Use Special Credits to Enter</div>
      <div className="text-white/60 text-sm mb-3">
        Cost: <span className="text-white">1 Special Credit</span> per entry
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full sm:w-28 rounded-lg bg-black/60 border border-white/10 px-3 py-3 text-white text-base"
          inputMode="numeric"
          placeholder="1"
          disabled={busy}
        />
        <button
          onClick={enter}
          disabled={busy}
          className="w-full sm:w-auto px-4 py-3 rounded-lg bg-cyan-500/20 border border-cyan-400/50 hover:bg-cyan-500/30 text-cyan-400 font-semibold transition disabled:opacity-60"
        >
          {busy ? "Entering..." : "Enter Drawing"}
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
    </div>
  );
}

export default function RewardsDrawingPage() {
  const [data, setData] = useState<DrawingStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rewards-drawing/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as DrawingStatusResp | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || "failed_to_load");
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const creditsBalance = useMemo(() => microToCreditsStr(data?.creditsBalanceMicro ?? "0"), [data]);

  const claim = async (w: DrawingStatusResp["pendingWins"][number]) => {
    setClaimBusy(w.winnerId);
    setErr(null);
    try {
      const res = await fetch("/api/rewards-drawing/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ winnerId: w.winnerId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "claim_failed");

      await refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setClaimBusy(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="inline-block mb-4">
          <Image src="/logos/mainsitelogo.png" alt="Xessex" width={285} height={95} className="h-[60px] w-auto" />
        </Link>
        <Image src="/logos/textlogo/siteset3/weeklyrew100.png" alt="Weekly Rewards Drawing" width={938} height={276} className="h-[133px] w-auto" />
        <div className="mt-2 text-white/60">
          Drawings close every <span className="text-white">Sunday 11:59pm PT</span>. Unclaimed
          prizes roll into the next week&apos;s pool.
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-white/70">
          Loading...
        </div>
      )}

      {!loading && err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-6 text-red-200">
          {err}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-white/60 text-sm">Week Ending (PT)</div>
              <div className="text-white font-semibold text-lg">{data.weekKey}</div>
              <div className="mt-2 text-white/60 text-sm">
                Time left: <Countdown closesAtIso={data.closesAt} />
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5">
              <div className="text-cyan-400/80 text-sm">Your Special Credits</div>
              <div className="text-cyan-400 font-semibold text-lg">{creditsBalance}</div>
              <div className="mt-2 text-white/50 text-xs">
                Earned daily based on eligibility
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-white/60 text-sm">How winners are picked</div>
              <div className="text-white/80 text-sm mt-1">
                More entries = more chances. 3 winners drawn weekly.
              </div>
              <div className="text-white/50 text-xs mt-2">
                Prizes: 50% / 30% / 20% of pool
              </div>
            </div>
          </div>

          {/* Credits Drawing */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold text-xl">Special Credits Drawing</div>
              <div className="text-white/60 text-sm">{data.drawing?.status ?? "—"}</div>
            </div>

            {data.drawing ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/60 text-sm">Your entries</div>
                    <div className="text-white font-semibold text-xl">{fmtInt(data.drawing.yourTickets)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/60 text-sm">Total entries</div>
                    <div className="text-white font-semibold text-xl">{fmtInt(data.drawing.totalTickets)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 col-span-2">
                    <div className="text-white/60 text-sm">Win chance (any prize)</div>
                    <div className="text-white font-extrabold text-2xl">
                      {data.drawing.chanceAnyPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4 mb-4">
                  <div className="text-white/60 text-sm mb-2">Prize pool (Special Credits)</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-white/60">User pool</div>
                    <div className="text-white text-right">{microToCreditsStr(data.drawing.pools.user)}</div>
                    <div className="text-white/60">System match</div>
                    <div className="text-white text-right">{microToCreditsStr(data.drawing.pools.match)}</div>
                    <div className="text-white/60">Rollover</div>
                    <div className="text-white text-right">{microToCreditsStr(data.drawing.pools.rollover)}</div>
                    <div className="text-white/60 font-semibold border-t border-white/10 pt-2">Total</div>
                    <div className="text-white text-right font-semibold border-t border-white/10 pt-2">{microToCreditsStr(data.drawing.pools.total)}</div>
                  </div>
                </div>

                <EnterDrawingWithCredits onSuccess={refetch} />
              </>
            ) : (
              <div className="text-white/60">Drawing not available.</div>
            )}
          </div>

          {/* Pending prizes */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
            <div className="text-white font-bold text-xl">Your Prizes</div>
            <div className="text-white/60 text-sm mt-1">
              Claim before expiry. Unclaimed prizes roll into next week&apos;s pool.
            </div>

            {data.pendingWins.length === 0 ? (
              <div className="mt-4 text-white/60">No pending prizes.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.pendingWins.map((w) => (
                  <div
                    key={w.winnerId}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="text-emerald-400 font-semibold">
                        {placeLabel(w.place)} Place — Week {w.weekKey}
                      </div>
                      <div className="text-white/60 text-sm">
                        Expires: <span className="text-white">{new Date(w.expiresAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT</span>
                      </div>
                      <div className="text-white/60 text-sm mt-1">
                        Prize: <span className="text-emerald-400 font-mono">{microToCreditsStr(w.prizeCreditsMicro)} Special Credits</span>
                      </div>
                    </div>

                    <button
                      onClick={() => claim(w)}
                      disabled={claimBusy === w.winnerId}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 hover:bg-emerald-500/30 text-emerald-400 font-semibold transition disabled:opacity-60"
                    >
                      {claimBusy === w.winnerId ? "Claiming..." : "Claim Prize"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Redeem for Membership */}
          <div className="rounded-2xl border border-purple-500/30 bg-black/40 p-6">
            <div className="text-white font-bold text-xl mb-2">Redeem Credits for Membership</div>
            <div className="text-white/60 text-sm mb-4">
              Use your Special Credits to get free membership time.
            </div>
            <a
              href="/rewards-drawing/redeem"
              className="inline-block px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/50 hover:bg-purple-500/30 text-purple-400 font-semibold transition"
            >
              Redeem Credits
            </a>
          </div>

          {/* Rules / Compliance Notice */}
          <div className="mt-6 rounded-2xl border border-yellow-500/30 bg-yellow-900/10 p-4">
            <div className="text-yellow-400 font-semibold mb-2">Special Credits Rules</div>
            <ul className="text-white/70 text-sm space-y-1 list-disc list-inside">
              <li>Special Credits are <span className="text-white">earned in-app</span> (daily accrual based on eligibility)</li>
              <li>Credits have <span className="text-white">no cash value</span> and cannot be purchased</li>
              <li>Credits are <span className="text-white">not transferable</span> or sellable</li>
              <li>Credits cannot be converted to XESS or withdrawn</li>
              <li>Use credits for: <span className="text-white">drawing entries</span> + <span className="text-white">redeeming membership months</span></li>
            </ul>
          </div>

          {/* Refresh */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition"
            >
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
