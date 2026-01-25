"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { syncWalletSession } from "@/lib/walletAuthFlow";

const INF_KEY = "xessex_wallet_login_inflight";
const INF_TS = "xessex_wallet_login_started_at";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    (ua.includes("mac") && (navigator as any).maxTouchPoints > 1)
  );
}

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

function getInflight() {
  try {
    return sessionStorage.getItem(INF_KEY) === "1";
  } catch {
    return false;
  }
}

async function settleAuthMe(setStatus?: (s: string) => void) {
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
        return true;
      }
    } catch {}

    if (setStatus) setStatus(i < 2 ? "Finishing up..." : "Syncing session...");
    await sleep(i < 4 ? 250 : 500);
  }
  return false;
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

    // Reset so the animation can play again if the user stays on-page.
    setTimeout(() => {
      setSuccessPulse(false);
      setSuccessNavTo(null);
    }, 1200);
  };

  // One-time "Phantom-return settle" for iOS: when user comes back, finish instantly.
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      if (!getInflight()) return;

      setInFlight(true);
      setStatus("Finishing up...");

      // On iOS, returning from Phantom often remounts; finish auth silently.
      const settled = await settleAuthMe(setStatus);

      if (settled) {
        triggerSuccess("/");
        return;
      }

      // If it didn't settle after ~15s since sign started, allow user to retry.
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

  async function signIn(purpose: "LOGIN" | "DIAMOND_SIGNUP" = "LOGIN") {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus("Wallet does not support message signing.");
      return;
    }

    // Prevent double-run across iOS bounces / rapid taps
    if (getInflight()) return;

    beginInflight();
    setInFlight(true);

    try {
      const addr = wallet.publicKey.toBase58();

      setStatus("Requesting challenge...");
      const c = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ wallet: addr, purpose }),
      }).then((r) => r.json());

      if (!c?.ok || !c?.message) {
        setStatus(c?.error || "Challenge failed. Try again.");
        endInflight();
        setInFlight(false);
        return;
      }

      setStatus("Signing...");
      const msgBytes = new TextEncoder().encode(c.message);

      // This triggers Phantom on iOS (expected)
      const signed = await wallet.signMessage(msgBytes);

      const bs58 = (await import("bs58")).default;
      const signature = bs58.encode(signed);

      setStatus("Verifying...");
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          wallet: addr,
          message: c.message,
          signature,
        }),
      });

      const v = await resp.json().catch(() => ({}));

      if (!resp.ok || !v.ok) {
        if (v.error === "WALLET_NOT_REGISTERED") {
          setStatus("Wallet not registered. Please sign up as Diamond Member first.");
        } else {
          setStatus(v.error || "Login failed");
        }
        endInflight();
        setInFlight(false);
        return;
      }

      // IMPORTANT: DO NOT call signing-capable sync here.
      // Just settle /me. (This avoids a second signMessage prompt on iOS.)
      setStatus("Syncing session...");
      let ok = await settleAuthMe(setStatus);

      // As a backup, do a passive sync that never signs (requires mode patch)
      if (!ok) {
        await syncWalletSession(wallet as any, { mode: "auto" });
        ok = await settleAuthMe(setStatus);
      }

      if (!ok) {
        setStatus("Signed, but session didn't stick. Tap again.");
        endInflight();
        setInFlight(false);
        return;
      }

      // For Diamond signup: create pending Diamond subscription before routing
      if (purpose === "DIAMOND_SIGNUP") {
        setStatus("Setting up Diamond membership...");

        const sresp = await fetch("/api/auth/diamond/start", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const sj = await sresp.json().catch(() => ({}));

        if (!sresp.ok || !sj.ok) {
          setStatus(sj.error || "Failed to start Diamond signup.");
          endInflight();
          setInFlight(false);
          return;
        }

        // Re-settle /me so UI immediately reflects tier/status
        await settleAuthMe(setStatus);

        // Route to signup page with Diamond payment options
        triggerSuccess("/signup#diamond-card-crypto");
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
