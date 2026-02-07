import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const cs = process.env.CRON_SECRET || "";
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    ADMIN_WALLETS: process.env.ADMIN_WALLETS || "",
    hasAdminWallets: !!process.env.ADMIN_WALLETS,
    cronSecretFirst8: cs.slice(0, 8) || "(empty)",
    cronSecretLen: cs.length,
  });
}
