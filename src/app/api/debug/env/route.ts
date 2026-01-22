import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    ADMIN_WALLETS: process.env.ADMIN_WALLETS || "",
    hasAdminWallets: !!process.env.ADMIN_WALLETS,
  });
}
