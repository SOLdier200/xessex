import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!token || !zoneId) {
    const msg = "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID";
    await markActionRun("FLUSH_CLOUDFLARE_CACHE", false, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success !== true) {
      const msg =
        data?.errors?.[0]?.message || `Cloudflare purge failed (${res.status})`;
      await markActionRun("FLUSH_CLOUDFLARE_CACHE", false, msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    await markActionRun("FLUSH_CLOUDFLARE_CACHE", true, "Cloudflare cache purged");
    return NextResponse.json({ ok: true, message: "Cloudflare cache purged" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("FLUSH_CLOUDFLARE_CACHE", false, msg);
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_PURGE_CLOUDFLARE" },
      { status: 500 }
    );
  }
}
