"use client";

import { useEffect, useMemo, useState } from "react";

type TokenVerifyResponse =
  | {
      ok: true;
      network: string;
      rpc: string;
      mint: string;
      decimals: number;
      supplyRaw: string;
      supplyUi: string;
      supplyUiExact: string;
      mintAuthority: string | null;
      freezeAuthority: string | null;
      verified: boolean;
      checks: {
        mintMatches: boolean;
        supplyMatches: boolean;
        mintAuthorityDisabled: boolean;
        freezeAuthorityDisabled: boolean;
      };
      expected: {
        mint: string;
        supplyUi: string;
      };
      updatedAt: string;
    }
  | { ok: false; error: string; detail?: string };

function shortAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

export default function VerifyTokenClient() {
  const mint = process.env.NEXT_PUBLIC_XESS_MINT!;
  const [data, setData] = useState<TokenVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const solscan = useMemo(() => `https://solscan.io/token/${mint}`, [mint]);
  const solanafm = useMemo(() => `https://solana.fm/address/${mint}`, [mint]);
  const explorer = useMemo(
    () => `https://explorer.solana.com/address/${mint}?cluster=mainnet`,
    [mint]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/token/xess", { cache: "no-store" });
        const json = (await res.json()) as TokenVerifyResponse;
        if (alive) setData(json);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (alive) setData({ ok: false, error: "fetch_failed", detail: message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const verified = data?.ok === true && data.verified;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white/60">Official Mint Address</div>
          <div className="mt-1 font-mono text-sm md:text-base break-all">{mint}</div>
          <div className="mt-1 text-xs text-white/50">Display: {shortAddr(mint)}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(mint)}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs hover:bg-white/15 transition"
          >
            Copy
          </button>

          <span
            className={[
              "rounded-full px-3 py-2 text-xs border",
              verified
                ? "bg-green-500/15 border-green-500/30 text-green-100"
                : "bg-white/10 border-white/15 text-white/70",
            ].join(" ")}
            title="Verified means mint matches, supply matches, and mint/freeze authority are disabled."
          >
            {loading ? "Checking…" : verified ? "Verified" : "Not verified"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={solscan}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs hover:bg-white/15 transition"
        >
          View on Solscan
        </a>
        <a
          href={solanafm}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs hover:bg-white/15 transition"
        >
          View on SolanaFM
        </a>
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs hover:bg-white/15 transition"
        >
          View on Solana Explorer
        </a>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50">Live On-Chain Details</div>

          {data?.ok === true ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Decimals</span>
                <span className="text-white/90">{data.decimals}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Supply (UI)</span>
                <span className="text-white/90">{data.supplyUi}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Mint Authority</span>
                <span className="text-white/90">{data.mintAuthority ?? "Disabled"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Freeze Authority</span>
                <span className="text-white/90">{data.freezeAuthority ?? "Disabled"}</span>
              </div>
              <div className="pt-2 text-xs text-white/40">Updated: {data.updatedAt}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/70">
              {loading ? "Loading…" : `Unable to verify right now: ${data?.error ?? "unknown"}`}
              {data?.ok === false && data.detail ? (
                <div className="mt-2 text-xs text-white/40">{data.detail}</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs text-white/50">Verification Checks</div>

          {data?.ok === true ? (
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-4">
                <span className="text-white/60">Mint matches</span>
                <span className="text-white/90">{data.checks.mintMatches ? "✓" : "✗"}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-white/60">Supply matches</span>
                <span className="text-white/90">{data.checks.supplyMatches ? "✓" : "✗"}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-white/60">Mint authority disabled</span>
                <span className="text-white/90">{data.checks.mintAuthorityDisabled ? "✓" : "✗"}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-white/60">Freeze authority disabled</span>
                <span className="text-white/90">{data.checks.freezeAuthorityDisabled ? "✓" : "✗"}</span>
              </li>

              <li className="pt-2 text-xs text-white/40">
                Expected supply (UI): {data.expected.supplyUi}
              </li>
            </ul>
          ) : (
            <div className="mt-3 text-sm text-white/70">
              {loading ? "Loading…" : "Checks unavailable."}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-xs text-white/45">
        Disclosure: This page is informational only and not financial advice, an offer, or solicitation.
      </div>
    </div>
  );
}
