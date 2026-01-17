"use client";

import WalletLoginButton from "@/components/WalletLoginButton";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../components/GoogleSignupButton";

export default function LoginPageClient() {
  return (
    <div className="px-6 pb-10 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Status panel - always visible */}
        <AccountWalletStatus />

        {/* Member Login (Email + Google) */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h1 className="text-2xl font-semibold neon-text">Member Login</h1>
          <p className="mt-2 text-sm text-white/70">Sign in with your email or Google account.</p>

          <div className="mt-6">
            <GoogleSignupButton />
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="text-white/40 text-sm">or use email</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          <EmailLoginBox />
        </div>

        <div className="text-center text-white/40 text-sm">or</div>

        {/* Wallet section */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-xl font-semibold neon-text">Wallet</h2>
          <p className="mt-2 text-sm text-white/70 mb-4">
            Connect your Solana wallet to sign in or link to your account.
          </p>
          <WalletLoginButton />
        </div>
      </div>
    </div>
  );
}
