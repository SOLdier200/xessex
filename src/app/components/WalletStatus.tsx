"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import LogoutModal from "./LogoutModal";
import FreeUserModal from "./FreeUserModal";

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
  const { wallet } = useWallet();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFreeUserModal, setShowFreeUserModal] = useState(false);
  const [showSignupLoginModal, setShowSignupLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detect wallet adapter name for styling
  const walletName = wallet?.adapter?.name?.toLowerCase() ?? "";

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

  const shortAddress = auth?.authWallet
    ? `${auth.authWallet.slice(0, 4)}...${auth.authWallet.slice(-4)}`
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
  const isDiamondNoWallet = authed && membership === "DIAMOND" && auth?.needsAuthWalletLink;
  const isDiamondWithWallet = authed && membership === "DIAMOND" && !auth?.needsAuthWalletLink;

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
    } else if (isDiamondNoWallet) {
      router.push("/link-auth-wallet");
    } else {
      // Member or Diamond with wallet - show logout modal
      setShowLogoutModal(true);
    }
  };

  // Determine styles and content based on state
  let bgClass = "";
  let borderClass = "";
  let dotColor = "";
  let textColor = "";
  let title = "";
  let subtitle = "";

  if (isFreeOrNoUser) {
    bgClass = "bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30";
    borderClass = "border-red-400/50";
    dotColor = "bg-red-400";
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
      dotColor = "bg-purple-400";
      textColor = "text-purple-400";
    } else if (isSolflare) {
      bgClass = "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30";
      borderClass = "border-yellow-400/50";
      dotColor = "bg-yellow-400";
      textColor = "text-yellow-400";
    } else {
      // Default purple for other wallets
      bgClass = "bg-gradient-to-r from-purple-500/20 to-violet-500/20 hover:from-purple-500/30 hover:to-violet-500/30";
      borderClass = "border-purple-400/50";
      dotColor = "bg-purple-400";
      textColor = "text-purple-400";
    }
    title = "Free User -- has wallet connected";
    subtitle = shortAddress ?? "Wallet connected";
  } else if (isAuthedFree) {
    bgClass = "bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30";
    borderClass = "border-orange-400/50";
    dotColor = "bg-orange-400";
    textColor = "text-orange-300";
    title = "Account Created and signed in--Purchase Membership now!";
    subtitle = auth?.email ? `Logged in as ${auth.email}` : "Click to choose a plan";
  } else if (isMember) {
    bgClass = "bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30";
    borderClass = "border-emerald-400/50";
    dotColor = "bg-emerald-400";
    textColor = "text-emerald-400";
    title = "Member Connected";
    subtitle = auth?.email ? `Logged in as ${auth.email}` : "Full Access";
  } else if (isDiamondNoWallet) {
    bgClass = "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30";
    borderClass = "border-yellow-400/50";
    dotColor = "bg-yellow-400";
    textColor = "text-yellow-400";
    title = "Diamond Member--Link Wallet for Full Access!";
    subtitle = auth?.email ? `${auth.email} - Click to link wallet` : "Click to link wallet";
  } else if (isDiamondWithWallet) {
    bgClass = "bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30";
    borderClass = "border-sky-400/50";
    dotColor = "bg-sky-400";
    textColor = "text-sky-400";
    title = "Diamond Member with Wallet";
    subtitle = auth?.email ? `Logged in as ${auth.email}` : (shortAddress ?? "Premium Access");
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`neon-border rounded-xl md:rounded-2xl px-3 py-2 md:p-4 flex w-full sm:w-auto items-center gap-2 md:gap-3 cursor-pointer transition max-w-full sm:max-w-[220px] md:max-w-none ${bgClass} ${borderClass}`}
      >
        <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse shrink-0 ${dotColor}`} />
        <div className="text-left min-w-0">
          <div className={`text-xs md:text-sm font-semibold truncate ${textColor}`}>{title}</div>
          <div className="text-[10px] md:text-xs text-white/60 truncate">{subtitle}</div>
        </div>
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

      {showSignupLoginModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowSignupLoginModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl neon-border bg-black/90 p-6">
            <button
              type="button"
              onClick={() => setShowSignupLoginModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white mb-2">Welcome to Xessex</h2>
            <p className="text-sm text-white/60 mb-6">
              Create an account or login to get full access.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowSignupLoginModal(false);
                  router.push("/signup");
                }}
                className="w-full py-3 rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-100 font-semibold hover:bg-pink-500/30 transition"
              >
                Sign up Now
              </button>
              <button
                onClick={() => {
                  setShowSignupLoginModal(false);
                  router.push("/login");
                }}
                className="w-full py-3 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-100 font-semibold hover:bg-sky-500/30 transition"
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
