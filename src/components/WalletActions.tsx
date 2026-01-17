"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";

type MeUser = {
  id: string;
  email?: string | null;
  role: string;
  solWallet?: string | null;
  walletAddress?: string | null;
};

function detectPlatform() {
  if (typeof navigator === "undefined")
    return { isAndroid: false, isIos: false, isChromeAndroid: false };
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes("android");
  const isIos =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1);
  const isChromeAndroid = isAndroid && ua.includes("chrome/");
  return { isAndroid, isIos, isChromeAndroid };
}

function short(addr?: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function WalletActions({ showWalletSignIn = true }: { showWalletSignIn?: boolean }) {
  const { setVisible } = useWalletModal();
  const wallet = useWallet();

  const p = useMemo(detectPlatform, []);
  const [me, setMe] = useState<MeUser | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<null | "signin" | "link">(null);
  const [needLinkWallet, setNeedLinkWallet] = useState<null | string>(null);

  const pk = wallet.publicKey?.toBase58() ?? null;

  const isAuthed = !!me;
  const isLinked =
    !!me &&
    !!pk &&
    (me.solWallet === pk || me.walletAddress === pk);

  async function refreshMe() {
    setMeLoaded(false);
    try {
      const d = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
      setMe(d?.user ?? null);
    } finally {
      setMeLoaded(true);
    }
  }

  useEffect(() => {
    refreshMe();
    const onAuth = () => refreshMe();
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
  }, []);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  async function signInWithWallet() {
    setStatus("");
    setNeedLinkWallet(null);

    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    setBusy("signin");
    try {
      setStatus("Requesting challenge…");
      const c = await fetch("/api/auth/challenge", { method: "POST" }).then((r) => r.json());

      setStatus("Signing…");
      const msgBytes = new TextEncoder().encode(c.message);
      const signed = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signed);

      setStatus("Verifying…");
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          message: c.message,
          signature,
        }),
      });

      const v = await resp.json().catch(() => ({}));

      if (!resp.ok || !v.ok) {
        if (resp.status === 409 && v.error === "WALLET_NOT_LINKED") {
          const addr = v.wallet || wallet.publicKey.toBase58();
          setNeedLinkWallet(addr);
          try {
            localStorage.setItem("pending_wallet_to_link", addr);
          } catch {}
          setStatus("");
          return;
        }
        setStatus(v.error || "Wallet sign-in failed.");
        return;
      }

      setStatus("Signed in!");
      window.dispatchEvent(new Event("auth-changed"));
      await refreshMe();
      window.location.href = "/";
    } catch (e: any) {
      setStatus(e?.message || "Wallet sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  async function linkWalletToAccount() {
    setStatus("");
    setNeedLinkWallet(null);

    if (!isAuthed) {
      setStatus("Sign in first, then link your wallet.");
      return;
    }
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    setBusy("link");
    try {
      setStatus("Requesting link challenge…");
      const challengeRes = await fetch("/api/auth/wallet-link/challenge", { method: "POST" });
      const challengeData = await challengeRes.json();

      if (!challengeData.ok) {
        setStatus(challengeData.error || "Failed to get challenge.");
        return;
      }

      const { message, nonce } = challengeData;

      setStatus("Signing link message…");
      const msgBytes = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signatureBytes);

      setStatus("Verifying link…");
      const verifyRes = await fetch("/api/auth/wallet-link/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          signature,
          nonce,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.ok) {
        setStatus(verifyData.error || "Failed to link wallet.");
        return;
      }

      setStatus("Wallet linked!");
      try {
        localStorage.removeItem("pending_wallet_to_link");
      } catch {}
      window.dispatchEvent(new Event("auth-changed"));
      await refreshMe();
    } catch (e: any) {
      setStatus(e?.message || "Failed to link wallet.");
    } finally {
      setBusy(null);
    }
  }

  async function switchAccount() {
    setStatus("Logging out…");
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.dispatchEvent(new Event("auth-changed"));
    await refreshMe();
    setStatus("");
  }

  return (
    <div className="space-y-3">
      {/* Platform hints */}
      {p.isAndroid && !p.isChromeAndroid && (
        <div className="text-xs text-white/50">
          Android tip: wallet connect works best in Chrome. If it fails here, open in Chrome.
        </div>
      )}

      {/* Always show connect */}
      {!wallet.connected ? (
        <>
          <button
            onClick={() => setVisible(true)}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white transition bg-white/10 border border-white/20 hover:bg-white/15"
          >
            Connect Wallet
          </button>

          {p.isIos && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
            >
              Open in Phantom (iOS)
            </button>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Connected wallet</div>
            <div className="font-mono text-sm text-white">{short(pk)}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => wallet.disconnect()}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/70 hover:bg-white/20 hover:text-white transition"
            >
              Disconnect
            </button>

            {/* If NOT signed in, allow wallet sign-in */}
            {!meLoaded ? null : !isAuthed ? (
              showWalletSignIn ? (
                <button
                  onClick={signInWithWallet}
                  disabled={busy === "signin" || busy === "link"}
                  className="rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400 disabled:opacity-50"
                >
                  {busy === "signin" ? "Signing in…" : "Sign in with Wallet"}
                </button>
              ) : null
            ) : isLinked ? (
              <div className="px-3 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-sm font-semibold">
                Linked to your account
              </div>
            ) : (
              <button
                onClick={linkWalletToAccount}
                disabled={busy === "signin" || busy === "link"}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
              >
                {busy === "link" ? "Linking…" : "Link wallet to this account"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Guided 409 case */}
      {needLinkWallet && (
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4">
          <div className="font-semibold text-yellow-200">Wallet not linked to this account</div>
          <div className="mt-1 text-sm text-white/70">
            Wallet <span className="font-mono text-white">{needLinkWallet}</span> is connected, but your current session is a different account.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/link-wallet"
              className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300"
            >
              Link this wallet
            </a>
            <button
              onClick={switchAccount}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/80 hover:bg-white/20"
            >
              Switch account (log out)
            </button>
          </div>
        </div>
      )}

      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
