"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import bs58 from "bs58";
import { syncWalletSession } from "@/lib/walletAuthFlow";
import {
  walletLoginChallenge,
  walletLoginVerify,
  settleAuthMe,
  isIOS,
  isWalletNotRegistered,
} from "@/lib/walletFlows";

const INF_KEY = "xessex_wallet_login_inflight";
const INF_TS = "xessex_wallet_login_started_at";

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

function getInflight() {
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
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/20"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" className="xess-check-draw" />
      </svg>
    </span>
  );
}

export default function WalletLoginButton() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [successPulse, setSuccessPulse] = useState(false);
  const [successNavTo, setSuccessNavTo] = useState<string | null>(null);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const ios = isIOS();
    setIsMobile(isAndroid || ios);
  }, []);

  // Keep inFlight state synced with sessionStorage (survives iOS bounce)
  useEffect(() => {
    const sync = () => setInFlight(getInflight());
    sync();

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);

    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const triggerSuccess = (to: string) => {
    setStatus("Logged in!");
    setSuccessNavTo(to);
    setSuccessPulse(true);
    window.dispatchEvent(new Event("auth-changed"));
    endInflight();
    setInFlight(false);

    setTimeout(() => {
      setSuccessPulse(false);
      setSuccessNavTo(null);
    }, 1200);
  };

  // One-time "Phantom-return settle" for iOS
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      if (!getInflight()) return;

      setInFlight(true);
      setStatus("Finishing up...");

      const settled = await settleAuthMe({ requireTier: true });

      if (settled) {
        triggerSuccess("/");
        return;
      }

      const startedAt = Number(sessionStorage.getItem(INF_TS) || "0");
      if (startedAt && Date.now() - startedAt > 15_000) {
        endInflight();
        setInFlight(false);
        setStatus("Session timed out. Tap again.");
      }
    };

    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  const openInPhantom = () => {
    if (typeof window === "undefined") return;
    const url = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  };

  async function signIn() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Wallet does not support message signing.");
      return;
    }

    if (getInflight()) return;

    beginInflight();
    setInFlight(true);

    try {
      const addr = wallet.publicKey.toBase58();

      setStatus("Requesting challenge...");
      const c = await walletLoginChallenge(addr);

      if (!c?.ok || !("message" in c)) {
        setStatus((c as any)?.error || "Challenge failed. Try again.");
        endInflight();
        setInFlight(false);
        return;
      }

      setStatus("Signing...");
      const msgBytes = new TextEncoder().encode(c.message);
      const signed = await wallet.signMessage(msgBytes);
      const signature = bs58.encode(signed);

      setStatus("Verifying...");
      const v = await walletLoginVerify(addr, c.message, signature);

      if (!v.ok) {
        const err = (v as any).error;
        if (isWalletNotRegistered(err)) {
          setShowNotRegisteredModal(true);
          setStatus("");
        } else {
          setStatus(err || "Login failed");
        }
        endInflight();
        setInFlight(false);
        return;
      }

      setStatus("Syncing session...");
      let ok = await settleAuthMe({ requireTier: true });

      if (!ok) {
        await syncWalletSession(wallet as any, { mode: "auto" });
        ok = await settleAuthMe({ requireTier: true });
      }

      if (!ok) {
        setStatus("Signed, but session didn't stick. Tap again.");
        endInflight();
        setInFlight(false);
        return;
      }

      // Show welcome modal for new users - delay navigation until they dismiss it
      if ((v as any).isNewUser) {
        setShowWelcomeModal(true);
        endInflight();
        setInFlight(false);
        window.dispatchEvent(new Event("auth-changed"));
        return;
      }

      triggerSuccess("/");
    } catch (e: any) {
      setStatus(e?.message || "Login failed");
      endInflight();
      setInFlight(false);
    }
  }

  return (
    <div className="space-y-3">
      {!wallet.connected ? (
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

          {isMobile && (
            <button
              onClick={openInPhantom}
              className="w-full py-3 px-6 rounded-full font-semibold text-white/90 transition border border-white/20 bg-white/10 hover:bg-white/15"
            >
              Open in Phantom
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => signIn()}
            disabled={inFlight || successPulse}
            onAnimationEnd={(e) => {
              if (e.animationName === "xessPop" && successNavTo) {
                window.location.href = successNavTo;
              }
            }}
            className={[
              "rounded-xl px-4 py-2 font-semibold transition flex items-center justify-center gap-2",
              successPulse
                ? "bg-pink-400 text-black animate-[xessPop_220ms_ease-out]"
                : inFlight
                  ? "bg-pink-500/60 text-black/70 cursor-not-allowed"
                  : "bg-pink-500 text-black hover:bg-pink-400",
            ].join(" ")}
          >
            {successPulse ? (
              <>
                <Checkmark />
                <span>Success</span>
              </>
            ) : inFlight ? (
              <>
                <Spinner />
                <span>{status || "Working..."}</span>
              </>
            ) : (
              <span>Sign in with wallet</span>
            )}
          </button>
          <button
            onClick={() => wallet.disconnect()}
            disabled={inFlight}
            className={[
              "rounded-xl bg-white/10 border border-white/20 px-4 py-2 font-semibold transition",
              inFlight
                ? "text-white/40 cursor-not-allowed"
                : "text-white/70 hover:bg-white/20 hover:text-white",
            ].join(" ")}
          >
            Disconnect Wallet
          </button>
        </div>
      )}

      {status && !inFlight && <div className="text-sm text-white/70">{status}</div>}

      {/* Not Registered Modal */}
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
              onClick={() => {
                setShowWelcomeModal(false);
                window.location.href = "/";
              }}
              className="w-full py-3 px-6 rounded-xl font-semibold text-white transition bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      )}

      {/* Keyframe animations for checkmark and pop */}
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
