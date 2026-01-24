"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import TopNav from "../components/TopNav";
import RewardsTab from "../components/RewardsTab";
import RecoveryEmailSection from "@/components/RecoveryEmailSection";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

// Strict hex-to-bytes converter for merkle proof elements (must be exactly 32 bytes)
function hexToU8_32(hex: string): number[] {
  const h = hex.trim().startsWith("0x") ? hex.trim().slice(2) : hex.trim();
  if (h.length !== 64) throw new Error(`Bad proof element length: ${h.length} hex chars (expected 64)`);
  const buf = Buffer.from(h, "hex");
  if (buf.length !== 32) throw new Error(`Bad proof element bytes: ${buf.length} (expected 32)`);
  return Array.from(buf);
}

type ProfileData = {
  ok: boolean;
  authed: boolean;
  email: string | null;
  walletAddress: string | null;
  solWallet: string | null;
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
  memberId: string | null;
  membership: "FREE" | "MEMBER" | "DIAMOND";
  sub: {
    tier: string;
    status: string;
    expiresAt: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  stats: {
    videosWatched: number;
    accountCreated: string;
  };
  referral: {
    code: string | null;
    referralCount: number;
    referredById: string | null;
    referredByEmail: string | null;
  };
  specialCreditsMicro: string;
  pendingManualPayment: {
    id: string;
    planCode: string;
    requestedTier: string;
    createdAt: string;
  } | null;
};

type AnalyticsData = {
  totals: {
    totalVideos: number;
    totalComments: number;
    totalMemberLikes: number;
    totalMemberDislikes: number;
    totalModLikes: number;
    totalModDislikes: number;
    utilizedComments: number;
    totalXessPaid: number;
    pendingXess: number;
  };
  comments: {
    sourceId: string;
    createdAt: string;
    body: string;
    memberLikes: number;
    memberDislikes: number;
    modLikes: number;
    modDislikes: number;
    utilized: boolean;
    score: number;
  }[];
};

function formatTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "N/A";

  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncateWallet(address: string | null): string {
  if (!address) return "N/A";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "analytics" | "referrals" | "history">("profile");

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Referral state
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const [refCodeInput, setRefCodeInput] = useState("");
  const [refCodeLoading, setRefCodeLoading] = useState(false);
  const [refCodeError, setRefCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Cancel subscription state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Claim state
  const [claimSummary, setClaimSummary] = useState<null | {
    epoch: null | { id: string; epochNo: number; merkleRoot: string };
    pendingAmount: string;
    hasPending: boolean;
    claim: null | { id: string; status: "PROCESSING" | "CLAIMED" | "FAILED"; txSig: string | null; error: string | null };
  }>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);

  // Live pending state
  const [livePending, setLivePending] = useState<null | {
    currentWeek: {
      weekKey: string;
      activity: { scoreReceived: number; diamondComments: number; mvmPoints: number; votesCast: number };
      estimatedPending: string;
    };
    nextPayout: { countdown: string; date: string };
    unclaimedWeeks: Array<{ epoch: number; weekKey: string; amount: string; amountAtomic: string }>;
    totalUnclaimed: string;
    totalUnclaimedAtomic: string;
  }>(null);
  const [claimAllBusy, setClaimAllBusy] = useState(false);
  const [claimAllProgress, setClaimAllProgress] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<{
    count: number;
    totalXess: string;
    txSigs: string[];
  } | null>(null);

  // Logout state
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function handleLogout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.dispatchEvent(new Event("auth-changed"));
      router.push("/login");
    } catch {
      toast.error("Logout failed");
      setLogoutBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok || !json.authed) {
          router.push("/login");
          return;
        }
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Listen for auth-changed event (logout) and redirect to login
  useEffect(() => {
    const handleAuthChange = () => {
      router.push("/login");
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [router]);

  // Load analytics for Diamond members (needed for Profile tab XESS display and Analytics tab)
  useEffect(() => {
    const needsAnalytics = (activeTab === "analytics" || activeTab === "profile") && data?.membership === "DIAMOND";
    if (needsAnalytics && !analyticsData && !analyticsLoading) {
      setAnalyticsLoading(true);
      fetch("/api/analytics")
        .then((res) => res.json())
        .then((json) => {
          if (json.ok) {
            setAnalyticsData(json);
          } else {
            setAnalyticsError(json.error || "Failed to load analytics");
          }
        })
        .catch(() => setAnalyticsError("Failed to load analytics"))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, data?.membership, analyticsData, analyticsLoading]);

  // Safety: redirect non-Diamond users to profile tab if they somehow land on a locked tab
  useEffect(() => {
    const isDiamondUser = data?.membership === "DIAMOND";
    if (!isDiamondUser && activeTab !== "profile") {
      setActiveTab("profile");
    }
  }, [data?.membership, activeTab]);

  // Fetch claim summary for Diamond members
  async function refreshClaimSummary() {
    try {
      const res = await fetch("/api/rewards/summary", { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "FAILED_SUMMARY");
      setClaimSummary({
        epoch: j.epoch,
        pendingAmount: j.pendingAmount,
        hasPending: j.hasPending,
        claim: j.claim ? { id: j.claim.id, status: j.claim.status, txSig: j.claim.txSig, error: j.claim.error } : null,
      });
    } catch {
      // Silent fail - claim summary is optional
    }
  }

  useEffect(() => {
    if (data?.membership === "DIAMOND") {
      refreshClaimSummary();
    }
  }, [data?.membership]);

  // Fetch live pending data
  async function refreshLivePending() {
    try {
      const res = await fetch("/api/rewards/pending", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setLivePending({
          currentWeek: j.currentWeek,
          nextPayout: j.nextPayout,
          unclaimedWeeks: j.unclaimedWeeks,
          totalUnclaimed: j.totalUnclaimed,
          totalUnclaimedAtomic: j.totalUnclaimedAtomic,
        });
      }
    } catch {
      // Silent fail
    }
  }

  // Refresh analytics data (updates Total XESS Paid / Pending display)
  async function refreshAnalytics() {
    try {
      const res = await fetch("/api/analytics", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setAnalyticsData(json);
      }
    } catch {
      // Silent fail
    }
  }

  useEffect(() => {
    if (data?.membership === "DIAMOND") {
      refreshLivePending();

      // Auto-refresh pending data every 4 minutes
      const interval = setInterval(() => {
        refreshLivePending();
      }, 240000);

      return () => clearInterval(interval);
    }
  }, [data?.membership]);

  // Claim all unclaimed weeks handler
  async function onClaimAllUnclaimed() {
    if (!livePending?.unclaimedWeeks.length) return;

    setClaimAllBusy(true);
    setClaimAllProgress(null);
    setClaimErr(null);
    setClaimSuccess(null);

    try {
      // Get all claimable epochs data
      const allRes = await fetch("/api/rewards/claim/all");
      const allData = await allRes.json();

      if (!allData.ok || !allData.claimableEpochs?.length) {
        throw new Error(allData.error || "No claimable epochs");
      }

      // Connect wallet
      const provider = (window as any).solana;
      if (!provider?.isPhantom) throw new Error("PHANTOM_NOT_FOUND");
      await provider.connect();

      const walletPubkey = new PublicKey(provider.publicKey.toString());
      const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");

      // Fetch IDL
      const programId = new PublicKey(allData.programId);
      const idl = await anchor.Program.fetchIdl(programId, { connection } as any);
      if (!idl) throw new Error("IDL_NOT_FOUND");

      const anchorProvider = { connection, publicKey: walletPubkey } as anchor.Provider;
      const program = new anchor.Program({ ...idl, address: programId.toBase58() } as anchor.Idl, anchorProvider);

      const mint = new PublicKey(allData.xessMint);
      const userAta = getAssociatedTokenAddressSync(mint, walletPubkey);

      let successCount = 0;
      const totalEpochs = allData.claimableEpochs.length;
      const claimedTxSigs: string[] = [];
      let claimedAmountAtomic = 0n;

      for (let i = 0; i < totalEpochs; i++) {
        const epoch = allData.claimableEpochs[i];
        setClaimAllProgress(`Claiming ${i + 1}/${totalEpochs} (Week ${epoch.weekKey})...`);

        try {
          // Wallet mismatch guard for this epoch
          if (epoch.claimer && walletPubkey.toBase58() !== epoch.claimer) {
            throw new Error(`WALLET_MISMATCH: expected ${epoch.claimer} got ${walletPubkey.toBase58()}`);
          }

          // Convert proof hex to bytes using strict converter
          const proofVec: number[][] = Array.isArray(epoch.proof) ? epoch.proof.map(hexToU8_32) : [];

          const claimIx = await program.methods
            .claim(
              new anchor.BN(epoch.epoch),
              new anchor.BN(epoch.amountAtomic),
              epoch.index,
              proofVec
            )
            .accounts({
              config: new PublicKey(epoch.pdas.config),
              vaultAuthority: new PublicKey(epoch.pdas.vaultAuthority),
              epochRoot: new PublicKey(epoch.pdas.epochRoot),
              receipt: new PublicKey(epoch.pdas.receipt),
              claimer: walletPubkey,
              vaultAta: new PublicKey(allData.vaultAta),
              userAta,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .instruction();

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          const tx = new Transaction({
            feePayer: walletPubkey,
            blockhash,
            lastValidBlockHeight,
          });

          // Create ATA if first claim
          if (i === 0) {
            const userAtaInfo = await connection.getAccountInfo(userAta);
            if (!userAtaInfo) {
              const createAtaIx = createAssociatedTokenAccountInstruction(
                walletPubkey,
                userAta,
                walletPubkey,
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
              );
              tx.add(createAtaIx);
            }
          }

          tx.add(claimIx);

          const signed = await provider.signTransaction(tx);
          const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
          await connection.confirmTransaction(sig, "confirmed");

          // Confirm with backend
          await fetch("/api/rewards/claim/confirm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ signature: sig, epoch: epoch.epoch }),
          });

          successCount++;
          claimedTxSigs.push(sig);
          claimedAmountAtomic += BigInt(epoch.amountAtomic);
        } catch (epochErr) {
          console.error(`Failed to claim epoch ${epoch.epoch}:`, epochErr);
          // Continue to next epoch
        }
      }

      if (successCount > 0) {
        // Calculate total claimed in XESS (9 decimals) - use BigInt to avoid precision loss
        const wholeXess = claimedAmountAtomic / 1_000_000_000n;
        const remainder = claimedAmountAtomic % 1_000_000_000n;
        const decimal = Number(remainder) / 1_000_000_000;
        const totalXess = (Number(wholeXess) + decimal).toLocaleString(undefined, { maximumFractionDigits: 2 });
        setClaimSuccess({
          count: successCount,
          totalXess,
          txSigs: claimedTxSigs,
        });
        // Clear the unclaimed weeks from local state immediately
        setLivePending((prev) => prev ? { ...prev, unclaimedWeeks: [], totalUnclaimed: "0", totalUnclaimedAtomic: "0" } : null);
      }

      if (successCount === totalEpochs) {
        toast.success(`All ${successCount} weeks claimed successfully!`);
      } else if (successCount > 0) {
        toast.warning(`Claimed ${successCount}/${totalEpochs} weeks. Some failed.`);
      } else {
        toast.error("Failed to claim any weeks");
      }

      // Refresh all data to update UI
      await Promise.all([
        refreshClaimSummary(),
        refreshLivePending(),
        refreshAnalytics(),
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "CLAIM_ALL_FAILED";
      setClaimErr(msg);
      toast.error(`Claim failed: ${msg}`);
    } finally {
      setClaimAllBusy(false);
      setClaimAllProgress(null);
    }
  }

  // Claim handler - wired to on-chain program
  async function onClaimPendingXess() {
    setClaimErr(null);
    setClaimBusy(true);

    try {
      // 1) Get claim payload from prepare endpoint (uses latest on-chain epoch)
      const prepRes = await fetch("/api/rewards/claim/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}), // Let server use latest on-chain epoch
      });
      const prep = await prepRes.json();

      if (!prep.ok) throw new Error(prep.error || "PREPARE_FAILED");
      if (!prep.claimable) {
        if (prep.reason === "already_claimed") {
          throw new Error("Already claimed for this epoch");
        }
        throw new Error(prep.reason || "NOT_CLAIMABLE");
      }

      // 2) Connect to Phantom wallet
      const provider = (window as any).solana;
      if (!provider?.isPhantom) throw new Error("PHANTOM_NOT_FOUND");
      await provider.connect();

      const walletPubkey = new PublicKey(provider.publicKey.toString());

      // 3) Set up connection
      const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");

      // 4) Fetch IDL from chain
      const programId = new PublicKey(prep.programId);
      const idl = await anchor.Program.fetchIdl(programId, { connection } as any);
      if (!idl) throw new Error("IDL_NOT_FOUND");

      const anchorProvider = { connection, publicKey: walletPubkey } as anchor.Provider;
      const program = new anchor.Program({ ...idl, address: programId.toBase58() } as anchor.Idl, anchorProvider);

      // 5) Get user ATA and check if it exists
      const mint = new PublicKey(prep.xessMint);
      const userAta = getAssociatedTokenAddressSync(mint, walletPubkey);
      const userAtaInfo = await connection.getAccountInfo(userAta);

      // 6) Wallet mismatch guard - prevent BadProof from signing with wrong wallet
      if (prep.claimer && walletPubkey.toBase58() !== prep.claimer) {
        throw new Error(`WALLET_MISMATCH: expected ${prep.claimer} got ${walletPubkey.toBase58()}`);
      }

      // 7) Build claim instruction - use strict proof conversion
      const proofVec: number[][] = Array.isArray(prep.proof) ? prep.proof.map(hexToU8_32) : [];

      const claimIx = await program.methods
        .claim(
          new anchor.BN(prep.epoch),
          new anchor.BN(prep.amountAtomic),
          prep.index,
          proofVec
        )
        .accounts({
          config: new PublicKey(prep.pdas.config),
          vaultAuthority: new PublicKey(prep.pdas.vaultAuthority),
          epochRoot: new PublicKey(prep.pdas.epochRoot),
          receipt: new PublicKey(prep.pdas.receipt),
          claimer: walletPubkey,
          vaultAta: new PublicKey(prep.vaultAta),
          userAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      // 7) Build transaction - create ATA if missing, then claim
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: walletPubkey,
        blockhash,
        lastValidBlockHeight,
      });

      // If user ATA doesn't exist, create it first
      if (!userAtaInfo) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          walletPubkey,        // payer
          userAta,             // ata address
          walletPubkey,        // owner
          mint,                // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        tx.add(createAtaIx);
      }

      tx.add(claimIx);

      toast.info("Claiming tokens...");

      const signed = await provider.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");

      // 8) Confirm with backend (marks rewards as claimed in DB)
      const confirmRes = await fetch("/api/rewards/claim/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature: sig, epoch: prep.epoch }),
      });
      const confirmData = await confirmRes.json();

      if (confirmData.ok) {
        toast.success("Claim successful! Tokens transferred to your wallet.");
      } else {
        toast.warning("Claimed on-chain but DB update failed. Contact support.");
      }

      // Refresh all data to update UI
      await Promise.all([
        refreshClaimSummary(),
        refreshLivePending(),
        refreshAnalytics(),
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "CLAIM_FAILED";
      setClaimErr(msg);
      toast.error(`Claim failed: ${msg}`);
      await refreshClaimSummary();
    } finally {
      setClaimBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <div className="px-6 py-10 text-center text-white/60">Loading...</div>
      </main>
    );
  }

  if (!data) return null;

  const isDiamond = data.membership === "DIAMOND";

  const membershipColors = {
    FREE: "text-white/60 border-white/20 bg-white/5",
    MEMBER: "text-sky-400 border-sky-400/50 bg-sky-500/20",
    DIAMOND: "text-blue-400 border-blue-400/50 bg-blue-500/20",
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "text-emerald-400",
    PENDING: "text-yellow-400",
    EXPIRED: "text-red-400",
    CANCELED: "text-red-400",
    PARTIAL: "text-orange-400",
  };

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <Image
                src="/logos/profile2.png"
                alt="Your Profile"
                width={938}
                height={276}
                priority
                className="h-[180px] md:h-[234px] w-auto mx-auto opacity-85 blur-[0.5px]"
                style={{
                  maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)",
                  WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)",
                  filter: "drop-shadow(0 0 40px rgba(236,72,153,0.25))",
                }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Profile
              </button>

              {isDiamond && (
                <>
                  <button
                    onClick={() => setActiveTab("referrals")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      activeTab === "referrals"
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    Referrals
                  </button>

                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      activeTab === "history"
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    History
                  </button>

                  <button
                    onClick={() => setActiveTab("analytics")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      activeTab === "analytics"
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <span className="text-pink-500">Anal</span>ytics
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Tab Content */}
          {activeTab === "profile" && (
            <>
              {/* Account Info Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Email</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white">{data.email || "Not set"}</span>
                      {data.membership === "MEMBER" && data.email && (
                        <button
                          onClick={handleLogout}
                          disabled={logoutBusy}
                          className="px-3 py-1 text-xs rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 hover:bg-pink-500/30 transition disabled:opacity-50"
                        >
                          {logoutBusy ? "..." : "Logout"}
                        </button>
                      )}
                    </div>
                  </div>

                  {data.walletAddress && (
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/60">Signed-in Wallet</span>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-mono text-sm">
                          {truncateWallet(data.walletAddress)}
                        </span>
                        {data.membership === "DIAMOND" && (
                          <button
                            onClick={handleLogout}
                            disabled={logoutBusy}
                            className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 transition disabled:opacity-50"
                          >
                            {logoutBusy ? "..." : "Logout"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {data.solWallet && (
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/60">Payout Wallet</span>
                      <span className="text-green-400 font-mono text-sm">
                        {truncateWallet(data.solWallet)}
                      </span>
                    </div>
                  )}

                  {/* Warning when signed-in wallet differs from payout wallet */}
                  {data.walletAddress && data.solWallet && data.walletAddress !== data.solWallet && (
                    <div className="py-2 border-b border-white/10">
                      <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-3">
                        <p className="text-yellow-400 text-xs">
                          You&apos;re signed in with a different wallet than your payout wallet. XESS claims will go to your payout wallet.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Member Since</span>
                    <span className="text-white">{formatDate(data.stats.accountCreated)}</span>
                  </div>

                  {/* Change Password - only for email users */}
                  {data.email && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-white/60">Password</span>
                      <button
                        onClick={() => {
                          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                          setPasswordError(null);
                          setPasswordSuccess(false);
                          setShowCurrentPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                          setShowPasswordModal(true);
                        }}
                        className="px-3 py-1 text-sm rounded-lg bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition"
                      >
                        Change Password
                      </button>
                    </div>
                  )}

                  {/* Member ID */}
                  {data.memberId && (
                    <div className="flex justify-between items-center py-2 border-t border-white/10">
                      <span className="text-white/60">Member ID</span>
                      <span className="text-white font-mono text-sm">
                        {data.memberId.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>

                {/* Recovery Email Section - Diamond only */}
                {isDiamond && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <RecoveryEmailSection
                      currentEmail={data.recoveryEmail}
                      isVerified={data.recoveryEmailVerified}
                      onUpdated={() => {
                        // Refresh profile data
                        fetch("/api/profile")
                          .then((res) => res.json())
                          .then((json) => {
                            if (json.ok) setData(json);
                          });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Membership Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Membership</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Current Plan</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${membershipColors[data.membership]}`}>
                      {data.membership === "FREE" ? "Free" : data.membership === "MEMBER" ? "Member" : "Diamond"}
                    </span>
                  </div>

                  {data.sub && (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Status</span>
                        <span className={`font-semibold ${statusColors[data.sub.status] || "text-white"}`}>
                          {data.sub.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Time Remaining</span>
                        <span className="text-white">{formatTimeLeft(data.sub.expiresAt)}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/60">Expires On</span>
                        <span className="text-white">
                          {data.sub.expiresAt ? formatDate(data.sub.expiresAt) : "N/A"}
                        </span>
                      </div>

                      {data.pendingManualPayment && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-400/30 rounded-xl">
                          <p className="text-sm text-yellow-300">
                            <strong>Note:</strong> Your Cash App payment is pending confirmation. Once your payment is verified, your full subscription time will be updated below.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {data.membership === "FREE" && data.pendingManualPayment && (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-400/30 rounded-xl">
                      <p className="text-sm text-yellow-300">
                        <strong>Note:</strong> Your Cash App payment is pending confirmation. Once your payment is verified, your full subscription time will be activated.
                      </p>
                    </div>
                  )}

                  {data.membership === "FREE" && !data.pendingManualPayment && (
                    <div className="mt-4 p-4 bg-sky-500/10 border border-sky-400/30 rounded-xl">
                      <p className="text-sm text-sky-300 mb-3">
                        Upgrade to Member to unlock full access to all videos!
                      </p>
                      <Link
                        href="/signup"
                        className="inline-block px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-400 font-semibold hover:bg-sky-500/30 transition text-sm"
                      >
                        View Membership Options
                      </Link>
                    </div>
                  )}

                  {data.sub && data.sub.status === "ACTIVE" && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                      <p className="text-sm text-emerald-300">
                        {data.sub.cancelAtPeriodEnd
                          ? `Your subscription is set to cancel. Access continues until ${data.sub.expiresAt ? formatDate(data.sub.expiresAt) : "the end of your billing period"}.`
                          : "Your membership is active. Enjoy full access to all content!"}
                      </p>
                      {!data.sub.cancelAtPeriodEnd && (
                        <button
                          onClick={() => setShowCancelModal(true)}
                          className="mt-3 text-sm text-white/50 hover:text-red-400 transition underline"
                        >
                          Cancel Subscription
                        </button>
                      )}
                    </div>
                  )}

                  {data.sub && data.sub.status === "EXPIRED" && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-400/30 rounded-xl">
                      <p className="text-sm text-red-300 mb-3">
                        Your membership has expired. Renew to continue enjoying full access.
                      </p>
                      <Link
                        href="/signup"
                        className="inline-block px-4 py-2 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-400 font-semibold hover:bg-pink-500/30 transition text-sm"
                      >
                        Renew Membership
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Activity</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">{data.stats.videosWatched}</div>
                    <div className="text-xs text-white/60 mt-1">Videos Watched</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                      {data.sub?.expiresAt ? formatTimeLeft(data.sub.expiresAt).split(",")[0] : "—"}
                    </div>
                    <div className="text-xs text-white/60 mt-1">Days Left</div>
                  </div>
                </div>
              </div>

              {/* Special Credits Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Special Credits</h2>
                <div className="bg-gradient-to-r from-cyan-500/10 via-black/0 to-cyan-500/5 border border-cyan-400/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-cyan-400/80 uppercase tracking-wide">
                        Balance
                      </div>
                      <div className="text-2xl font-bold text-cyan-400 mt-1">
                        {(Number(data.specialCreditsMicro) / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Credits
                      </div>
                    </div>
                    <Link
                      href="/rewards-drawing"
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-400 font-semibold hover:bg-cyan-500/30 transition text-sm"
                    >
                      Enter Drawing
                    </Link>
                  </div>
                  <p className="text-xs text-white/50 mt-3">
                    Diamond members earn special credits daily based on eligibility. Use credits to enter the weekly drawing or redeem for membership.
                  </p>
                </div>
              </div>

              {/* XESS Rewards Card (Diamond only) */}
              {isDiamond && analyticsData && (
                <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                  <h2 className="text-lg font-semibold text-white mb-4">XESS Rewards</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-yellow-500/10 via-black/0 to-yellow-500/5 border border-yellow-400/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-yellow-400/80 uppercase tracking-wide">
                            Total XESS Paid
                          </div>
                          <div className="text-2xl font-bold text-yellow-400 mt-1">
                            {analyticsData.totals.totalXessPaid.toLocaleString()} XESS
                          </div>
                        </div>
                        <Image
                          src="/logos/favicon-32x32.png"
                          alt="XESS"
                          width={32}
                          height={32}
                          className="opacity-50"
                        />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-green-500/10 via-black/0 to-green-500/5 border border-green-400/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-green-400/80 uppercase tracking-wide">
                            Pending XESS
                          </div>
                          <div className="text-2xl font-bold text-green-400 mt-1">
                            {analyticsData.totals.pendingXess.toLocaleString()} XESS
                          </div>
                        </div>
                        <Image
                          src="/logos/favicon-32x32.png"
                          alt="XESS"
                          width={32}
                          height={32}
                          className="opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Pending & Claim Section (Diamond only) */}
              {isDiamond && (
                <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                  <h2 className="text-lg font-semibold text-white mb-4">XESS Rewards</h2>

                  {/* Current Week Activity */}
                  {livePending?.currentWeek && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-purple-500/10 via-black/0 to-pink-500/10 border border-purple-400/20 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/60">Current Week ({livePending.currentWeek.weekKey})</span>
                        <span className="text-xs text-purple-400">
                          Next payout: {livePending.nextPayout.countdown}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-black/30 rounded-lg p-2">
                          <div className="text-white font-semibold">{livePending.currentWeek.activity.scoreReceived}</div>
                          <div className="text-white/40">Score</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                          <div className="text-white font-semibold">{livePending.currentWeek.activity.diamondComments}</div>
                          <div className="text-white/40">Comments</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                          <div className="text-white font-semibold">{livePending.currentWeek.activity.mvmPoints}</div>
                          <div className="text-white/40">MVM</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                          <div className="text-white font-semibold">{livePending.currentWeek.activity.votesCast}</div>
                          <div className="text-white/40">Votes</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-white/50">
                        Estimated payout: ~{livePending.currentWeek.estimatedPending} XESS
                      </div>
                    </div>
                  )}

                  {/* Claim Success Message */}
                  {claimSuccess && (
                    <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-400/50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-400 font-semibold">
                          Successfully Claimed {claimSuccess.totalXess} XESS
                        </span>
                      </div>
                      <p className="text-sm text-white/70 mb-2">
                        {claimSuccess.count} week{claimSuccess.count > 1 ? "s" : ""} claimed and transferred to your wallet.
                      </p>
                      {claimSuccess.txSigs.length > 0 && (
                        <div className="space-y-1">
                          {claimSuccess.txSigs.slice(0, 3).map((sig, i) => (
                            <a
                              key={sig}
                              href={`https://explorer.solana.com/tx/${sig}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet"}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs text-emerald-400 hover:text-emerald-300 underline truncate"
                            >
                              Tx {i + 1}: {sig.slice(0, 20)}...{sig.slice(-8)}
                            </a>
                          ))}
                          {claimSuccess.txSigs.length > 3 && (
                            <span className="text-xs text-white/50">
                              +{claimSuccess.txSigs.length - 3} more transactions
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unclaimed Weeks */}
                  {livePending && livePending.unclaimedWeeks.length > 0 && !claimSuccess && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-400/30 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-green-400 font-semibold">
                            {livePending.unclaimedWeeks.length} Unclaimed Week{livePending.unclaimedWeeks.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-white/60 text-sm ml-2">
                            Total: {livePending.totalUnclaimed} XESS
                          </span>
                        </div>
                        <button
                          onClick={onClaimAllUnclaimed}
                          disabled={claimAllBusy || claimBusy}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            claimAllBusy || claimBusy
                              ? "bg-white/10 text-white/50 cursor-not-allowed"
                              : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400"
                          }`}
                        >
                          {claimAllBusy ? "Claiming..." : "Claim All"}
                        </button>
                      </div>
                      {claimAllProgress && (
                        <div className="text-xs text-green-400 mb-2">{claimAllProgress}</div>
                      )}
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {livePending.unclaimedWeeks.map((week) => (
                          <div key={week.epoch} className="flex justify-between text-xs text-white/70">
                            <span>Week {week.weekKey} (Epoch {week.epoch})</span>
                            <span className="text-green-400">{week.amount} XESS</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Single Week Claim (Legacy) */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm text-white/60">
                        Latest epoch pending:{" "}
                        <span className="text-white font-semibold">
                          {claimSummary?.pendingAmount ?? "..."}
                        </span>
                        {claimSummary?.epoch ? (
                          <span className="text-white/40"> (Epoch {claimSummary.epoch.epochNo})</span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/api/rewards/claims-csv"
                        className="px-3 py-2 rounded-xl border border-white/10 bg-black/40 text-white/70 hover:text-white transition text-sm"
                      >
                        CSV
                      </a>

                      <button
                        onClick={onClaimPendingXess}
                        disabled={
                          claimBusy ||
                          claimAllBusy ||
                          !claimSummary?.hasPending ||
                          claimSummary?.claim?.status === "PROCESSING"
                        }
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                          claimBusy || claimAllBusy || claimSummary?.claim?.status === "PROCESSING"
                            ? "bg-white/10 text-white/50 cursor-not-allowed"
                            : claimSummary?.hasPending
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400"
                              : "bg-white/5 text-white/30 cursor-not-allowed"
                        }`}
                      >
                        {claimBusy || claimSummary?.claim?.status === "PROCESSING"
                          ? "Claiming..."
                          : claimSummary?.hasPending
                            ? "Claim Latest"
                            : "No Pending"}
                      </button>
                    </div>
                  </div>

                  {/* txSig link */}
                  {claimSummary?.claim?.txSig ? (
                    <div className="mt-3 text-sm">
                      <span className="text-white/60">Tx:</span>{" "}
                      <a
                        className="text-pink-400 underline hover:text-pink-300"
                        href={`https://explorer.solana.com/tx/${claimSummary.claim.txSig}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on Solscan
                      </a>
                    </div>
                  ) : null}

                  {/* error line */}
                  {(claimErr || claimSummary?.claim?.error) && (
                    <div className="mt-3 text-sm text-red-400">
                      {claimErr ?? claimSummary?.claim?.error}
                    </div>
                  )}

                  {/* status */}
                  <div className="mt-2 text-xs text-white/40">
                    Status: {claimSummary?.claim?.status ?? (claimSummary?.hasPending ? "READY" : "—")}
                  </div>
                </div>
              )}

              {/* Diamond Features Teaser (non-Diamond only) */}
              {!isDiamond && (
                <div className="neon-border rounded-2xl p-6 bg-gradient-to-r from-purple-500/10 via-black/30 to-pink-500/10 border-purple-400/30">
                  <h2 className="text-lg font-semibold text-white mb-2">Unlock Diamond</h2>
                  <p className="text-sm text-white/70 mb-4">
                    Diamond members get access to Referrals, XESS History, and Analytics.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
                    <div className="bg-black/50 rounded-xl p-4 border border-white/10">
                      <div className="text-white font-semibold mb-1">Referrals</div>
                      <div className="text-white/60 text-xs">Share a link and earn benefits.</div>
                    </div>
                    <div className="bg-black/50 rounded-xl p-4 border border-white/10">
                      <div className="text-white font-semibold mb-1">History</div>
                      <div className="text-white/60 text-xs">Receipts + payouts + breakdowns.</div>
                    </div>
                    <div className="bg-black/50 rounded-xl p-4 border border-white/10">
                      <div className="text-white font-semibold mb-1">Analytics</div>
                      <div className="text-white/60 text-xs">Performance stats and insights.</div>
                    </div>
                  </div>
                  <Link
                    href="/signup"
                    className="inline-block px-6 py-2 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition text-sm"
                  >
                    Upgrade to Diamond
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Referrals Tab Content */}
          {activeTab === "referrals" && isDiamond && (
            <>
              {/* Your Referral Link Card */}
              <div className="neon-border rounded-2xl p-6 bg-gradient-to-r from-purple-500/10 via-black/30 to-pink-500/10 border-purple-400/30 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Your Referral Link</h2>
                  <button
                    onClick={() => setShowBenefitsModal(true)}
                    className="text-sm text-purple-400 hover:text-purple-300 underline transition"
                  >
                    View Benefits
                  </button>
                </div>

                {/* Diamond→Diamond only rule note */}
                <div className="bg-black/50 rounded-xl p-4 mb-4 border border-white/10">
                  <div className="text-sm text-white/80 font-semibold">Referral program rule</div>
                  <div className="text-xs text-white/60 mt-1 leading-relaxed">
                    Referral benefits apply only when a{" "}
                    <span className="text-white/80 font-semibold">Diamond member</span> refers another{" "}
                    <span className="text-white/80 font-semibold">Diamond member</span>.
                  </div>
                </div>

                {data.referral.code ? (
                  <>
                    <div className="bg-black/50 rounded-xl p-4 mb-4">
                      <div className="text-xs text-white/50 mb-2">Your referral code:</div>
                      <div className="text-xl font-bold text-purple-400 font-mono">
                        {data.referral.code}
                      </div>
                    </div>

                    <div className="bg-black/50 rounded-xl p-4 mb-4">
                      <div className="text-xs text-white/50 mb-2">Share this link:</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${data.referral.code}`}
                          className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-white/80 text-sm font-mono truncate"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/signup?ref=${data.referral.code}`
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition text-sm whitespace-nowrap"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-black/40 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400">
                          {data.referral.referralCount}
                        </div>
                        <div className="text-xs text-white/60 mt-1">People Referred</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-white/60 text-center py-4">
                    No referral code available. Contact support if you believe this is an error.
                  </div>
                )}
              </div>

              {/* Your Referrer Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Your Referrer</h2>

                {data.referral.referredById ? (
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-emerald-400 font-semibold">Referred by</div>
                        <div className="text-white/70 text-sm">
                          {data.referral.referredByEmail || "A fellow member"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/60 text-sm mb-4">
                      Were you referred by someone? Enter their referral code to link your account.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex items-stretch rounded-xl border border-white/10 bg-black/50 overflow-hidden flex-1">
                        <span className="px-3 py-3 text-white/40 font-mono text-sm border-r border-white/10 bg-black/30">
                          XESS-
                        </span>
                        <input
                          type="text"
                          placeholder="Enter remaining code"
                          value={refCodeInput}
                          onChange={(e) => {
                            const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                            setRefCodeInput(raw);
                            setRefCodeError(null);
                          }}
                          className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:outline-none font-mono text-base"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!refCodeInput.trim()) return;
                          setRefCodeLoading(true);
                          setRefCodeError(null);
                          try {
                            const res = await fetch("/api/profile/set-referrer", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ refCode: `XESS-${refCodeInput.trim()}` }),
                            });
                            const json = await res.json();
                            if (json.ok) {
                              // Refresh profile data
                              const profileRes = await fetch("/api/profile");
                              const profileJson = await profileRes.json();
                              if (profileJson.ok) setData(profileJson);
                              setRefCodeInput("");
                            } else {
                              if (json.error === "INVALID_CODE") {
                                setRefCodeError("Invalid referral code. Please check and try again.");
                              } else if (json.error === "CANNOT_REFER_SELF") {
                                setRefCodeError("You cannot refer yourself.");
                              } else if (json.error === "ALREADY_REFERRED") {
                                setRefCodeError("You already have a referrer set.");
                              } else {
                                setRefCodeError("Failed to set referrer. Please try again.");
                              }
                            }
                          } catch {
                            setRefCodeError("Failed to set referrer. Please try again.");
                          } finally {
                            setRefCodeLoading(false);
                          }
                        }}
                        disabled={refCodeLoading || !refCodeInput.trim()}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refCodeLoading ? "..." : "Submit"}
                      </button>
                    </div>
                    {refCodeError && (
                      <p className="text-red-400 text-sm mt-2">{refCodeError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* How It Works Card */}
              <div className="neon-border rounded-2xl p-6 bg-black/30">
                <h2 className="text-lg font-semibold text-white mb-4">How Referrals Work</h2>
                <div className="space-y-4 text-sm text-white/70">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">1</span>
                    </div>
                    <p>Share your unique referral link with friends</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">2</span>
                    </div>
                    <p>When they sign up using your link, they become your referral</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">3</span>
                    </div>
                    <p>Earn XESS rewards when your referrals earn rewards!</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* History Tab Content (Diamond-only) */}
          {activeTab === "history" && isDiamond && (
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h2 className="text-lg font-semibold text-white mb-4">XESS History</h2>
              <RewardsTab />
            </div>
          )}

          {/* Benefits Modal */}
          {showBenefitsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => setShowBenefitsModal(false)}
              />
              <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/95 p-6">
                <button
                  onClick={() => setShowBenefitsModal(false)}
                  className="absolute top-4 right-4 text-white/50 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <h3 className="text-xl font-bold text-purple-400 mb-4">Referral Benefits</h3>

                <div className="space-y-4">
                  <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl p-4">
                    <div className="text-lg font-bold text-purple-400">Level 1 (L1)</div>
                    <div className="text-white/70 text-sm mt-1">
                      Earn <span className="text-green-400 font-semibold">10%</span> of what your direct referrals earn
                    </div>
                  </div>

                  <div className="bg-pink-500/10 border border-pink-400/30 rounded-xl p-4">
                    <div className="text-lg font-bold text-pink-400">Level 2 (L2)</div>
                    <div className="text-white/70 text-sm mt-1">
                      Earn <span className="text-green-400 font-semibold">3%</span> of what their referrals earn
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4">
                    <div className="text-lg font-bold text-yellow-400">Level 3 (L3)</div>
                    <div className="text-white/70 text-sm mt-1">
                      Earn <span className="text-green-400 font-semibold">1%</span> of what the third level earns
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                  <p className="text-emerald-300 text-sm">
                    Build your network and earn passive XESS rewards every week when your referrals are active on Xessex!
                  </p>
                </div>

                <button
                  onClick={() => setShowBenefitsModal(false)}
                  className="mt-6 w-full py-3 rounded-xl bg-purple-500/20 border border-purple-400/50 text-purple-400 font-semibold hover:bg-purple-500/30 transition"
                >
                  Got it!
                </button>
              </div>
            </div>
          )}

          {/* Cancel Subscription Modal */}
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => !cancelLoading && setShowCancelModal(false)}
              />
              <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/95 p-6">
                <button
                  onClick={() => !cancelLoading && setShowCancelModal(false)}
                  disabled={cancelLoading}
                  className="absolute top-4 right-4 text-white/50 hover:text-white transition disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <h3 className="text-xl font-bold text-red-400 mb-4">Cancel Subscription</h3>

                <p className="text-white/80 mb-6">
                  Are you sure you want to cancel your subscription? Your access will remain active until the end of your current billing period. You will not be charged again.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setCancelLoading(true);
                      try {
                        const res = await fetch("/api/subscription/cancel", {
                          method: "POST",
                        });
                        const json = await res.json();
                        if (json.ok) {
                          // Refresh profile data
                          const profileRes = await fetch("/api/profile");
                          const profileJson = await profileRes.json();
                          if (profileJson.ok) setData(profileJson);
                          setShowCancelModal(false);
                        }
                      } catch {
                        // Silently fail, user can try again
                      } finally {
                        setCancelLoading(false);
                      }
                    }}
                    disabled={cancelLoading}
                    className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-400/50 text-red-400 font-semibold hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    {cancelLoading ? "Canceling..." : "Confirm Cancellation"}
                  </button>
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelLoading}
                    className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition disabled:opacity-50"
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Password Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => !passwordLoading && setShowPasswordModal(false)}
              />
              <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/95 p-6">
                <button
                  onClick={() => !passwordLoading && setShowPasswordModal(false)}
                  disabled={passwordLoading}
                  className="absolute top-4 right-4 text-white/50 hover:text-white transition disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <h3 className="text-xl font-bold text-white mb-6">Change Password</h3>

                {passwordSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-green-400 font-semibold mb-2">Password Changed!</p>
                    <p className="text-white/60 text-sm mb-6">Your password has been updated successfully.</p>
                    <button
                      onClick={() => setShowPasswordModal(false)}
                      className="px-6 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPasswordError(null);

                      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                        setPasswordError("New passwords do not match");
                        return;
                      }

                      if (passwordForm.newPassword.length < 5) {
                        setPasswordError("New password must be at least 5 characters");
                        return;
                      }

                      setPasswordLoading(true);
                      try {
                        const res = await fetch("/api/profile/change-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            currentPassword: passwordForm.currentPassword,
                            newPassword: passwordForm.newPassword,
                          }),
                        });
                        const json = await res.json();

                        if (json.ok) {
                          setPasswordSuccess(true);
                        } else {
                          setPasswordError(json.message || json.error || "Failed to change password");
                        }
                      } catch {
                        setPasswordError("Failed to change password. Please try again.");
                      } finally {
                        setPasswordLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:border-pink-400/50 focus:outline-none"
                          placeholder="Enter current password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                        >
                          {showCurrentPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-2">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:border-pink-400/50 focus:outline-none"
                          placeholder="Enter new password (min 5 characters)"
                          minLength={5}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                        >
                          {showNewPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-2">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:border-pink-400/50 focus:outline-none"
                          placeholder="Confirm new password"
                          minLength={5}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                        >
                          {showConfirmPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/30">
                        <p className="text-red-400 text-sm">{passwordError}</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="flex-1 py-3 rounded-xl bg-pink-500/20 border border-pink-400/50 text-pink-400 font-semibold hover:bg-pink-500/30 transition disabled:opacity-50"
                      >
                        {passwordLoading ? "Changing..." : "Change Password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(false)}
                        disabled={passwordLoading}
                        className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab Content */}
          {activeTab === "analytics" && isDiamond && (
            <>
              {analyticsLoading && (
                <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-4 text-white/60">Loading analytics...</p>
                </div>
              )}

              {analyticsError && (
                <div className="neon-border rounded-2xl p-8 bg-black/30 text-center">
                  <p className="text-red-400">{analyticsError}</p>
                </div>
              )}

              {analyticsData && (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalComments}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Total Comments</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30 border-green-400/30">
                      <div className="text-2xl font-bold text-green-400">
                        {analyticsData.totals.utilizedComments}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Sourced</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalMemberLikes}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Member Likes</div>
                    </div>

                    <div className="neon-border rounded-xl p-4 bg-black/30">
                      <div className="text-2xl font-bold text-white">
                        {analyticsData.totals.totalModLikes}
                      </div>
                      <div className="text-xs text-white/60 mt-1">Mod Likes</div>
                    </div>
                  </div>

                  {/* Comments Table */}
                  <div className="neon-border rounded-2xl p-4 md:p-6 bg-black/30">
                    <h2 className="text-lg font-semibold neon-text mb-4">
                      Your Comments ({analyticsData.comments.length})
                    </h2>

                    {analyticsData.comments.length === 0 ? (
                      <p className="text-white/50 text-center py-8">
                        You haven&apos;t posted any comments yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/50 border-b border-white/10">
                              <th className="pb-3 font-medium">ID</th>
                              <th className="pb-3 font-medium">Comment</th>
                              <th className="pb-3 font-medium text-center">Score</th>
                              <th className="pb-3 font-medium text-center">Likes</th>
                              <th className="pb-3 font-medium text-center">Status</th>
                              <th className="pb-3 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.comments.map((c) => (
                              <tr
                                key={c.sourceId}
                                className="border-b border-white/5 hover:bg-white/5"
                              >
                                <td className="py-3 font-mono text-xs text-white/60">
                                  #{c.sourceId.slice(-6)}
                                </td>
                                <td className="py-3 max-w-[150px] truncate text-white/80">
                                  {c.body}
                                </td>
                                <td className="py-3 text-center">
                                  <span
                                    className={`font-semibold ${
                                      c.score > 0
                                        ? "text-green-400"
                                        : c.score < 0
                                        ? "text-red-400"
                                        : "text-white/50"
                                    }`}
                                  >
                                    {c.score > 0 ? "+" : ""}
                                    {c.score}
                                  </span>
                                </td>
                                <td className="py-3 text-center">
                                  <span className="text-green-400">{c.memberLikes}</span>
                                  <span className="text-white/30 mx-1">/</span>
                                  <span className="text-red-400">{c.memberDislikes}</span>
                                </td>
                                <td className="py-3 text-center">
                                  {c.utilized ? (
                                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                                      Sourced
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">
                                      N/A
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-white/50 text-xs">
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 text-xs text-white/40">
                    <p>
                      <strong>Sourced</strong> = Your comment was used to adjust a video&apos;s score
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
