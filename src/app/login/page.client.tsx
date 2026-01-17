"use client";

import { useEffect, useState } from "react";
import WalletLoginButton from "@/components/WalletLoginButton";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../components/GoogleSignupButton";

type Me = { id: string; role: string; solWallet?: string | null; walletAddress?: string | null } | null;

export default function LoginPageClient() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setMe(j.user ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const isAuthed = !!me;

  return (
    <div className="px-6 pb-10 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Member Login */}
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

        {/* Wallet area */}
        <div className="neon-border rounded-2xl p-6 bg-black/30">
          <h2 className="text-xl font-semibold neon-text">Wallet</h2>

          {!loaded ? (
            <p className="mt-2 text-sm text-white/70">Loading...</p>
          ) : isAuthed ? (
            <>
              <p className="mt-2 text-sm text-white/70">
                You're already signed in. Link a wallet to this account, or log out to use a different wallet-native account.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href="/link-wallet"
                  className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300"
                >
                  Link wallet to this account
                </a>
                <form action="/api/auth/logout" method="post">
                  <button className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/80 hover:bg-white/20">
                    Log out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-white/70">Login with Solana wallet to interact with Xess token features.</p>
              <div className="mt-6">
                <WalletLoginButton />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
