"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import TopNav from "../components/TopNav";
import "@solana/wallet-adapter-react-ui/styles.css";

const TREASURY = process.env.NEXT_PUBLIC_SUB_TREASURY_WALLET || "";
const PRICE_SOL = parseFloat(process.env.NEXT_PUBLIC_SUB_PRICE_SOL || "0.05");

// NOWPayments hosted invoice ids (your 4 buttons)
const NOWPAYMENTS_IIDS = {
  MM: "4346120539", // Member monthly $3
  MY: "4770954653", // Member yearly $30
  DM: "6120974427", // Diamond monthly $18.5
  DY: "4296776562", // Diamond yearly $185
} as const;

const POLL_EVERY_MS = 3000;
const POLL_MAX_MS = 6 * 60 * 1000; // 6 min

type AuthStatus = {
  ok: boolean;
  authenticated: boolean;
  tier: "free" | "member" | "diamond";
  isMember: boolean;
  isDiamond: boolean;
  canComment: boolean;
  canVoteComments: boolean;
  canRateStars: boolean;
  wallet?: string;
};

function Spinner() {
  return (
    <div className="inline-flex items-center gap-2 text-white/70">
      <div className="w-4 h-4 rounded-full border border-white/20 border-t-white/70 animate-spin" />
      <span className="text-sm">Waiting for payment confirmation...</span>
    </div>
  );
}

function SubscribeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { connection } = useConnection();
  const wallet = useWallet();

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // waiting state
  const [waiting, setWaiting] = useState(false);
  const [pollMsg, setPollMsg] = useState<string>("");

  // stablecoin dropdown
  const [stableOpen, setStableOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string>("");

  const pollTimerRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  function stopPolling() {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function fetchAuthStatus(): Promise<AuthStatus | null> {
    try {
      const r = await fetch("/api/auth/status", { cache: "no-store" });
      const data = (await r.json()) as AuthStatus;
      return data;
    } catch {
      return null;
    }
  }

  function startPollingMembership() {
    stopPolling();
    pollStartRef.current = Date.now();
    setWaiting(true);

    pollTimerRef.current = window.setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_MAX_MS) {
        stopPolling();
        setPollMsg(
          "Still waiting... If you already paid, it may take a moment. Keep this tab open and it will update."
        );
        return;
      }

      const auth = await fetchAuthStatus();
      if (!auth?.ok) {
        setPollMsg("Checking your membership...");
        return;
      }

      if (auth.isMember === true) {
        stopPolling();
        setPollMsg("Membership active! Redirecting...");
        setTimeout(() => router.push("/videos"), 800);
        return;
      }

      setPollMsg("Still waiting for confirmation...");
    }, POLL_EVERY_MS);
  }

  async function handleNowPayments(plan: keyof typeof NOWPAYMENTS_IIDS) {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/billing/nowpayments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json().catch(() => null);

      if (!data?.ok || !data?.redirectUrl) {
        const iid = NOWPAYMENTS_IIDS[plan];
        window.location.href = `https://nowpayments.io/payment/?iid=${iid}`;
        return;
      }

      window.location.href = data.redirectUrl as string;
    } catch {
      const iid = NOWPAYMENTS_IIDS[plan];
      window.location.href = `https://nowpayments.io/payment/?iid=${iid}`;
    } finally {
      setLoading(false);
    }
  }

  // Auto-detect return from NOWPayments using document.referrer
  useEffect(() => {
    // If user explicitly set waiting=1, honor it
    const w = searchParams.get("waiting");
    if (w === "1") {
      setPollMsg("Checking your membership...");
      startPollingMembership();
      return;
    }

    try {
      const ref = document.referrer || "";
      const fromNowPayments = ref.includes("nowpayments.io") || ref.includes("nowpayments");

      const cameFromPayment =
        fromNowPayments ||
        window.location.href.includes("nowpayments") ||
        window.location.search.includes("paid=1");

      if (cameFromPayment) {
        setPollMsg("Welcome back - checking your membership...");
        router.replace("/subscribe?waiting=1");
        startPollingMembership();
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autolaunch NOWPayments if /subscribe?plan=MM|MY|DM|DY
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (!planParam) return;

    const plan = planParam.toUpperCase() as keyof typeof NOWPAYMENTS_IIDS;
    if (!["MM", "MY", "DM", "DY"].includes(plan)) return;

    // guard against re-render / back button double launch
    const key = `np_autolaunch_${plan}`;
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    }

    handleNowPayments(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  async function handleSubscribeSOL() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatus("Please connect your wallet first.");
      return;
    }

    if (!TREASURY) {
      setStatus("Treasury wallet not configured.");
      return;
    }

    setLoading(true);
    setStatus("Preparing transaction...");

    try {
      const lamports = Math.round(PRICE_SOL * LAMPORTS_PER_SOL);
      const treasuryPubkey = new PublicKey(TREASURY);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: treasuryPubkey,
          lamports,
        })
      );

      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = wallet.publicKey;

      setStatus("Please approve the transaction...");
      const signed = await wallet.signTransaction(tx);

      setStatus("Sending transaction...");
      const sig = await connection.sendRawTransaction(signed.serialize());

      setStatus("Confirming...");
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      setStatus("Finalizing subscription...");
      await fetch(`/subscribe/confirm?sig=${encodeURIComponent(sig)}`, { method: "POST" }).catch(
        () => null
      );

      setStatus("");
      setPollMsg("Verifying payment and activating membership...");
      router.replace("/subscribe?waiting=1");
      startPollingMembership();
    } catch (err: unknown) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("Copied to clipboard!");
      setTimeout(() => setCopyMsg(""), 1500);
    } catch {
      setCopyMsg("Copy failed (browser blocked).");
      setTimeout(() => setCopyMsg(""), 2000);
    }
  }

  const stablecoinOptions = [
    {
      label: "USDT (TRC20) - lowest fees",
      text: "USDT (TRC20) is recommended for low-cost plans (fast + low fees).",
    },
    {
      label: "USDC (Polygon) - cheap + reliable",
      text: "USDC on Polygon is recommended for low-cost plans (low fees).",
    },
    {
      label: "USDT (BSC) - low fees",
      text: "USDT on BSC is a good low-fee option for small payments.",
    },
    {
      label: "USDC (Solana) - fast",
      text: "USDC on Solana is fast; fees are low but some wallets may need SOL for gas.",
    },
  ];

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* WAITING PANEL */}
      {waiting && (
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-xl font-semibold neon-text">Waiting for payment...</h2>

          <div className="mt-3">
            <Spinner />
          </div>

          <div className="mt-3 text-sm text-white/70">
            {pollMsg || "Checking your membership..."}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => startPollingMembership()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
            >
              Refresh status
            </button>

            <button
              onClick={() => {
                stopPolling();
                setWaiting(false);
                setPollMsg("");
                router.replace("/subscribe");
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition"
            >
              Exit
            </button>
          </div>

          <div className="mt-4 text-[12px] text-white/50">
            Tip: for low-cost plans, stablecoins (USDT/USDC on TRC20/BSC/Polygon) are recommended to avoid
            coin minimums.
          </div>
        </div>
      )}

      {/* SOL PAYMENT PANEL */}
      <div className="w-full neon-border rounded-2xl p-6 bg-black/30">
        <h1 className="text-2xl font-semibold neon-text">Subscribe with SOL</h1>
        <p className="mt-2 text-sm text-white/70">
          Pay {PRICE_SOL} SOL to unlock all premium videos for 30 days.
        </p>

        <div className="mt-6 space-y-4">
          <WalletMultiButton />

          {wallet.connected && (
            <button
              onClick={handleSubscribeSOL}
              disabled={loading || waiting}
              className="w-full rounded-xl bg-pink-500 px-4 py-3 font-semibold text-black hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : waiting ? "Waiting..." : `Pay ${PRICE_SOL} SOL`}
            </button>
          )}

          {status && (
            <div className="text-sm text-white/70 bg-black/40 rounded-lg p-3 break-words">
              {status}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-white/50">
          Your subscription will activate after confirmation and webhook processing.
        </p>
      </div>

      {/* NOWPAYMENTS PANEL */}
      <div className="neon-border rounded-2xl p-6 bg-black/30">
        <h2 className="text-xl font-semibold neon-text">Subscribe with Crypto (NOWPayments)</h2>
        <p className="mt-2 text-sm text-white/70">
          Pay with USDT/USDC or many other coins. Stablecoins recommended for the $3 plan.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <button
              onClick={() => handleNowPayments("MM")}
              disabled={loading || waiting}
              className="w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-300 font-semibold hover:bg-sky-500/30 transition disabled:opacity-50"
            >
              Member - $3/mo
              <div className="text-[11px] text-white/50 font-normal mt-1">
                Stablecoins recommended
              </div>
            </button>

            {/* Copy stablecoin suggestions dropdown */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setStableOpen((v) => !v)}
                className="text-[12px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 transition w-full text-left"
              >
                Copy stablecoin suggestions {stableOpen ? "▴" : "▾"}
              </button>

              {stableOpen && (
                <div className="mt-2 neon-border rounded-xl bg-black/40 overflow-hidden">
                  {stablecoinOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => copyText(opt.text)}
                      className="w-full text-left px-3 py-2 text-[12px] text-white/80 hover:bg-white/10 transition border-b border-white/10 last:border-b-0"
                    >
                      {opt.label}
                    </button>
                  ))}

                  <div className="px-3 py-2 text-[11px] text-white/50">
                    {copyMsg || "Tap one option to copy it."}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleNowPayments("MY")}
            disabled={loading || waiting}
            className="py-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-300 font-semibold hover:bg-sky-500/30 transition disabled:opacity-50"
          >
            Member - $30/yr
          </button>

          <button
            onClick={() => handleNowPayments("DM")}
            disabled={loading || waiting}
            className="py-3 rounded-xl bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 font-semibold hover:bg-yellow-500/30 transition disabled:opacity-50"
          >
            Diamond - $18.50/mo
          </button>

          <button
            onClick={() => handleNowPayments("DY")}
            disabled={loading || waiting}
            className="py-3 rounded-xl bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 font-semibold hover:bg-yellow-500/30 transition disabled:opacity-50"
          >
            Diamond - $185/yr
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPollMsg("Checking your membership...");
              router.replace("/subscribe?waiting=1");
              startPollingMembership();
            }}
            disabled={waiting}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition disabled:opacity-50"
          >
            I&apos;ve paid - check status
          </button>

          <div className="text-[12px] text-white/50">
            After paying on NOWPayments, you&apos;ll be auto-detected on return - or click &quot;I&apos;ve paid&quot;.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 pt-8 flex justify-center">
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <Suspense fallback={<div className="text-white/50">Loading...</div>}>
                <SubscribeInner />
              </Suspense>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </div>
    </main>
  );
}
