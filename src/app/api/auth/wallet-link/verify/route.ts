import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * DEPRECATED: Separate payout wallet linking is no longer supported.
 * User's authentication wallet (walletAddress) is now used for payouts.
 */
export async function POST() {
  return NextResponse.json(
    { 
      ok: false, 
      error: "DEPRECATED",
      message: "Separate payout wallet linking is no longer supported. Your sign-in wallet is used for payouts."
    }, 
    { status: 410 } // 410 Gone
  );
}
