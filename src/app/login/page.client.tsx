"use client";

import Image from "next/image";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import WalletActions from "@/components/WalletActions";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../components/GoogleSignupButton";

export default function LoginPageClient() {
  return (
    <div className="px-6 pb-10 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        <AccountWalletStatus />

        {/* Member Login */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <Image src="/logos/textlogo/siteset3/login100.png" alt="Member Login" width={938} height={276} className="h-[44px] w-auto" />
          <p className="mt-2 text-sm text-white/70">
            Sign in with your email or Google account.
          </p>

          <div className="mt-6">
            <GoogleSignupButton />
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="text-white/40 text-sm">or use email</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          <EmailLoginBox />

          <div className="mt-4 text-center">
            <a href="/signup" className="text-pink-400 hover:text-pink-300 text-sm underline">
              Sign up with Email
            </a>
          </div>
        </div>

        <div className="text-center text-white/40 text-sm">or</div>

        {/* Wallet Area */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-xl font-semibold neon-text">Wallet</h2>
          <p className="mt-2 text-sm text-white/70">
            Connect your wallet, sign in with wallet, or link your wallet to your account.
          </p>
          <p className="mt-2 text-xs text-yellow-400/80">
            Note: Mobile users will have to download Phantom to connect wallet.
          </p>
          <p className="mt-1 text-xs text-yellow-400/80">
            Note: iPhone (iOS) users must open in Phantom to connect your wallet.
          </p>
          <div className="mt-6">
            <WalletActions />
          </div>
        </div>
      </div>
    </div>
  );
}
