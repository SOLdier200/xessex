"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * DEPRECATED: This page has been replaced by /upgrade-to-diamond
 *
 * The old "auth wallet link" flow has been removed because:
 * - Members should only link payout wallets (solWallet) via /link-wallet
 * - Setting walletAddress (auth identity) should only happen via Diamond signup or upgrade
 *
 * This page now redirects to the appropriate location.
 */
export default function LinkAuthWalletPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new upgrade page
    router.replace("/upgrade-to-diamond");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black flex items-center justify-center">
      <div className="text-white/60">Redirecting...</div>
    </div>
  );
}
