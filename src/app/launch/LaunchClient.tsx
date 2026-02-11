"use client";

import * as React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import RoadmapMarquee from "@/app/components/RoadmapMarquee";
import TopNav from "@/app/components/TopNav";
import PythPriceTicker from "@/components/PythPriceTicker";
import { fetchPresale } from "@/lib/fetchByHost";

// Treasury addresses
const TREASURY_SOL = "FuG1tCeK53s17nQxvNcpKKo5bvESnPdHduhemHLu7aeS";
const TREASURY_USDC_ATA = "ADcttJuZHpXjsdHgsKVQ1iGRbrBPrCF5U55Feg8eeCAE";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Mainnet USDC

// RPC endpoint (same as providers.tsx)
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

type SaleConfig = {
  ok: boolean;
  activePhase: "private" | "public" | "closed";
  totalSupplyXess: string;
  saleAllocationXess: string;
  privateAllocation: string;
  publicAllocation: string;
  walletCapXess: string;
  soldPrivateXess: string;
  soldPublicXess: string;
  privatePriceUsdMicros: string;
  publicPriceUsdMicros: string;
  privateLamportsPerXess: string;
  publicLamportsPerXess: string;
  solPriceUsd: number | null;
  computedPrivateLamportsPerXess: string | null;
  computedPublicLamportsPerXess: string | null;
  privateStartsAt: string | null;
  privateEndsAt: string | null;
  publicStartsAt: string | null;
  publicEndsAt: string | null;
  acceptedAssets: Array<"SOL" | "USDC">;
};

type WalletContribution = {
  id: string;
  phase: string;
  asset: string;
  xessAmount: string;
  paidLamports: string | null;
  paidUsdcAtomic: string | null;
  txSig: string | null;
  status: string;
  createdAt: string;
};

type WalletStatus = {
  ok: boolean;
  wallet: string;
  walletCapXess: string;
  totalAllocatedXess: string;
  remainingCapXess: string;
  atCap: boolean;
  contributions?: WalletContribution[];
};

type WhitelistProof = {
  ok: boolean;
  rootHex: string | null;
  proofHex: string[] | null;
  whitelisted: boolean;
};

// Merkle verification helpers
async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hash);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function sortPair(a: Uint8Array, b: Uint8Array): [Uint8Array, Uint8Array] {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? [a, b] : [b, a];
  }
  return a.length <= b.length ? [a, b] : [b, a];
}

async function verifyMerkle({
  wallet,
  rootHex,
  proofHex,
}: {
  wallet: string;
  rootHex: string;
  proofHex: string[];
}): Promise<boolean> {
  const leafBytes = new TextEncoder().encode(wallet.toLowerCase());
  let acc = await sha256(leafBytes);

  for (const p of proofHex) {
    const pb = hexToBytes(p);
    const [x, y] = sortPair(acc, pb);
    acc = await sha256(concat(x, y));
  }

  return bytesToHex(acc) === rootHex.toLowerCase().replace(/^0x/, "");
}

function microsToUsd(m: string): string {
  const n = Number(m) / 1_000_000;
  return "$" + n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatNumber(n: string | bigint): string {
  return BigInt(n).toLocaleString();
}

export default function LaunchClient() {
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [cfg, setCfg] = React.useState<SaleConfig | null>(null);
  const [walletStatus, setWalletStatus] = React.useState<WalletStatus | null>(null);
  const [whitelistProof, setWhitelistProof] = React.useState<WhitelistProof | null>(null);
  const [isEligible, setIsEligible] = React.useState<boolean | null>(null);

  const [asset, setAsset] = React.useState<"SOL" | "USDC">("SOL");
  const [amount, setAmount] = React.useState("");
  const [xessPreview, setXessPreview] = React.useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [solPrice, setSolPrice] = React.useState<number | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Last successful purchase receipt
  const [lastReceipt, setLastReceipt] = React.useState<{
    txSig: string;
    xessAmount: string;
    asset: "SOL" | "USDC";
    paid: string;
  } | null>(null);

  // Check admin status
  React.useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d?.user?.role === "ADMIN") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  // Fetch sale config
  React.useEffect(() => {
    fetch(presaleUrl("/api/sale/config"))
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCfg(data);
      })
      .catch(() => setCfg(null));
  }, []);

  // Fetch SOL price from Pyth proxy with 30s refresh
  React.useEffect(() => {
    function fetchSolPrice() {
      fetch(presaleUrl("/api/pyth/prices"))
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.SOL_USD?.price) setSolPrice(data.SOL_USD.price);
        })
        .catch(() => {});
    }
    fetchSolPrice();
    const iv = setInterval(fetchSolPrice, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Fetch wallet status when connected
  React.useEffect(() => {
    if (!wallet.publicKey) {
      setWalletStatus(null);
      setWhitelistProof(null);
      setIsEligible(null);
      return;
    }

    const walletStr = wallet.publicKey.toBase58();

    // Fetch wallet status
    fetch(presaleUrl(`/api/sale/wallet-status?wallet=${walletStr}`))
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setWalletStatus(data);
      })
      .catch(() => setWalletStatus(null));

    // Fetch whitelist proof if private phase
    if (cfg?.activePhase === "private") {
      fetch(presaleUrl(`/api/sale/whitelist-proof?wallet=${walletStr}`))
        .then((r) => r.json())
        .then(async (data: WhitelistProof) => {
          setWhitelistProof(data);
          if (data.ok && data.proofHex && data.rootHex) {
            const verified = await verifyMerkle({
              wallet: walletStr,
              rootHex: data.rootHex,
              proofHex: data.proofHex,
            });
            setIsEligible(verified);
          } else {
            setIsEligible(false);
          }
        })
        .catch(() => {
          setWhitelistProof(null);
          setIsEligible(false);
        });
    } else if (cfg?.activePhase === "public") {
      setIsEligible(true);
    } else {
      setIsEligible(false);
    }
  }, [wallet.publicKey, cfg?.activePhase]);

  // Calculate XESS preview based on amount input
  // Uses exact rates from config for accurate on-chain verification
  React.useEffect(() => {
    if (!cfg || !amount) {
      setXessPreview(null);
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setXessPreview(null);
      return;
    }

    let xessAmount: bigint;

    if (asset === "SOL") {
      // For SOL: use live-computed lamportsPerXess from Pyth, fall back to DB value
      const lamports = BigInt(Math.floor(numAmount * LAMPORTS_PER_SOL));
      const computedLpx = cfg.activePhase === "private"
        ? cfg.computedPrivateLamportsPerXess
        : cfg.computedPublicLamportsPerXess;
      const lamportsPerXess = computedLpx
        ? BigInt(computedLpx)
        : cfg.activePhase === "private"
          ? BigInt(cfg.privateLamportsPerXess)
          : BigInt(cfg.publicLamportsPerXess);

      if (lamportsPerXess === 0n) {
        setXessPreview(null);
        return;
      }
      xessAmount = lamports / lamportsPerXess;
    } else {
      // For USDC: xessAmount = (usdcAtomic * 1_000_000) / priceUsdMicros
      const usdcAtomic = BigInt(Math.floor(numAmount * 1_000_000));
      const priceUsdMicros = cfg.activePhase === "private"
        ? BigInt(cfg.privatePriceUsdMicros)
        : BigInt(cfg.publicPriceUsdMicros);

      if (priceUsdMicros === 0n) {
        setXessPreview(null);
        return;
      }
      xessAmount = (usdcAtomic * 1_000_000n) / priceUsdMicros;
    }

    setXessPreview(xessAmount.toString());
  }, [cfg, amount, asset, solPrice]);

  // Handle contribution
  async function handleContribute() {
    if (!wallet.publicKey || !wallet.signTransaction || !cfg || !amount) {
      toast.error("Please connect your wallet and enter an amount");
      return;
    }

    if (!TREASURY_SOL || !TREASURY_USDC_ATA) {
      toast.error("Treasury not configured");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    if (!xessPreview || BigInt(xessPreview) <= 0n) {
      toast.error("Could not calculate XESS amount");
      return;
    }

    // Check cap
    if (walletStatus?.atCap) {
      toast.error("You have reached your wallet cap");
      return;
    }

    const remainingCap = walletStatus ? BigInt(walletStatus.remainingCapXess) : BigInt(cfg.walletCapXess);
    if (BigInt(xessPreview) > remainingCap) {
      toast.error(`Exceeds your remaining cap of ${formatNumber(remainingCap)} XESS`);
      return;
    }

    setIsSubmitting(true);

    try {
      const connection = new Connection(RPC_ENDPOINT, "confirmed");
      const walletPubkey = wallet.publicKey;

      let tx: Transaction;
      let paidLamports: bigint | null = null;
      let paidUsdcAtomic: bigint | null = null;

      if (asset === "SOL") {
        // SOL transfer
        const lamports = BigInt(Math.floor(numAmount * LAMPORTS_PER_SOL));
        paidLamports = lamports;

        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: walletPubkey,
            toPubkey: new PublicKey(TREASURY_SOL),
            lamports,
          })
        );
      } else {
        // USDC transfer
        const usdcAtomic = BigInt(Math.floor(numAmount * 1_000_000));
        paidUsdcAtomic = usdcAtomic;

        const usdcMint = new PublicKey(USDC_MINT);
        const senderAta = getAssociatedTokenAddressSync(usdcMint, walletPubkey);
        const treasuryAta = new PublicKey(TREASURY_USDC_ATA);

        tx = new Transaction().add(
          createTransferInstruction(
            senderAta,
            treasuryAta,
            walletPubkey,
            usdcAtomic,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = walletPubkey;

      // Sign and send
      const signed = await wallet.signTransaction(tx);
      const txSig = await connection.sendRawTransaction(signed.serialize());

      // Wait for confirmation
      toast.loading("Confirming transaction...", { id: "tx" });
      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      });
      toast.dismiss("tx");

      // Submit contribution to backend with on-chain verification
      const res = await fetch(presaleUrl("/api/sale/contribute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Important: send session cookie
        body: JSON.stringify({
          phase: cfg.activePhase,
          asset,
          xessAmount: xessPreview,
          txSig,
          whitelistProofHex: whitelistProof?.proofHex,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        toast.success(`Contribution verified! ${formatNumber(xessPreview)} XESS allocated`);
        setLastReceipt({
          txSig,
          xessAmount: xessPreview,
          asset,
          paid: amount,
        });
        setAmount("");

        // Refresh wallet status
        const statusRes = await fetch(presaleUrl(`/api/sale/wallet-status?wallet=${walletPubkey.toBase58()}`));
        const statusData = await statusRes.json();
        if (statusData.ok) setWalletStatus(statusData);

        // Refresh config to update sold amounts
        const cfgRes = await fetch(presaleUrl("/api/sale/config"));
        const cfgData = await cfgRes.json();
        if (cfgData.ok) setCfg(cfgData);
      } else {
        // Show more descriptive error messages
        const errorMessages: Record<string, string> = {
          unauthorized: "Please sign in with your wallet first",
          phase_not_active: "This sale phase is not currently active",
          not_whitelisted: "Your wallet is not on the whitelist for this phase",
          cap_exceeded: `You've exceeded your wallet cap (${data.cap ? formatNumber(data.cap) : "10M"} XESS)`,
          sold_out: "This phase is sold out",
          tx_too_old_or_unconfirmed: "Transaction too old or not confirmed. Please try again.",
          tx_not_found: "Transaction not found. Please wait and try again.",
          payment_not_verified: "Payment could not be verified on-chain. Check amount and destination.",
          tx_already_used: "This transaction has already been used",
        };
        toast.error(errorMessages[data.error] || data.error || "Contribution failed");
      }
    } catch (err) {
      console.error("Contribution error:", err);
      toast.error("Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const phase = cfg?.activePhase;
  const isClosed = phase === "closed";
  const isPrivate = phase === "private";
  const canParticipate = wallet.connected && isEligible && !isClosed && !walletStatus?.atCap;

  return (
    <main className="min-h-screen bg-black text-white">
      <TopNav />

      {/* Live price ticker (Pyth) */}
      <div className="mx-auto max-w-6xl px-4 pt-3 pb-1">
        <PythPriceTicker refreshMs={2500} />
      </div>

      <section className="mx-auto max-w-6xl px-4 pt-6 pb-10">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1>
                <Image
                  src="/logos/textlogo/siteset3/TokenLaunch100.png"
                  alt="XESS Token Launch"
                  width={400}
                  height={100}
                  className="h-[50px] w-auto"
                />
              </h1>
              {isAdmin && (
                <Link
                  href="/admin/presale"
                  className="px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition text-sm"
                >
                  Presale Admin
                </Link>
              )}
            </div>
            <div className="mt-2">
              <Image
                src="/logos/1,000,000,000Xess100.png"
                alt="1,000,000,000 XESS Total Supply"
                width={938}
                height={276}
                className="h-[40px] w-auto"
              />
            </div>
            <p className="max-w-2xl text-sm text-white/70">
              XESS is a transferable utility token used for rewards and progression qualification.
              It is not required for platform access or use. Tokens are delivered immediately upon purchase with no vesting.
            </p>
          </div>

          {/* Sale Panel */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Sale Details */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-medium">Sale Details</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                <Row k="Phase" v={cfg ? phase?.toUpperCase() || "—" : "Loading..."} />
                <Row
                  k="Price (USD)"
                  v={!cfg ? "—" : isPrivate
                    ? microsToUsd(cfg.privatePriceUsdMicros)
                    : microsToUsd(cfg.publicPriceUsdMicros)
                  }
                />
                <Row k="Wallet Cap" v={cfg ? `${formatNumber(cfg.walletCapXess)} XESS` : "—"} />
                <Row
                  k="Remaining"
                  v={!cfg ? "—" : isPrivate
                    ? `${formatNumber(BigInt(cfg.privateAllocation) - BigInt(cfg.soldPrivateXess))} XESS`
                    : `${formatNumber(BigInt(cfg.publicAllocation) - BigInt(cfg.soldPublicXess))} XESS`
                  }
                />
                <Row k="Accepted" v="SOL + USDC" />
                <Row k="Vesting" v="None - Immediate delivery" />
                <CopyRow label="Mint" value="HvfmE1stqxvBfUXtKX4L4w3BeMMjcDM48Qh6ZfGtgrpE" />
                <CopyRow label="Treasury" value="FuG1tCeK53s17nQxvNcpKKo5bvESnPdHduhemHLu7aeS" />
                <CopyRow label="Treasury ATA" value="JE5hwKVw1YAiQC2vpkFWN1mstfgHgmrfvBXTDHQr2iwj" />
                <CopyRow label="USDC ATA" value="ADcttJuZHpXjsdHgsKVQ1iGRbrBPrCF5U55Feg8eeCAE" />
              </div>

              {/* Progress bar */}
              {cfg && (
                <div className="mt-6">
                  <div className="flex justify-between text-xs text-white/60 mb-2">
                    <span>Sold</span>
                    <span>
                      {isPrivate
                        ? `${formatNumber(cfg.soldPrivateXess)} / ${formatNumber(cfg.privateAllocation)}`
                        : `${formatNumber(cfg.soldPublicXess)} / ${formatNumber(cfg.publicAllocation)}`
                      }
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                      style={{
                        width: `${Math.min(100, Number(
                          isPrivate
                            ? (BigInt(cfg.soldPrivateXess) * 100n / BigInt(cfg.privateAllocation))
                            : (BigInt(cfg.soldPublicXess) * 100n / BigInt(cfg.publicAllocation))
                        ))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Participate Panel */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-medium">Participate</h2>

              {/* Wallet Connection */}
              <div className="mt-4 flex items-center justify-center">
                {wallet.connected ? (
                  <div
                    className={`rounded-lg p-[1px] ${
                      wallet.wallet?.adapter.name === "Phantom"
                        ? "bg-gradient-to-r from-purple-500 to-purple-400"
                        : wallet.wallet?.adapter.name === "Solflare"
                        ? "bg-gradient-to-r from-yellow-500 to-orange-400"
                        : "bg-gradient-to-r from-cyan-500 to-purple-500"
                    }`}
                  >
                    <WalletMultiButton className="!rounded-[6px] !bg-black/90 !px-2.5 !py-1 !text-xs !text-white/90 hover:!bg-black/70 !border-0 !font-medium !transition-all !duration-200" />
                  </div>
                ) : (
                  <button
                    onClick={() => setWalletModalVisible(true)}
                    className="rounded-full p-[2px] bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                  >
                    <div className="rounded-full bg-black/90 px-6 py-3 flex items-center justify-center">
                      <Image
                        src="/logos/textlogo/siteset3/Connect.png"
                        alt="Connect Wallet"
                        width={200}
                        height={60}
                        className="h-[32px] w-auto"
                      />
                    </div>
                  </button>
                )}
              </div>

              {/* Eligibility Status */}
              {wallet.connected && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Eligibility</span>
                    {isEligible === null ? (
                      <span className="text-white/50">Checking...</span>
                    ) : isEligible ? (
                      <span className="text-green-400">Eligible</span>
                    ) : isPrivate ? (
                      <span className="text-yellow-400">Not on whitelist</span>
                    ) : (
                      <span className="text-red-400">Sale closed</span>
                    )}
                  </div>
                  {walletStatus && (
                    <>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-white/60">Your Allocation</span>
                        <span className="text-white/90">{formatNumber(walletStatus.totalAllocatedXess)} XESS</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-white/60">Remaining Cap</span>
                        <span className={walletStatus.atCap ? "text-red-400" : "text-white/90"}>
                          {walletStatus.atCap ? "At cap" : `${formatNumber(walletStatus.remainingCapXess)} XESS`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Purchase History */}
              {wallet.connected && walletStatus?.contributions && walletStatus.contributions.length > 0 && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <h3 className="text-sm font-medium text-white/80 mb-2">Your Purchases</h3>
                  <div className="space-y-2">
                    {walletStatus.contributions.map((c) => (
                      <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-medium">{formatNumber(c.xessAmount)} XESS</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            c.status === "CONFIRMED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : c.status === "PENDING"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "bg-red-500/20 text-red-300"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-white/50">
                          <span>
                            {c.asset === "SOL" && c.paidLamports
                              ? `${(Number(c.paidLamports) / 1e9).toFixed(4)} SOL`
                              : c.asset === "USDC" && c.paidUsdcAtomic
                              ? `$${(Number(c.paidUsdcAtomic) / 1e6).toFixed(2)} USDC`
                              : c.asset}
                          </span>
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {c.txSig && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-white/40">TxID:</span>
                            <a
                              href={`https://solscan.io/tx/${c.txSig}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-cyan-400 hover:text-cyan-300 transition truncate"
                            >
                              {c.txSig.slice(0, 16)}...{c.txSig.slice(-6)}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.txSig!);
                                toast.success("TxID copied!");
                              }}
                              className="shrink-0 text-white/40 hover:text-white/70 transition"
                              title="Copy TxID"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contribution Form */}
              {wallet.connected && canParticipate && (
                <div className="mt-4 space-y-3">
                  {/* Asset Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        asset === "SOL"
                          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setAsset("SOL")}
                    >
                      Pay with SOL
                    </button>
                    <button
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        asset === "USDC"
                          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setAsset("USDC")}
                    >
                      Pay with USDC
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <label className="text-xs text-white/60">
                      Amount to contribute ({asset})
                      {asset === "SOL" && solPrice && (
                        <span className="ml-2 text-white/40">≈ ${solPrice.toFixed(2)}/SOL</span>
                      )}
                    </label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={asset === "SOL" ? "e.g. 2.5" : "e.g. 250"}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-500/50"
                      type="number"
                      step="any"
                      min="0"
                    />

                    {/* XESS Preview */}
                    {xessPreview && (
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-white/60">You will receive</span>
                        <span className="text-cyan-400 font-medium">{formatNumber(xessPreview)} XESS</span>
                      </div>
                    )}

                    <button
                      onClick={handleContribute}
                      disabled={isSubmitting || !amount || !xessPreview}
                      className="mt-4 w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/20 px-4 py-3 text-sm text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Processing..." : "Contribute"}
                    </button>

                    <p className="mt-2 text-xs text-white/50">
                      {isPrivate
                        ? "Private sale requires whitelist approval. Wallet caps enforced."
                        : "Public sale is open to all. Wallet caps enforced."}
                    </p>
                  </div>
                </div>
              )}

              {/* Transaction Receipt */}
              {lastReceipt && (
                <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-emerald-400">Purchase Receipt</h3>
                    <button
                      onClick={() => setLastReceipt(null)}
                      className="text-white/40 hover:text-white/70 text-xs transition"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">XESS Received</span>
                      <span className="text-emerald-400 font-medium">{formatNumber(lastReceipt.xessAmount)} XESS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Paid</span>
                      <span className="text-white/90">{lastReceipt.paid} {lastReceipt.asset}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/60 shrink-0">TxID</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://solscan.io/tx/${lastReceipt.txSig}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-cyan-400 hover:text-cyan-300 transition truncate"
                        >
                          {lastReceipt.txSig.slice(0, 20)}...{lastReceipt.txSig.slice(-8)}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(lastReceipt.txSig);
                            toast.success("TxID copied!");
                          }}
                          className="shrink-0 text-white/40 hover:text-white/70 transition"
                          title="Copy TxID"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Closed State */}
              {isClosed && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                  <p className="text-red-300">Sale is currently closed</p>
                </div>
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-medium">Allocation Rules</h2>
            <ul className="mt-3 grid gap-2 text-sm text-white/70 md:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Wallet cap: 10 million XESS per wallet
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                No vesting - tokens delivered immediately
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Freely transferable after purchase
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Accepted assets: SOL & USDC
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Platform does not require token payments
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Contact Support@xessex.me to be put on the whitelist for the private sale
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <RoadmapMarquee />

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FaqCard
            q="Do I need XESS to use the platform?"
            a="No. The platform is designed to operate without requiring token ownership or token payments."
          />
          <FaqCard
            q="Is there vesting?"
            a="No vesting for sale allocations. Tokens are delivered immediately upon purchase. Wallet caps are enforced to support broad distribution."
          />
          <FaqCard
            q="How does the private sale work?"
            a="Private sale access is whitelist-only. If your wallet is approved, you can participate during the private window."
          />
          <FaqCard
            q="What can I do with XESS tokens?"
            a="XESS qualifies you for Special Credit tiers, weekly reward distributions, prize drawings, and future governance voting."
          />
        </div>

        <p className="mt-10 text-xs text-white/50 max-w-3xl">
          XESS is a utility token used for rewards and progression qualification within the Xessex platform.
          It is not required to use the platform, does not represent ownership, and provides no guarantee of profit or return.
          XESS may be freely transferred and traded after purchase, and its value is determined by the open market.
          Participation is voluntary and subject to market risk.
        </p>
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2">
      <span className="text-white/55">{k}</span>
      <span className="text-white/85">{v}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const short = `${value.slice(0, 5)}...${value.slice(-5)}`;
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2">
      <span className="text-white/55">{label}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copied!`);
        }}
        className="text-white/85 font-mono text-xs hover:text-cyan-400 transition cursor-pointer"
        title={`Click to copy: ${value}`}
      >
        {short}
      </button>
    </div>
  );
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-sm font-medium text-white">{q}</div>
      <div className="mt-2 text-sm text-white/70">{a}</div>
    </div>
  );
}
