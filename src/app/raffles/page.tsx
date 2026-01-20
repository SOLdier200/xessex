"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import TopNav from "../components/TopNav";
import BuyXessTickets from "@/components/raffles/BuyXessTickets";

type RaffleStatusResponse = {
  ok: boolean;
  weekKey: string;
  closesAt: string;
  user: {
    id: string;
    tier: string;
    isDiamond: boolean;
    hasLinkedWallet: boolean;
    creditBalance: string;
    creditBalanceFormatted: string;
  } | null;
  credits: {
    id: string;
    status: string;
    userPoolAtomic: string;
    matchPoolAtomic: string;
    rolloverAtomic: string;
    totalPoolAtomic: string;
    totalPoolFormatted: string;
    prizes: { first: string; second: string; third: string };
    totalTickets: number;
    totalUsers: number;
    userTickets: number;
    winProbability: number;
    winProbabilityFormatted: string;
    ticketPriceMicro: string;
  };
  xess: {
    id: string;
    status: string;
    userPoolAtomic: string;
    matchPoolAtomic: string;
    rolloverAtomic: string;
    totalPoolAtomic: string;
    totalPoolFormatted: string;
    prizes: { first: string; second: string; third: string };
    totalTickets: number;
    totalUsers: number;
    userTickets: number;
    winProbability: number;
    winProbabilityFormatted: string;
    ticketPriceAtomic: string;
  };
  pendingWins: Array<{
    winnerId: string;
    raffleType: string;
    weekKey: string;
    place: number;
    prizeCreditsMicro: string;
    prizeXessAtomic: string;
    expiresAt: string;
  }>;
  previousWinners: Array<{
    weekKey: string;
    type: string;
    place: number;
    prizeAtomic: string;
    status: string;
    displayName: string;
  }>;
};

function formatCountdown(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) return "Closed";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatMicroCredits(micro: string): string {
  const val = Number(micro) / 1000;
  if (val === Math.floor(val)) return val.toFixed(0);
  return val.toFixed(2);
}

function formatXessAtomic(atomic: string): string {
  const val = Number(atomic) / 1_000_000_000;
  if (val === Math.floor(val)) return val.toFixed(0);
  return val.toFixed(2);
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function RafflesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RaffleStatusResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"credits" | "xess">("credits");
  const [countdown, setCountdown] = useState("");
  const [buying, setBuying] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [ticketAmount, setTicketAmount] = useState(1);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/raffles/status", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch {
      console.error("Failed to fetch raffle status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Update countdown every second
  useEffect(() => {
    if (!data?.closesAt) return;

    const updateCountdown = () => {
      setCountdown(formatCountdown(new Date(data.closesAt)));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data?.closesAt]);

  async function handleBuyCreditsTickets() {
    if (!data?.user?.isDiamond) {
      toast.error("Diamond membership required");
      return;
    }

    setBuying(true);
    try {
      const res = await fetch("/api/raffles/buy/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: ticketAmount }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success(`Purchased ${ticketAmount} ticket${ticketAmount > 1 ? "s" : ""}`);
        await fetchStatus();
        setTicketAmount(1);
      } else {
        toast.error(json.message || json.error || "Failed to buy tickets");
      }
    } catch {
      toast.error("Failed to buy tickets");
    } finally {
      setBuying(false);
    }
  }

  async function handleClaimCredits(winnerId: string) {
    setClaiming(winnerId);
    try {
      const res = await fetch("/api/raffles/claim/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success("Prize claimed successfully!");
        await fetchStatus();
      } else {
        toast.error(json.message || json.error || "Failed to claim prize");
      }
    } catch {
      toast.error("Failed to claim prize");
    } finally {
      setClaiming(null);
    }
  }

  async function handleClaimXess(winnerId: string) {
    setClaiming(winnerId);
    try {
      const res = await fetch("/api/raffles/claim/xess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success("XESS prize claimed! Check your wallet.");
        await fetchStatus();
      } else {
        toast.error(json.message || json.error || "Failed to claim prize");
      }
    } catch {
      toast.error("Failed to claim prize");
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNav />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      </div>
    );
  }

  const raffle = activeTab === "credits" ? data?.credits : data?.xess;
  const pendingWins = data?.pendingWins?.filter((w) =>
    activeTab === "credits" ? w.raffleType === "CREDITS" : w.raffleType === "XESS"
  ) || [];

  const maxTickets = activeTab === "credits" && data?.user
    ? Math.floor(Number(data.user.creditBalance) / Number(data.credits.ticketPriceMicro))
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Weekly Raffles</h1>
        <p className="text-white/60 mb-8">
          Win credits or XESS tokens every week! Diamond members can buy tickets with Special Credits.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("credits")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "credits"
                ? "bg-purple-600 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            Credits Raffle
          </button>
          <button
            onClick={() => setActiveTab("xess")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "xess"
                ? "bg-purple-600 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            XESS Raffle
          </button>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Raffle Info */}
          <div className="space-y-6">
            {/* Countdown Card */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-6 border border-purple-500/30">
              <div className="text-sm text-white/60 mb-1">Week {data?.weekKey}</div>
              <div className="text-2xl font-bold mb-2">Time Remaining</div>
              <div className="text-4xl font-mono font-bold text-purple-300">{countdown}</div>
              <div className="text-sm text-white/50 mt-2">
                Closes: {data?.closesAt ? new Date(data.closesAt).toLocaleString() : "..."}
              </div>
            </div>

            {/* Prize Pool Card */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold mb-4">Prize Pool</h3>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-white/60">User Pool</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.userPoolAtomic || "0")
                      : formatXessAtomic(raffle?.userPoolAtomic || "0")}{" "}
                    {activeTab === "credits" ? "Credits" : "XESS"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Match Pool</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.matchPoolAtomic || "0")
                      : formatXessAtomic(raffle?.matchPoolAtomic || "0")}{" "}
                    {activeTab === "credits" ? "Credits" : "XESS"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Rollover</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.rolloverAtomic || "0")
                      : formatXessAtomic(raffle?.rolloverAtomic || "0")}{" "}
                    {activeTab === "credits" ? "Credits" : "XESS"}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span>Total Pool</span>
                  <span className="text-purple-300">{raffle?.totalPoolFormatted || "0"}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-yellow-400">1st Place (50%)</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.prizes.first || "0")
                      : formatXessAtomic(raffle?.prizes.first || "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">2nd Place (30%)</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.prizes.second || "0")
                      : formatXessAtomic(raffle?.prizes.second || "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600">3rd Place (20%)</span>
                  <span>
                    {activeTab === "credits"
                      ? formatMicroCredits(raffle?.prizes.third || "0")
                      : formatXessAtomic(raffle?.prizes.third || "0")}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{raffle?.totalTickets || 0}</div>
                  <div className="text-sm text-white/60">Total Tickets</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{raffle?.totalUsers || 0}</div>
                  <div className="text-sm text-white/60">Participants</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - User Actions */}
          <div className="space-y-6">
            {/* User Status Card */}
            {data?.user ? (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold mb-4">Your Status</h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Membership</span>
                    <span
                      className={`font-medium ${
                        data.user.isDiamond ? "text-purple-400" : "text-white/70"
                      }`}
                    >
                      {data.user.tier.toUpperCase()}
                    </span>
                  </div>

                  {activeTab === "credits" && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Credit Balance</span>
                      <span className="font-medium">{data.user.creditBalanceFormatted} Credits</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-white/60">Your Tickets</span>
                    <span className="font-medium">{raffle?.userTickets || 0}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-white/60">Win Chance</span>
                    <span className="font-medium text-green-400">
                      {raffle?.winProbabilityFormatted || "0%"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
                <p className="text-white/60 mb-4">Sign in to participate in raffles</p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Buy Tickets Card */}
            {data?.user && activeTab === "credits" && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold mb-4">Buy Tickets</h3>

                {!data.user.isDiamond ? (
                  <div className="text-center py-4">
                    <p className="text-white/60 mb-4">Diamond membership required to buy tickets</p>
                    <Link
                      href="/signup"
                      className="inline-block px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                    >
                      Upgrade to Diamond
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => setTicketAmount(Math.max(1, ticketAmount - 1))}
                        className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        disabled={buying}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={ticketAmount}
                        onChange={(e) =>
                          setTicketAmount(
                            Math.min(Math.max(1, parseInt(e.target.value) || 1), maxTickets || 1000)
                          )
                        }
                        className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-center font-medium"
                        min={1}
                        max={maxTickets || 1000}
                      />
                      <button
                        onClick={() => setTicketAmount(Math.min(ticketAmount + 1, maxTickets || 1000))}
                        className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        disabled={buying}
                      >
                        +
                      </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                      {[1, 10, 100].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTicketAmount(Math.min(n, maxTickets || n))}
                          className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                          disabled={buying}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setTicketAmount(maxTickets || 1)}
                        className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                        disabled={buying || maxTickets === 0}
                      >
                        Max
                      </button>
                    </div>

                    <div className="text-sm text-white/60 mb-4">
                      Cost: {ticketAmount} credit{ticketAmount !== 1 ? "s" : ""} (Max: {maxTickets})
                    </div>

                    <button
                      onClick={handleBuyCreditsTickets}
                      disabled={buying || maxTickets === 0 || raffle?.status !== "OPEN"}
                      className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/40 font-medium transition-colors"
                    >
                      {buying ? "Buying..." : "Buy Tickets"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* XESS Raffle - Buy Tickets */}
            {activeTab === "xess" && (
              <BuyXessTickets onSuccess={fetchStatus} />
            )}

            {/* Pending Wins */}
            {pendingWins.length > 0 && (
              <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-xl p-6 border border-yellow-500/30">
                <h3 className="text-lg font-semibold mb-4 text-yellow-400">
                  Unclaimed Prizes!
                </h3>

                <div className="space-y-3">
                  {pendingWins.map((win) => (
                    <div key={win.winnerId} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                      <div>
                        <div className="font-medium">{getOrdinal(win.place)} Place</div>
                        <div className="text-sm text-white/60">
                          {activeTab === "credits"
                            ? formatMicroCredits(win.prizeCreditsMicro)
                            : formatXessAtomic(win.prizeXessAtomic)}{" "}
                          {activeTab === "credits" ? "Credits" : "XESS"}
                        </div>
                        <div className="text-xs text-white/40">
                          Week: {win.weekKey} &middot; Expires: {new Date(win.expiresAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          activeTab === "credits"
                            ? handleClaimCredits(win.winnerId)
                            : handleClaimXess(win.winnerId)
                        }
                        disabled={claiming !== null}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-white/10 rounded-lg font-medium transition-colors"
                      >
                        {claiming === win.winnerId ? "..." : "Claim"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Previous Winners */}
        {data?.previousWinners && data.previousWinners.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Recent Winners</h2>

            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-white/60 font-medium">Week</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium">Place</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium">Winner</th>
                    <th className="text-right px-4 py-3 text-white/60 font-medium">Prize</th>
                    <th className="text-right px-4 py-3 text-white/60 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.previousWinners.map((w, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm">{w.weekKey}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            w.type === "CREDITS" ? "bg-purple-600/30 text-purple-300" : "bg-blue-600/30 text-blue-300"
                          }`}
                        >
                          {w.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            w.place === 1
                              ? "text-yellow-400"
                              : w.place === 2
                                ? "text-gray-400"
                                : "text-amber-600"
                          }`}
                        >
                          {getOrdinal(w.place)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{w.displayName}</td>
                      <td className="px-4 py-3 text-right">
                        {w.type === "CREDITS"
                          ? formatMicroCredits(w.prizeAtomic)
                          : formatXessAtomic(w.prizeAtomic)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            w.status === "CLAIMED"
                              ? "bg-green-600/30 text-green-300"
                              : w.status === "EXPIRED"
                                ? "bg-red-600/30 text-red-300"
                                : "bg-yellow-600/30 text-yellow-300"
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-semibold mb-4">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-white/70">
            <div>
              <div className="text-white font-medium mb-2">1. Get Credits</div>
              <p>
                Diamond members earn Special Credits daily based on their XESS holdings.
                Higher holdings = more credits per day.
              </p>
            </div>
            <div>
              <div className="text-white font-medium mb-2">2. Buy Tickets</div>
              <p>
                Use your credits to buy raffle tickets. Each ticket costs 1 credit.
                More tickets = higher chance to win.
              </p>
            </div>
            <div>
              <div className="text-white font-medium mb-2">3. Win Prizes</div>
              <p>
                Winners are drawn every Sunday night. Top 3 win 50%, 30%, and 20% of the pool.
                Claim within 7 days or prizes roll over.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
