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

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden="true"
    />
  );
}

function Checkmark() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" className="xess-check-draw" />
      </svg>
    </span>
  );
}

async function settleAuthMe() {
  // Poll /me until authed flips true. Do not impose tier logic here.
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data?.ok && data?.authed) {
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
    
    walletAddress?: string | null;
  } | null;
  authWallet: string | null;
  payoutWallet: string | null;
  membership: "DIAMOND" | "MEMBER" | "FREE" | null;
};

function detectPlatform() {
  if (typeof navigator === "undefined") return { isAndroid: false, isIos: false, isChromeAndroid: false };
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

type Mode = "WALLET_LOGIN" | "PAYOUT_LINK" | "DIAMOND_UPGRADE";

type WalletActionsProps = {
  mode: Mode;

  // UI toggles (kept simple)
  showDisconnect?: boolean;

  // After success
  onDone?: () => void;

  // Optional navigation target after wallet login success
  successHref?: string;
};

/**
 * WalletActions - Explicit mode-based wallet operations
 *
 * Modes:
 * - WALLET_LOGIN: Sign in with wallet (uses walletAddress for auth)

 * - DIAMOND_UPGRADE: Upgrade Member to Diamond (sets walletAddress, MEMBER only)
 *
 * This design prevents wrong-endpoint bugs by choosing endpoints internally based on mode.
 */
export default function WalletActions({
  mode,
  showDisconnect = true,
  onDone,
  successHref = "/",
}: WalletActionsProps) {
  const { setVisible } = useWalletModal();
  const wallet = useWallet();

  const p = useMemo(detectPlatform, []);
  const [meData, setMeData] = useState<MeData | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<null | "signin" | "link">(null);
  const [successPulse, setSuccessPulse] = useState(false);
  const [successNavTo, setSuccessNavTo] = useState<string | null>(null);

  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const pk = wallet.publicKey?.toBase58() ?? null;

  const isAuthed = !!meData?.user;
  const authWallet = meData?.authWallet ?? null;
  const payoutWallet = meData?.payoutWallet ?? null;

  // Separate linked states for auth vs payout
  const isAuthLinked = !!pk && !!authWallet && authWallet === pk;
  const isPayoutLinked = !!pk && !!payoutWallet && payoutWallet === pk;

  async function refreshMe() {
    setMeLoaded(false);
    try {
      const d = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).then((r) => r.json());
      if (d?.authed && d?.user) {
        setMeData({
          user: d.user,
          authWallet: d.user?.walletAddress ?? null,
          payoutWallet: d.user?.walletAddress ?? null,
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

  const triggerSuccess = (to: string, label = "Done!") => {
    setStatus(label);
    setSuccessNavTo(to);
    setSuccessPulse(true);
    window.dispatchEvent(new Event("auth-changed"));
    endInflight();
    setBusy(null);

    setTimeout(() => {
      setSuccessPulse(false);
      setSuccessNavTo(null);
    }, 1200);
  };

  // iOS "Phantom-return settle"
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      if (!inflight()) return;

      const settled = await settleAuthMe();
      if (settled) triggerSuccess(successHref, "Success!");

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
  }, [successHref]);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  async function walletLogin() {
    setStatus("");
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }
    if (inflight()) return;

    beginInflight();
    setBusy("signin");

    try {
      const addr = wallet.publicKey.toBase58();

      setStatus("Requesting challenge…");
      const c = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ wallet: addr, purpose: "LOGIN" }),
      }).then((r) => r.json());

      if (!c?.ok || !c?.message) {
        setStatus(c?.error || "Challenge failed. Try again.");
        endInflight();
        setBusy(null);
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
        body: JSON.stringify({ wallet: addr, message: c.message, signature }),
      });

      const v = await resp.json().catch(() => ({}));

      if (!resp.ok || !v.ok) {
        if (resp.status === 403 && v.error === "WALLET_NOT_REGISTERED") {
          setShowNotRegisteredModal(true);
          setStatus("");
          endInflight();
          setBusy(null);
          return;
        }
        if (v.error === "WALLET_NOT_LINKED_FOR_AUTH") {
          setStatus("This wallet is linked for payouts only. Upgrade to Diamond to use it for login.");
          endInflight();
          setBusy(null);
          return;
        }
        setStatus(v.error || "Wallet sign-in failed.");
        endInflight();
        setBusy(null);
        return;
      }

      setStatus("Syncing session…");
      let ok = await settleAuthMe();
      if (!ok) {
        await syncWalletSession(wallet as any, { mode: "auto" });
        ok = await settleAuthMe();
      }
      if (!ok) {
        setStatus("Signed, but session didn't stick. Tap again.");
        endInflight();
        setBusy(null);
        return;
      }

      // Show welcome modal for new users
      if (v.isNewUser) {
        setShowWelcomeModal(true);
      }

      triggerSuccess(successHref, "Logged in!");
      onDone?.();
    } catch (e: any) {
      setStatus(e?.message || "Wallet sign-in failed.");
      endInflight();
      setBusy(null);
    }
  }

  async function dbLinkFlow(kind: "PAYOUT_LINK" | "DIAMOND_UPGRADE") {
    setStatus("");

    if (!isAuthed) {
      setStatus("Sign in first, then link your wallet.");
      return;
    }
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Connect a wallet that supports message signing.");
      return;
    }

    // Membership gates on the client (server must enforce too)
    if (meData?.membership === "FREE" || !meData?.membership) {
      setStatus("Membership required.");
      return;
    }
    if (kind === "DIAMOND_UPGRADE" && meData?.membership !== "MEMBER") {
      setStatus("Diamond upgrade is only for Member accounts.");
      return;
    }

    const challengeUrl =
      kind === "PAYOUT_LINK" ? "/api/auth/wallet-link/challenge" : "/api/auth/diamond/upgrade-challenge";
    const verifyUrl =
      kind === "PAYOUT_LINK" ? "/api/auth/wallet-link/verify" : "/api/auth/diamond/upgrade";

    setBusy("link");
    try {
      setStatus("Requesting challenge…");
      const challengeRes = await fetch(challengeUrl, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const challengeData = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !challengeData.ok) {
        setStatus(challengeData.error || "Failed to get challenge.");
        setBusy(null);
        return;
      }

      const { message, nonce } = challengeData;

      setStatus("Signing…");
      const msgBytes = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signatureBytes);

      setStatus("Verifying…");
      const verifyRes = await fetch(verifyUrl, {
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
        if (verifyData.error === "WALLET_ALREADY_LINKED") {
          setStatus("This wallet is already linked to another account.");
        } else {
          setStatus(verifyData.error || "Verification failed.");
        }
        setBusy(null);
        return;
      }

      await refreshMe();
      window.dispatchEvent(new Event("auth-changed"));
      setStatus(kind === "PAYOUT_LINK" ? "Payout wallet linked!" : "Upgrade started!");
      onDone?.();
    } catch (e: any) {
      setStatus(e?.message || "Failed.");
    } finally {
      setBusy(null);
    }
  }

  // Mode-derived UI state
  const canAct =
    !!wallet.connected &&
    !!wallet.publicKey &&
    !!wallet.signMessage &&
    meLoaded &&
    (mode === "WALLET_LOGIN" ? true : isAuthed);

  const linkedLabel =
    mode === "WALLET_LOGIN"
      ? (isAuthLinked ? "Auth wallet matches account" : "")
      : (mode === "PAYOUT_LINK"
          ? (isPayoutLinked ? "Payout wallet linked" : "Not linked as payout")
          : (isAuthLinked ? "Auth wallet set" : "Not upgraded"));

  return (
    <div className="space-y-3">
      {p.isAndroid && !p.isChromeAndroid && (
        <div className="text-xs text-white/50">Android tip: wallet connect works best in Chrome.</div>
      )}

      {!wallet.connected ? (
        <>
          {(p.isIos || p.isAndroid) && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-full font-semibold text-white transition"
              style={{
                background: "linear-gradient(135deg, #9945FF 0%, #7B3FE4 100%)",
                border: "2px solid #FF1493",
                boxShadow: "0 0 12px rgba(255, 20, 147, 0.4)",
              }}
            >
              Open in Phantom
            </button>
          )}

          <button
            onClick={() => setVisible(true)}
            className={[
              "w-full py-3 px-6 rounded-full font-semibold transition",
              (p.isIos || p.isAndroid) ? "text-white/50 bg-white/10 border border-white/20" : "text-white",
            ].join(" ")}
            style={(p.isIos || p.isAndroid) ? {} : {
              background: "linear-gradient(135deg, #9945FF 0%, #7B3FE4 100%)",
              border: "2px solid #FF1493",
              boxShadow: "0 0 12px rgba(255, 20, 147, 0.4)",
            }}
          >
            Select Wallet
          </button>

          {(p.isIos || p.isAndroid) && (
            <div className="text-xs text-white/40 text-center">
              Wallet connect may not work in mobile browsers. Use Phantom app for best experience.
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Connected Wallet</div>
            <div className="font-mono text-sm text-white">{short(pk)}</div>
          </div>

          {linkedLabel && <div className="mt-2 text-xs text-white/50">{linkedLabel}</div>}

          <div className="mt-3 flex flex-wrap gap-2">
            {showDisconnect && (
              <button
                onClick={async () => {
                  await wallet.disconnect();
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" }).catch(() => {});
                  window.dispatchEvent(new Event("auth-changed"));
                  await refreshMe();
                }}
                className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold text-white/70 hover:bg-white/20 hover:text-white transition"
              >
                Disconnect/Sign-Out
              </button>
            )}

            {mode === "WALLET_LOGIN" ? (
              <button
                onClick={walletLogin}
                disabled={!canAct || busy !== null || successPulse}
                onAnimationEnd={(e) => {
                  if (e.animationName === "xessPop" && successNavTo) window.location.href = successNavTo;
                }}
                className={[
                  "rounded-xl px-4 py-2 font-semibold transition flex items-center justify-center gap-2",
                  successPulse
                    ? "bg-pink-400 text-black animate-[xessPop_220ms_ease-out]"
                    : busy === "signin"
                      ? "bg-pink-500/60 text-black/70 cursor-not-allowed"
                      : "bg-pink-500 text-black hover:bg-pink-400",
                ].join(" ")}
              >
                {successPulse ? (
                  <>
                    <Checkmark />
                    <span>Success</span>
                  </>
                ) : busy === "signin" ? (
                  <>
                    <Spinner />
                    <span>{status || "Signing in…"}</span>
                  </>
                ) : (
                  <span>Sign in with Wallet</span>
                )}
              </button>
            ) : mode === "PAYOUT_LINK" ? (
              <button
                onClick={() => dbLinkFlow("PAYOUT_LINK")}
                disabled={!canAct || busy !== null}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
              >
                {busy === "link" ? "Linking…" : "Link payout wallet"}
              </button>
            ) : (
              <button
                onClick={() => dbLinkFlow("DIAMOND_UPGRADE")}
                disabled={!canAct || busy !== null}
                className="rounded-xl bg-sky-400 px-4 py-2 font-semibold text-black hover:bg-sky-300 disabled:opacity-50"
              >
                {busy === "link" ? "Upgrading…" : "Upgrade to Diamond"}
              </button>
            )}
          </div>
        </div>
      )}

      {status && !busy && <div className="text-sm text-white/70">{status}</div>}

      {/* Not Registered Modal (only relevant for wallet login) */}
      {showNotRegisteredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-black/95 border border-pink-500/40 rounded-2xl p-6 max-w-md mx-4 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
            <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
            <p className="text-white/70 text-sm mb-6">
              Connect your wallet to create an account and get started.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowNotRegisteredModal(false);
                  window.location.href = "/login/diamond";
                }}
                className="w-full py-3 px-6 rounded-xl font-semibold text-white transition bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
              >
                Connect Wallet
              </button>
              <button
                onClick={() => setShowNotRegisteredModal(false)}
                className="w-full py-2 px-6 rounded-xl font-semibold text-white/60 transition hover:text-white/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for New Users */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-black via-black/95 to-pink-950/30 border border-pink-500/40 rounded-2xl p-6 max-w-lg mx-auto shadow-[0_0_40px_rgba(236,72,153,0.3)]">
            <div className="text-center mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-4">
              Welcome to Xessex!
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              If you&apos;re tired of trying to watch adult content and having to go through a dozen videos to find one decent one, you&apos;ve found your new source for porn!
            </p>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              We are literally made to solve that problem. All our videos are great quality, and on top of that we have a <span className="text-pink-400 font-semibold">Ranking system that pays YOU</span> for your valuable opinions.
            </p>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Unlock more videos with the credits you earn and help us build a legendary organized porn list where we aim to discover the hottest video on the web!
            </p>
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white transition bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .xess-check-draw {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: xessCheck 420ms ease-out forwards;
        }
        @keyframes xessCheck {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes xessPop {
          0% { transform: scale(0.98); }
          60% { transform: scale(1.03); }
          100% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
}
