"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import LogoutModal from "./LogoutModal";

type AuthData = {
  authed: boolean;
  membership: "DIAMOND" | "MEMBER" | "FREE";
  walletAddress: string | null;
  needsSolWalletLink: boolean;
  hasEmail: boolean;
};

export default function WalletStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAuth = useCallback(() => {
    fetch(`/api/auth/me?_=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.authed) {
          setAuth({
            authed: true,
            membership: d.membership,
            walletAddress: d.walletAddress,
            needsSolWalletLink: d.needsSolWalletLink ?? false,
            hasEmail: d.hasEmail ?? false,
          });
        } else {
          setAuth(null);
        }
      })
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAuth();
  }, [pathname, fetchAuth]);

  const handleLogoutComplete = () => {
    setAuth(null);
    if (pathname.startsWith("/videos/")) {
      router.replace("/videos");
      return;
    }
    router.refresh();
  };

  const shortAddress = auth?.walletAddress
    ? `${auth.walletAddress.slice(0, 4)}...${auth.walletAddress.slice(-4)}`
    : null;

  // Don't show anything while loading
  if (loading) return null;

  // Determine display state
  const authed = !!auth?.authed;
  const membership = auth?.membership ?? "FREE";
  const hasEmail = !!auth?.hasEmail;

  const isAuthedFree = authed && membership === "FREE" && hasEmail;
  const isFreeOrNoUser = !authed || (membership === "FREE" && !hasEmail);
  const isMember = authed && membership === "MEMBER";
  const isDiamondNoWallet = authed && membership === "DIAMOND" && auth?.needsSolWalletLink;
  const isDiamondWithWallet = authed && membership === "DIAMOND" && !auth?.needsSolWalletLink;

  // Handle click based on state
  const handleClick = () => {
    if (isAuthedFree || isFreeOrNoUser) {
      router.push("/signup");
    } else if (isDiamondNoWallet) {
      router.push("/link-wallet");
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
    title = "Free User--Sign up Now!";
    subtitle = "Get full access";
  } else if (isAuthedFree) {
    bgClass = "bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30";
    borderClass = "border-orange-400/50";
    dotColor = "bg-orange-400";
    textColor = "text-orange-300";
    title = "Account Created and signed in--Purchase MEmbership now!";
    subtitle = "Click to choose a plan";
  } else if (isMember) {
    bgClass = "bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30";
    borderClass = "border-emerald-400/50";
    dotColor = "bg-emerald-400";
    textColor = "text-emerald-400";
    title = "Member Connected";
    subtitle = "Full Access";
  } else if (isDiamondNoWallet) {
    bgClass = "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30";
    borderClass = "border-yellow-400/50";
    dotColor = "bg-yellow-400";
    textColor = "text-yellow-400";
    title = "Diamond Member--Needs Linked Wallet!";
    subtitle = "Click to link wallet";
  } else if (isDiamondWithWallet) {
    bgClass = "bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30";
    borderClass = "border-sky-400/50";
    dotColor = "bg-sky-400";
    textColor = "text-sky-400";
    title = "Diamond Member with Wallet";
    subtitle = shortAddress ?? "Premium Access";
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
    </>
  );
}
