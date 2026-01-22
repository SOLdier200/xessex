/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { getAccessContext } from "@/lib/access";

export default async function ProvisionalBanner() {
  const ctx = await getAccessContext();
  const sub = ctx.sub;

  const isProvisional =
    !!sub && sub.status === "PARTIAL" && !!sub.expiresAt && sub.expiresAt.getTime() > Date.now();

  if (!isProvisional) return null;

  const until = sub.expiresAt!.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 mb-4">
      <div className="text-white font-semibold">Provisional Member access</div>
      <div className="text-white/70 text-sm mt-1">
        Your payment is under review. Provisional access expires on{" "}
        <span className="text-white font-semibold">{until}</span>.
      </div>
      <div className="text-white/60 text-xs mt-2">
        If you paid with Cash App, make sure you included your verification code in the note.
      </div>
    </div>
  );
}
