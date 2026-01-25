/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function inferAuthProvider(user: NonNullable<Awaited<ReturnType<typeof getAccessContext>>["user"]>) {
  // Match your schema fields exactly
  if (user.walletAddress) return "wallet" as const;
  if (user.email && user.passHash) return "email" as const;
  if (user.email) return "email" as const;
  return "unknown" as const;
}

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();

  // Not logged in
  if (!access.user) {
    return NextResponse.json(
      {
        ok: true,
        authed: false,
        user: null,

        membership: "FREE",
        authProvider: "unknown",

        // Trial fields (defaults)
        trialUsed: false,
        trialEndsAt: null,
        isTrial: false,
        trialDaysLeft: 0,
        canStartTrial: false,
        trialDurationDays: 14,

        // Permissions (defaults)
        canViewAllVideos: false,
        canComment: false,
        canRateStars: false,
        canVoteComments: false,

        // Wallet / tier helpers (defaults)
        hasAuthWallet: false,
        hasPayoutWallet: false,
        hasAnyWallet: false,
        diamondReady: false,
        needsAuthWalletLink: false,
        needsPayoutWalletLink: false,
        needsSolWalletLink: false,

        // Role
        isAdminOrMod: false,
      },
      { headers: noCache }
    );
  }

  const u = access.user;
  const sub = access.sub;
  const authProvider = inferAuthProvider(u);

  return NextResponse.json(
    {
      ok: true,
      authed: access.isAuthed,

      user: {
        id: u.id,
        memberId: u.memberId,
        role: u.role,
        createdAt: u.createdAt.toISOString(),

        email: u.email,
        walletAddress: u.walletAddress,
        solWallet: u.solWallet,
        solWalletLinkedAt: u.solWalletLinkedAt ? u.solWalletLinkedAt.toISOString() : null,

        // Trial fields on User (source of truth for "ever used trial" + dates)
        trialUsed: u.trialUsed,
        trialStartedAt: u.trialStartedAt ? u.trialStartedAt.toISOString() : null,
        trialEndsAt: u.trialEndsAt ? u.trialEndsAt.toISOString() : null,

        // Subscription (status already exists here, as you noted)
        subscription: sub
          ? {
              id: sub.id,
              userId: sub.userId,
              tier: sub.tier,
              status: sub.status,
              expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
              paymentMethod: sub.paymentMethod,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              amountCents: sub.amountCents,
              manualPaymentId: sub.manualPaymentId,
              nowPaymentsPaymentId: sub.nowPaymentsPaymentId,
              nowPaymentsInvoiceId: sub.nowPaymentsInvoiceId,
              nowPaymentsOrderId: sub.nowPaymentsOrderId,
              lastTxSig: sub.lastTxSig,
              createdAt: sub.createdAt.toISOString(),
              updatedAt: sub.updatedAt.toISOString(),
            }
          : null,
      },

      // Membership + access summary
      membership: access.tier === "diamond" ? "DIAMOND" : access.tier === "member" ? "MEMBER" : "FREE",
      authProvider,
      active: access.active,
      tier: access.tier,
      isAdminOrMod: access.isAdminOrMod,

      // Wallet status (from access.ts)
      hasAuthWallet: access.hasAuthWallet,
      hasPayoutWallet: access.hasPayoutWallet,
      hasAnyWallet: access.hasAnyWallet,
      diamondReady: access.diamondReady,
      needsAuthWalletLink: access.needsAuthWalletLink,
      needsPayoutWalletLink: access.needsPayoutWalletLink,
      needsSolWalletLink: access.needsSolWalletLink,

      // Wallet addresses (for iOS rehydration detection)
      authWallet: u.walletAddress || null,
      payoutWallet: u.solWallet || null,
      effectivePayoutWallet: u.solWallet || u.walletAddress || null,

      // Trial status (computed in access.ts)
      isTrial: access.isOnTrial,
      trialUsed: access.trialUsed,
      trialEndsAt: access.trialEndsAt ? access.trialEndsAt.toISOString() : null,
      trialDaysLeft: access.trialDaysLeft,
      canStartTrial: access.canStartTrial,
      trialDurationDays: access.trialDurationDays,

      // Permissions (computed in access.ts)
      canViewAllVideos: access.canViewAllVideos,
      canComment: access.canComment,
      canRateStars: access.canRateStars,
      canVoteComments: access.canVoteComments,
    },
    { headers: noCache }
  );
}
