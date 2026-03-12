"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import LogoutModal from "./LogoutModal";
import { useWalletSessionAutoFix } from "@/hooks/useWalletSessionAutoFix";
import { syncWalletSession } from "@/lib/walletAuthFlow";
import { getTierColor } from "@/lib/tierColors";

type AuthData = {
  authed: boolean;
  walletAddress: string | null;
  creditBalance: number;
  xessTier: number;
  username: string | null;
  avatarUrl: string | null;
};

export default function WalletStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const walletCtx = useWallet();
  const { wallet, publicKey, connected, disconnect } = walletCtx;
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detect wallet adapter name for styling
  const walletName = wallet?.adapter?.name?.toLowerCase() ?? "";

  const fetchAuth = useCallback((delay = 0) => {
    const doFetch = () => {
      fetch(`/api/auth/me?_=${Date.now()}`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.authed) {
            setAuth({
              authed: true,
              walletAddress: d.walletAddress ?? null,
              creditBalance: d.creditBalance ?? 0,
              xessTier: d.xessTier ?? 0,
              username: d.user?.username ?? null,
              avatarUrl: d.user?.avatarUrl ?? null,
            });
          } else {
            setAuth(null);
          }
        })
        .catch(() => setAuth(null))
        .finally(() => setLoading(false));
    };
    if (delay > 0) {
      setTimeout(doFetch, delay);
    } else {
      doFetch();
    }
  }, []);

  useEffect(() => {
    fetchAuth(0);
  }, [pathname, fetchAuth]);

  // Listen for auth-changed custom event (dispatched after login/logout/wallet-link)
  useEffect(() => {
    const handleAuthChange = () => {
      fetchAuth(100);
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [fetchAuth]);

  // Listen for credits-changed event (dispatched after earning credits)
  useEffect(() => {
    const handleCreditsChange = () => {
      fetchAuth(0);
    };
    window.addEventListener("credits-changed", handleCreditsChange);
    return () => window.removeEventListener("credits-changed", handleCreditsChange);
  }, [fetchAuth]);

  // iOS Session Auto-Fix
  const authLite = auth ? { authed: true, tier: "diamond" as const } : null;
  useWalletSessionAutoFix(authLite);

  // Wallet-session mismatch guard:
  // If the browser's connected wallet doesn't match the logged-in user's
  // linked wallet, disconnect it immediately. This prevents cross-account
  // state where autoConnect reconnects a wallet belonging to a different user.
  useEffect(() => {
    if (!auth?.walletAddress || !publicKey || !connected) return;
    // Don't auto-disconnect on pages where user intentionally connects a different wallet
    if (pathname.startsWith("/login") || pathname.startsWith("/link-wallet") || pathname === "/wallet-test") return;

    const connectedPub = publicKey.toBase58();
    const sessionWallet = auth.walletAddress;

    if (connectedPub !== sessionWallet) {
      console.warn(
        `[WalletStatus] Wallet mismatch: connected=${connectedPub.slice(0, 8)}… session=${sessionWallet.slice(0, 8)}… — disconnecting stale wallet`
      );
      disconnect().catch(() => {});
    }
  }, [auth?.walletAddress, publicKey?.toBase58(), connected, pathname, disconnect]);

  const handleLogoutComplete = () => {
    setAuth(null);
    if (pathname.startsWith("/videos/")) {
      router.replace("/videos");
      return;
    }
    router.refresh();
  };

  // Use auth wallet or connected wallet's publicKey
  const fullWalletAddress = auth?.walletAddress || publicKey?.toBase58();
  const truncatedWalletAddress = fullWalletAddress
    ? `${fullWalletAddress.slice(0, 4)}...${fullWalletAddress.slice(-4)}`
    : null;

  if (loading) return null;

  const authed = !!auth?.authed;
  const hasWallet = !!auth?.walletAddress;
  const walletConnected = connected && publicKey;

  // Handle click based on state
  const handleClick = async () => {
    if (authed) {
      // Signed in - refresh auth data (gets fresh avatar signed URL) then show modal
      fetchAuth(0);
      setShowLogoutModal(true);
    } else if (walletConnected) {
      // Wallet connected but not signed in - trigger wallet sign-in directly
      const result = await syncWalletSession(walletCtx as any, { mode: "manual" });
      if (result.ok) {
        window.dispatchEvent(new Event("auth-changed"));
        fetchAuth(0);
      }
    } else {
      // No wallet connected - redirect to wallet connect/sign-in
      const isPresale = typeof window !== "undefined" && window.location.hostname.startsWith("presale.");
      if (isPresale) {
        window.location.href = "https://xessex.me/login/diamond";
      } else {
        router.push("/login/diamond");
      }
    }
  };

  // Determine styles based on state
  let bgClass = "";
  let borderClass = "";
  let textColor = "";

  if (authed && walletConnected) {
    // State 3: Signed in with wallet actually connected - color by wallet type
    const isPhantom = walletName.includes("phantom");
    const isSolflare = walletName.includes("solflare");
    if (isPhantom) {
      bgClass = "bg-gradient-to-r from-purple-500/20 to-violet-500/20 hover:from-purple-500/30 hover:to-violet-500/30";
      borderClass = "border-purple-400/50";
      textColor = "text-purple-400";
    } else if (isSolflare) {
      bgClass = "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30";
      borderClass = "border-yellow-400/50";
      textColor = "text-yellow-400";
    } else {
      bgClass = "bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30";
      borderClass = "border-sky-400/50";
      textColor = "text-sky-400";
    }
  } else if ((walletConnected && !authed) || (authed && !walletConnected)) {
    // State 2: Wallet connected but not signed in, or signed in but wallet not connected - yellow prompt
    bgClass = "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30";
    borderClass = "border-yellow-400/50";
    textColor = "text-yellow-400";
  } else {
    // State 1: No wallet connected - pink prompt
    bgClass = "bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30";
    borderClass = "border-pink-400/50";
    textColor = "text-pink-400";
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`border-2 border-[var(--neon-pink)] rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 flex items-center gap-1.5 md:gap-2 cursor-pointer transition ${bgClass}`}
      >
        {authed && walletConnected ? (
          // State 3: Signed in AND wallet connected - show username or pubkey + tier + credits
          <div className="flex items-center gap-2">
            {auth?.username ? (
              <div className={`text-[10px] md:text-xs font-semibold ${textColor}`}>
                {auth.username}
              </div>
            ) : (
              <div className={`text-[10px] md:text-xs font-mono ${textColor}`}>
                <span className="hidden lg:inline">{fullWalletAddress ?? "Connected"}</span>
                <span className="lg:hidden">{truncatedWalletAddress ?? "Connected"}</span>
              </div>
            )}
            {(() => {
              const tier = auth?.xessTier ?? 0;
              const credits = auth?.creditBalance ?? 0;
              const tc = getTierColor(tier);
              if (tier > 0 && credits > 0) {
                return (
                  <div className="text-[10px] md:text-xs font-semibold whitespace-nowrap">
                    <span className={`hidden md:inline ${tc.text}`}>T{tier}</span>
                    <span className="hidden md:inline text-white/30 mx-0.5">&middot;</span>
                    <span className="text-yellow-400">{credits} credits</span>
                  </div>
                );
              }
              if (tier > 0) {
                return (
                  <div className={`hidden md:block text-[10px] md:text-xs font-semibold whitespace-nowrap ${tc.text}`}>
                    T{tier}
                  </div>
                );
              }
              if (credits > 0) {
                return (
                  <div className="text-[10px] md:text-xs font-semibold text-yellow-400 whitespace-nowrap">
                    {credits} credits
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ) : authed ? (
          // State 2b: Signed in but wallet NOT connected - prompt to connect wallet
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse shrink-0 bg-yellow-400" />
            <div className="text-[10px] md:text-xs font-semibold text-yellow-400">
              Connect Wallet
            </div>
          </div>
        ) : walletConnected ? (
          // State 2: Wallet connected but not signed in
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse shrink-0 bg-yellow-400`} />
            <div className={`text-[10px] md:text-xs font-semibold ${textColor}`}>
              Sign in
            </div>
          </div>
        ) : (
          // State 1: No wallet connected
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse shrink-0 bg-pink-400`} />
            <div className={`text-[10px] md:text-xs font-semibold ${textColor}`}>
              Connect
            </div>
          </div>
        )}
      </button>

      <LogoutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogoutComplete={handleLogoutComplete}
        email={null}
        walletAddress={fullWalletAddress ?? null}
        creditBalance={auth?.creditBalance}
        xessTier={auth?.xessTier}
        username={auth?.username}
        avatarUrl={auth?.avatarUrl}
      />
    </>
  );
}
