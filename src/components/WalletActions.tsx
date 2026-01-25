"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { syncWalletSession } from "@/lib/walletAuthFlow";

// iOS-safe inflight guard keys
const INF_KEY = "xessex_wallet_actions_inflight";
const INF_TS = "xessex_wallet_actions_started_at";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function beginInflight() {
  try {
    sessionStorage.setItem(INF_KEY, "1");
    sessionStorage.setItem(INF_TS, String(Date.now()));
  } catch {}
}

function endInflight() {
  try {
    sessionStorage.removeItem(INF_KEY);
    sessionStorage.removeItem(INF_TS);
  } catch {}
}

function inflight() {
  try {
    return sessionStorage.getItem(INF_KEY) === "1";
  } catch {
    return false;
  }
}

async function settleAuthMe() {
  // Aggressive short poll for cookie/session to reflect on /me after Phantom bounce.
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const data = await r.json().catch(() => null);

      if (r.ok && data?.ok && data?.authed && data?.tier !== "free") {
        window.dispatchEvent(new Event("auth-changed"));
        return true;
      }
    } catch {}

    await sleep(i < 4 ? 250 : 500);
  }
  return false;
}

type MeData = {
  user: {
    id: string;
    email?: string | null;
    role: string;
    solWallet?: string | null;
    walletAddress?: string | null;
  } | null;
  authWallet: string | null;
  payoutWallet: string | null;
  needsAuthWalletLink: boolean;
  membership: "DIAMOND" | "MEMBER" | "FREE" | null;
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

type WalletActionsProps = {
  showWalletSignIn?: boolean;
  showLinkWallet?: boolean;
  // Allow different linking endpoints (payout vs auth-wallet)
  linkChallengeUrl?: string;
  linkVerifyUrl?: string;
  // Where the "Link this wallet" CTA should point in the guided 409 box
  linkHref?: string;
  // Optional callback after successful link
  onLinked?: () => void;
};

export default function WalletActions({
  showWalletSignIn = true,
  showLinkWallet = true,
  linkChallengeUrl = "/api/auth/wallet-link/challenge",
  linkVerifyUrl = "/api/auth/wallet-link/verify",
  linkHref = "/link-wallet",
  onLinked,
}: WalletActionsProps) {
  const { setVisible } = useWalletModal();
  const wallet = useWallet();

  const p = useMemo(detectPlatform, []);
  const [meData, setMeData] = useState<MeData | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<null | "signin" | "link">(null);
  const [needLinkWallet, setNeedLinkWallet] = useState<null | string>(null);

  const pk = wallet.publicKey?.toBase58() ?? null;

  const isAuthed = !!meData?.user;
  // Connected wallet matches auth wallet OR payout wallet
  const isLinked =
    !!meData?.user &&
    !!pk &&
    (meData.authWallet === pk || meData.payoutWallet === pk);

  async function refreshMe() {
    setMeLoaded(false);
    try {
      const d = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json());
      if (d?.authed && d?.user) {
        setMeData({
          user: d.user,
          // Use correct field mapping from /api/auth/me response
          authWallet: d.user?.walletAddress ?? null,
          payoutWallet: d.user?.solWallet ?? null,
          needsAuthWalletLink: d.needsAuthWalletLink ?? false,
          membership: d.membership ?? null,
        });
      } else {
        setMeData(null);
      }
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

  // iOS "Phantom-return settle" - when user comes back from Phantom, finish auth instantly
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      if (!inflight()) return;

      // On iOS, returning from Phantom often remounts; finish auth silently.
      const settled = await settleAuthMe();
      if (settled) {
        await refreshMe();
        endInflight();
        setBusy(null);
        setStatus("Signed in!");
      }

      // If it didn't settle after ~15s since sign started, allow user to retry.
      const startedAt = Number(sessionStorage.getItem(INF_TS) || "0");
      if (startedAt && Date.now() - startedAt > 15_000) {
        endInflight();
        setBusy(null);
      }
    };

    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  // Detect wallet mismatch: if logged in with a wallet and connected wallet is different
  useEffect(() => {
    if (!meLoaded || !meData?.user || !pk) return;

    const authWallet = meData.authWallet;
    const payoutWallet = meData.payoutWallet;

    // If user has an auth wallet and connected wallet doesn't match, show warning
    if (authWallet && authWallet !== pk && payoutWallet !== pk) {
      setNeedLinkWallet(pk);
      setStatus("Connected wallet doesn't match your signed-in account.");
    } else {
      // Clear the warning if wallets now match
      if (needLinkWallet && (authWallet === pk || payoutWallet === pk)) {
        setNeedLinkWallet(null);
        setStatus("");
      }
    }
  }, [meLoaded, meData, pk, needLinkWallet]);

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

    // Prevent double-run across iOS bounces / rapid taps
    if (inflight()) return;

    beginInflight();
    setBusy("signin");

    try {
      setStatus("Requesting challenge…");
      const c = await fetch("/api/auth/challenge", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).then((r) => r.json());

      if (!c?.message) {
        setStatus("Challenge failed. Try again.");
        endInflight();
        return;
      }

      setStatus("Signing…");
      const msgBytes = new TextEncoder().encode(c.message);
      const signed = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signed);

      setStatus("Verifying…");
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
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
          endInflight();
          return;
        }
        setStatus(v.error || "Wallet sign-in failed.");
        endInflight();
        return;
      }

      // Handle account switch (Diamond wallet taking over lower-tier session)
      if (v.switched) {
        setStatus(v.switchedToDiamond ? "Switched to Diamond account!" : "Switched accounts!");
      }

      // IMPORTANT: DO NOT call signing-capable sync here.
      // Just settle /me. (This avoids a second signMessage prompt on iOS.)
      setStatus("Syncing session…");
      const settled = await settleAuthMe();

      // As a backup, do a passive sync that never signs
      if (!settled) {
        await syncWalletSession(wallet as any, { mode: "auto" });
        await settleAuthMe();
      }

      // Always notify listeners
      window.dispatchEvent(new Event("auth-changed"));
      await refreshMe();

      setStatus("Signed in!");
      endInflight();

      // Small delay helps iOS commit cookie before navigation
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      setTimeout(() => {
        window.location.href = "/";
      }, isIOS ? 350 : 150);
    } catch (e: any) {
      setStatus(e?.message || "Wallet sign-in failed.");
      endInflight();
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
      setStatus("Requesting link challenge...");
      const challengeRes = await fetch(linkChallengeUrl, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
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

      setStatus("Verifying link...");
      const verifyRes = await fetch(linkVerifyUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
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
      onLinked?.();
    } catch (e: any) {
      setStatus(e?.message || "Failed to link wallet.");
    } finally {
      setBusy(null);
    }
  }

  async function switchAccount() {
    setStatus("Logging out…");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    }).catch(() => {});
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

      {/* Show logout button if user is signed in with email, otherwise show wallet connect */}
      {!wallet.connected ? (
        // If user is authed with email (not wallet), show logout option before wallet connect
        isAuthed && meData?.user?.email ? (
          <div className="space-y-3">
            <div className="text-sm text-white/70 text-center">
              Signed in as <span className="text-white font-medium">{meData.user.email}</span>
              {meData.membership && <span className="text-white/50"> ({meData.membership})</span>}
            </div>
            <button
              onClick={async () => {
                setStatus("Logging out...");
                await fetch("/api/auth/logout", {
                  method: "POST",
                  credentials: "include",
                  cache: "no-store",
                }).catch(() => {});
                window.dispatchEvent(new Event("auth-changed"));
                await refreshMe();
                setStatus("");
              }}
              className="w-full py-3 px-6 rounded-full font-semibold text-white transition bg-gradient-to-r from-red-500 to-pink-500 border-2 border-red-400"
              style={{
                boxShadow: "0 0 12px rgba(255, 20, 147, 0.4)",
              }}
            >
              Log out to connect wallet
            </button>
            <div className="text-xs text-white/50 text-center">
              Log out first to sign in with a different wallet account
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setVisible(true)}
              className="w-full py-3 px-6 rounded-full font-semibold text-white transition"
              style={{
                background: "linear-gradient(135deg, #9945FF 0%, #7B3FE4 100%)",
                border: "2px solid #FF1493",
                boxShadow: "0 0 12px rgba(255, 20, 147, 0.4)",
              }}
            >
              Select Wallet
            </button>

            {(p.isIos || p.isAndroid) && (
              <button
                onClick={openInPhantom}
                className="w-full py-3 px-6 rounded-xl font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
              >
                Open in Phantom
              </button>
            )}
          </>
        )
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Connected Wallet/Account</div>
            <div className="font-mono text-sm text-white">{short(pk)}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await wallet.disconnect();
                await fetch("/api/auth/logout", {
                  method: "POST",
                  credentials: "include",
                  cache: "no-store",
                }).catch(() => {});
                window.dispatchEvent(new Event("auth-changed"));
                await refreshMe();
              }}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/70 hover:bg-white/20 hover:text-white transition"
            >
              Disconnect/Sign-Out
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
              // Wallet connected but not linked - offer to sign in with it (may switch accounts)
              <div className="flex flex-col gap-2">
                <div className="text-xs text-yellow-300/80 px-1">
                  This wallet is not linked to your current account
                </div>
                <div className="flex flex-wrap gap-2">
                  {showWalletSignIn && (
                    <button
                      onClick={signInWithWallet}
                      disabled={busy === "signin" || busy === "link"}
                      className="rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400 disabled:opacity-50"
                    >
                      {busy === "signin" ? "Signing in…" : "Sign in with Wallet"}
                    </button>
                  )}
                  {showLinkWallet && (
                    <button
                      onClick={linkWalletToAccount}
                      disabled={busy === "signin" || busy === "link"}
                      className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {busy === "link" ? "Linking…" : "Link to current"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallet mismatch warning */}
      {needLinkWallet && (
        <div className="rounded-2xl border border-red-400/50 bg-red-500/10 p-4">
          <div className="font-semibold text-red-300">Wrong wallet connected</div>
          <div className="mt-1 text-sm text-white/70">
            You&apos;re signed in with a different wallet. Connected: <span className="font-mono text-white">{needLinkWallet?.slice(0, 4)}...{needLinkWallet?.slice(-4)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await switchAccount();
                // After logout, sign in with the connected wallet
                setTimeout(() => signInWithWallet(), 500);
              }}
              disabled={busy === "signin"}
              className="rounded-xl bg-pink-500 px-4 py-2 font-semibold text-black hover:bg-pink-400 disabled:opacity-50"
            >
              {busy === "signin" ? "Signing in..." : "Sign in with connected wallet"}
            </button>
            <button
              onClick={() => wallet.disconnect()}
              className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/80 hover:bg-white/20"
            >
              Disconnect wallet
            </button>
          </div>
        </div>
      )}

      {status && <div className="text-sm text-white/70">{status}</div>}
    </div>
  );
}
