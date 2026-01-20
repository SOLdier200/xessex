"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BuyXessTickets from "@/components/raffles/BuyXessTickets";

type RaffleType = "CREDITS" | "XESS";

type RaffleStatusResp = {
  ok: boolean;
  error?: string;
  weekKey: string;
  closesAt: string; // ISO
  creditsBalanceMicro: string;
  raffles: {
    credits: null | {
      id: string;
      status: "OPEN" | "CLOSED" | "DRAWN";
      ticketPriceMicro: string | null;
      totalTickets: string;
      yourTickets: string;
      chanceAnyPct: number;
      pools: { user: string; match: string; rollover: string; total: string };
    };
    xess: null | {
      id: string;
      status: "OPEN" | "CLOSED" | "DRAWN";
      ticketPriceAtomic: string | null;
      totalTickets: string;
      yourTickets: string;
      chanceAnyPct: number;
      pools: { user: string; match: string; rollover: string; total: string };
    };
  };
  pendingWins: Array<{
    winnerId: string;
    raffleType: RaffleType;
    weekKey: string;
    place: number;
    prizeCreditsMicro: string;
    prizeXessAtomic: string;
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

function atomicToXessStr(atomic: string) {
  try {
    const v = BigInt(atomic);
    const whole = v / 1_000_000_000n;
    const frac = v % 1_000_000_000n;
    if (frac === 0n) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return atomic;
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
 * Minimal credits ticket buyer (uses your existing API /api/raffles/buy/credits)
 */
function BuyCreditsTickets({ onSuccess }: { onSuccess: () => void }) {
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

  const buy = async () => {
    setErr(null);
    if (qtyBig <= 0n) {
      setErr("Enter a valid ticket amount.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/raffles/buy/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: qtyBig.toString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "buy_failed");
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
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-white font-semibold mb-2">Buy Credits Raffle Tickets</div>
      <div className="text-white/60 text-sm mb-3">
        Price: <span className="text-white">1 Special Credit</span> per ticket
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-28 rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white"
          inputMode="numeric"
          placeholder="1"
          disabled={busy}
        />
        <button
          onClick={buy}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition disabled:opacity-60"
        >
          {busy ? "Buying..." : "Buy Tickets"}
        </button>
      </div>

      {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
    </div>
  );
}

export default function RafflesPage() {
  const [data, setData] = useState<RaffleStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/raffles/status", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as RaffleStatusResp | null;
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

  const claim = async (w: RaffleStatusResp["pendingWins"][number]) => {
    setClaimBusy(w.winnerId);
    setErr(null);
    try {
      const endpoint =
        w.raffleType === "CREDITS" ? "/api/raffles/claim/credits" : "/api/raffles/claim/xess";

      const res = await fetch(endpoint, {
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
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Raffles</h1>
        <div className="mt-2 text-white/60">
          Weekly raffles close every <span className="text-white">Sunday 11:59pm PT</span>. Unclaimed
          prizes roll into the next week's pot.
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-white/70">
          Loading raffles…
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

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-white/60 text-sm">Your Special Credits</div>
              <div className="text-white font-semibold text-lg">{creditsBalance}</div>
              <div className="mt-2 text-white/50 text-xs">
                (Credits are stored precisely; decimals are normal.)
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-white/60 text-sm">How winners are picked</div>
              <div className="text-white/80 text-sm mt-1">
                More tickets = more entries. We show only your <span className="text-white">chance to win any prize</span>.
              </div>
              <div className="text-white/50 text-xs mt-2">
                Prizes: 1st / 2nd / 3rd. Unclaimed prizes roll over.
              </div>
            </div>
          </div>

          {/* Raffles */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Credits raffle */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <div className="flex items-center justify-between">
                <div className="text-white font-bold text-xl">Special Credits Raffle</div>
                <div className="text-white/60 text-sm">{data.raffles.credits?.status ?? "—"}</div>
              </div>

              {data.raffles.credits ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-sm">Your tickets</div>
                      <div className="text-white font-semibold">{fmtInt(data.raffles.credits.yourTickets)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-sm">Total tickets</div>
                      <div className="text-white font-semibold">{fmtInt(data.raffles.credits.totalTickets)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 col-span-2">
                      <div className="text-white/60 text-sm">Chance to win any prize</div>
                      <div className="text-white font-extrabold text-2xl">
                        {data.raffles.credits.chanceAnyPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/60 text-sm mb-2">Prize pool (credits)</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-white/60">User pool</div>
                      <div className="text-white text-right">{microToCreditsStr(data.raffles.credits.pools.user)}</div>
                      <div className="text-white/60">System match</div>
                      <div className="text-white text-right">{microToCreditsStr(data.raffles.credits.pools.match)}</div>
                      <div className="text-white/60">Rollover</div>
                      <div className="text-white text-right">{microToCreditsStr(data.raffles.credits.pools.rollover)}</div>
                      <div className="text-white/60 font-semibold">Total</div>
                      <div className="text-white text-right font-semibold">{microToCreditsStr(data.raffles.credits.pools.total)}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <BuyCreditsTickets onSuccess={refetch} />
                  </div>
                </>
              ) : (
                <div className="mt-4 text-white/60">Credits raffle not available.</div>
              )}
            </div>

            {/* XESS raffle */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <div className="flex items-center justify-between">
                <div className="text-white font-bold text-xl">XESS Raffle</div>
                <div className="text-white/60 text-sm">{data.raffles.xess?.status ?? "—"}</div>
              </div>

              {data.raffles.xess ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-sm">Your tickets</div>
                      <div className="text-white font-semibold">{fmtInt(data.raffles.xess.yourTickets)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="text-white/60 text-sm">Total tickets</div>
                      <div className="text-white font-semibold">{fmtInt(data.raffles.xess.totalTickets)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 col-span-2">
                      <div className="text-white/60 text-sm">Chance to win any prize</div>
                      <div className="text-white font-extrabold text-2xl">
                        {data.raffles.xess.chanceAnyPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-white/60 text-sm mb-2">Prize pool (XESS)</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-white/60">User pool</div>
                      <div className="text-white text-right">{atomicToXessStr(data.raffles.xess.pools.user)}</div>
                      <div className="text-white/60">System match</div>
                      <div className="text-white text-right">{atomicToXessStr(data.raffles.xess.pools.match)}</div>
                      <div className="text-white/60">Rollover</div>
                      <div className="text-white text-right">{atomicToXessStr(data.raffles.xess.pools.rollover)}</div>
                      <div className="text-white/60 font-semibold">Total</div>
                      <div className="text-white text-right font-semibold">{atomicToXessStr(data.raffles.xess.pools.total)}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <BuyXessTickets onSuccess={refetch} />
                  </div>
                </>
              ) : (
                <div className="mt-4 text-white/60">XESS raffle not available.</div>
              )}
            </div>
          </div>

          {/* Pending prizes */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="text-white font-bold text-xl">Your prizes</div>
            <div className="text-white/60 text-sm mt-1">
              You must claim before expiry. Unclaimed prizes roll into the next week's pot.
            </div>

            {data.pendingWins.length === 0 ? (
              <div className="mt-4 text-white/60">No pending prizes right now.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.pendingWins.map((w) => (
                  <div
                    key={w.winnerId}
                    className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="text-white font-semibold">
                        {w.raffleType === "CREDITS" ? "Credits Raffle" : "XESS Raffle"} — {placeLabel(w.place)}
                      </div>
                      <div className="text-white/60 text-sm">
                        Expires: <span className="text-white">{new Date(w.expiresAt).toLocaleString()}</span>
                      </div>
                      <div className="text-white/60 text-sm mt-1">
                        Prize:{" "}
                        {w.raffleType === "CREDITS" ? (
                          <span className="text-white font-mono">{microToCreditsStr(w.prizeCreditsMicro)} credits</span>
                        ) : (
                          <span className="text-white font-mono">{atomicToXessStr(w.prizeXessAtomic)} XESS</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => claim(w)}
                      disabled={claimBusy === w.winnerId}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition disabled:opacity-60"
                    >
                      {claimBusy === w.winnerId ? "Claiming..." : "Claim prize"}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
