/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import type { SubscriptionTier } from "@prisma/client";

export type ManualPlanCode =
  | "member_monthly"
  | "member_yearly"
  | "diamond_monthly"
  | "diamond_yearly";

export const MANUAL_PLANS: Record<
  ManualPlanCode,
  { requestedTier: SubscriptionTier; label: string; amountCents: number; durationDays: number }
> = {
  member_monthly: { requestedTier: "MEMBER", label: "Member (Monthly)", amountCents: 300, durationDays: 30 },
  member_yearly: { requestedTier: "MEMBER", label: "Member (Yearly)", amountCents: 3000, durationDays: 365 },
  diamond_monthly: { requestedTier: "DIAMOND", label: "Diamond (Monthly)", amountCents: 900, durationDays: 30 },
  diamond_yearly: { requestedTier: "DIAMOND", label: "Diamond (Yearly)", amountCents: 9000, durationDays: 365 },
};
