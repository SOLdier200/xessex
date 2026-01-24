"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import LogoutModal from "./LogoutModal";
import FreeUserModal from "./FreeUserModal";
import LoginModal from "@/components/LoginModal";

type AuthData = {
  authed: boolean;
  membership: "DIAMOND" | "MEMBER" | "FREE";
  authWallet: string | null;
  payoutWallet: string | null;
  effectivePayoutWallet: string | null;
  needsAuthWalletLink: boolean;
  needsPayoutWalletLink: boolean;
  hasEmail: boolean;
  email: string | null;
};

export default function WalletStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const { wallet, publicKey, connected, disconnect } = useWallet();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFreeUserModal, setShowFreeUserModal] = useState(false);
  const [showSignupLoginModal, setShowSignupLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detect wallet adapter name for styling
  const walletName = wallet?.adapter?.name?.toLowerCase() ?? "";

  // Auto-disconnect wallet if user is logged in as a Member (not Diamond)
  useEffect(() => {
    if (auth?.membership === "MEMBER" && connected) {
      disconnect().catch(() => {});
    }
  }, [auth?.membership, connected, disconnect]);

  const fetchAuth = useCallback((delay = 0) => {
    const doFetch = () => {
      fetch(`/api/auth/me?_=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.authed) {
            setAuth({
              authed: true,
              membership: d.membership,
              authWallet: d.authWallet ?? null,
              payoutWallet: d.payoutWallet ?? null,
              effectivePayoutWallet: d.effectivePayoutWallet ?? null,
              needsAuthWalletLink: d.needsAuthWalletLink ?? false,
              needsPayoutWalletLink: d.needsPayoutWalletLink ?? false,
              hasEmail: d.hasEmail ?? false,
              email: d.email ?? null,
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
      // Small delay to ensure database has committed changes
      fetchAuth(100);
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [fetchAuth]);

  const handleLogoutComplete = () => {
    setAuth(null);
    if (pathname.startsWith("/videos/")) {
      router.replace("/videos");
      return;
    }
    router.refresh();
  };

  // Use authWallet from session, or connected wallet's publicKey as fallback
  const walletAddress = auth?.authWallet || publicKey?.toBase58();
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  // Don't show anything while loading
  if (loading) return null;

  // Determine display state
  const authed = !!auth?.authed;
  const membership = auth?.membership ?? "FREE";
  const hasEmail = !!auth?.hasEmail;
  const hasAuthWallet = !!auth?.authWallet;

  const isAuthedFree = authed && membership === "FREE" && hasEmail;
  const isFreeWalletOnly = authed && membership === "FREE" && !hasEmail && hasAuthWallet;
  const isFreeOrNoUser = !authed || (membership === "FREE" && !hasEmail && !hasAuthWallet);
  const isMember = authed && membership === "MEMBER";
  const isDiamond = authed && membership === "DIAMOND";

  // Handle click based on state
  const handleClick = () => {
    if (isFreeOrNoUser) {
      setShowSignupLoginModal(true);
    } else if (isFreeWalletOnly) {
      // Free user with wallet only - show free user modal
      setShowFreeUserModal(true);
    } else if (isAuthedFree) {
      // Authenticated free user - show modal with Logout/Purchase options
      setShowFreeUserModal(true);
    } else {
      // Member or Diamond - show logout modal
      setShowLogoutModal(true);
    }
  };

  // Determine styles and content based on state
  let bgClass = "";
  let borderClass = "";
  let textColor = "";
  let title = "";
  let subtitle = "";
  let showImage: "diamond" | "member" | null = null;

  if (isFreeOrNoUser) {
    bgClass = "bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30";
    borderClass = "border-red-400/50";
    textColor = "text-red-400";
    title = "Free User--Sign up or Login now!";
    subtitle = "Get full access";
  } else if (isFreeWalletOnly) {
    // Free user logged in with wallet only - purple for Phantom, yellow for Solflare
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
      // Default purple for other wallets
      bgClass = "bg-gradient-to-r from-purple-500/20 to-violet-500/20 hover:from-purple-500/30 hover:to-violet-500/30";
      borderClass = "border-purple-400/50";
      textColor = "text-purple-400";
    }
    title = "Free User -- has wallet connected";
    subtitle = shortAddress ?? "Wallet connected";
  } else if (isAuthedFree) {
    bgClass = "bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30";
    borderClass = "border-orange-400/50";
    textColor = "text-orange-300";
    title = "Account Created and signed in--Purchase Membership now!";
    subtitle = auth?.email ? `Logged in as ${auth.email}` : "Click to choose a plan";
  } else if (isMember) {
    bgClass = "bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30";
    borderClass = "border-emerald-400/50";
    textColor = "text-emerald-400";
    showImage = "member";
    title = "";
    subtitle = "";
  } else if (isDiamond) {
    bgClass = "bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30";
    borderClass = "border-sky-400/50";
    textColor = "text-sky-400";
    showImage = "diamond";
    title = "";
    subtitle = shortAddress ?? "";
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`neon-border rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 flex w-full sm:w-auto items-center gap-1.5 md:gap-2 cursor-pointer transition max-w-full sm:max-w-[240px] md:max-w-none ${bgClass} ${borderClass}`}
      >
        {showImage ? (
          <>
            <Image
              src={showImage === "diamond"
                ? "/logos/textlogo/siteset3/diamond100.png"
                : "/logos/textlogo/siteset3/member100.png"}
              alt={showImage === "diamond" ? "Diamond Member" : "Member"}
              width={64}
              height={20}
              className="h-4 md:h-5 w-auto shrink-0"
            />
            {/* Only show subtitle text on desktop if there's content */}
            {subtitle && (
              <div className={`hidden md:block text-xs font-mono truncate ${textColor}`}>
                {subtitle}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse shrink-0 ${textColor.replace('text-', 'bg-')}`} />
            <div className="text-left min-w-0">
              <div className={`text-[10px] md:text-xs font-semibold truncate ${textColor}`}>{title}</div>
              <div className="text-[9px] md:text-[10px] text-white/60 truncate">{subtitle}</div>
            </div>
          </>
        )}
      </button>

      <LogoutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogoutComplete={handleLogoutComplete}
      />

      <FreeUserModal
        open={showFreeUserModal}
        onClose={() => setShowFreeUserModal(false)}
        onLogoutComplete={handleLogoutComplete}
        isWalletOnly={isFreeWalletOnly}
      />

      <LoginModal
        isOpen={showSignupLoginModal}
        onClose={() => setShowSignupLoginModal(false)}
      />
    </>
  );
}
