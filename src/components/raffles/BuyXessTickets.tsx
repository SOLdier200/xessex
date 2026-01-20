"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { buildXessRaffleTicketTx, getConnectionClient } from "@/lib/client/solanaRaffleBuy";

type Props = {
  onSuccess?: () => void; // call to refetch /api/raffles/status
};

export default function BuyXessTickets({ onSuccess }: Props) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [tickets, setTickets] = useState<string>("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const ticketsBig = useMemo(() => {
    try {
      const n = BigInt(tickets.trim() || "0");
      return n;
    } catch {
      return 0n;
    }
  }, [tickets]);

  async function buy() {
    setErr(null);
    setLastSig(null);

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (ticketsBig <= 0n) {
      setErr("Enter a valid number of tickets.");
      return;
    }

    setBusy(true);
    try {
      const connection = getConnectionClient();
      const { tx } = buildXessRaffleTicketTx({ buyer: publicKey, tickets: ticketsBig });

      // send
      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      setLastSig(sig);

      // confirm
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature: sig, ...latest },
        "confirmed"
      );

      // notify server to mint tickets
      const res = await fetch("/api/raffles/buy/xess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txSig: sig }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "server_rejected_purchase");
      }

      onSuccess?.();
      setTickets("1");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="text-white font-semibold mb-2">Buy XESS Raffle Tickets</div>

      <div className="text-white/60 text-sm mb-3">
        Price: <span className="text-white">100 XESS</span> per ticket
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={tickets}
          onChange={(e) => setTickets(e.target.value)}
          className="w-28 rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-white"
          inputMode="numeric"
          placeholder="1"
          disabled={busy}
        />
        <button
          onClick={buy}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition disabled:opacity-60"
        >
          {connected ? (busy ? "Processing..." : "Pay with Wallet") : "Connect Wallet"}
        </button>
      </div>

      {lastSig && (
        <div className="mt-3 text-xs text-white/60 break-all">
          Tx: <span className="text-white">{lastSig}</span>
        </div>
      )}

      {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
    </div>
  );
}
