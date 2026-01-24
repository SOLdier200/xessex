"use client";

import TopNav from "../../components/TopNav";
import Image from "next/image";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import WalletActions from "@/components/WalletActions";
import Link from "next/link";

export default function DiamondLoginPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-xl space-y-6">
          <AccountWalletStatus />

          {/* Diamond Login - Wallet Only */}
          <div className="rounded-2xl p-6 bg-black/30 border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Image
              src="/logos/textlogo/siteset3/login100.png"
              alt="Diamond Login"
              width={938}
              height={276}
              className="h-[44px] w-auto mb-4"
            />
            <p className="mt-2 text-sm text-white/70">
              Connect your wallet to sign in as a Diamond member.
            </p>
            <p className="mt-2 text-xs text-purple-400 animate-pulse">
              Note: All mobile users will need to download Phantom and select Open in Phantom to connect.
            </p>
            <div className="mt-6">
              <WalletActions showLinkWallet={false} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <Link
              href="/login/member"
              className="text-pink-400 hover:text-pink-300 text-sm underline block"
            >
              Sign in as Member instead
            </Link>
            <Link
              href="/recover"
              className="text-white/50 hover:text-white/70 text-sm block"
            >
              Lost access to your wallet?
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
