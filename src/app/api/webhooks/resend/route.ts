import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Missing webhook secret", { status: 500 });

  let payloadText = "";
  try {
    // Raw body required for verification
    payloadText = await req.text();

    const svixId = req.headers.get("svix-id") || "";
    const svixTimestamp = req.headers.get("svix-timestamp") || "";
    const svixSignature = req.headers.get("svix-signature") || "";

    // Verify with Resend SDK (throws if invalid)
    const verified = resend.webhooks.verify({
      payload: payloadText,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: secret,
    });

    // Extract event type and data
    const type = (verified as unknown as { type?: string })?.type ?? "unknown";
    const data = (verified as unknown as { data?: Record<string, unknown> })?.data ?? {};

    // Extract common fields defensively
    const resendEmailId =
      (data?.email_id as string) || (data?.emailId as string) || (data?.id as string) || null;

    const toField = data?.to;
    const to =
      (toField && Array.isArray(toField) ? toField[0] : toField) ||
      (data?.recipient as string) ||
      null;

    const from = (data?.from as string) || null;
    const subject = (data?.subject as string) || null;

    // Dedupe/replay protection via svix-id unique constraint
    await db.resendWebhookEvent.create({
      data: {
        svixId,
        svixTimestamp,
        svixSignature,
        type,
        resendEmailId,
        to: to as string | null,
        from,
        subject,
        payload: verified as unknown as object,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error;
    // If signature invalid or DB unique conflict, respond safely
    // If duplicate svixId arrives, treat as ok
    const msg = String(error?.message ?? "");
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return NextResponse.json({ ok: true });
    }
    console.error("Resend webhook error:", error);
    return new NextResponse("Invalid webhook", { status: 400 });
  }
}
