# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Database
pnpm prisma generate  # Generate Prisma client after schema changes
pnpm prisma migrate dev --name <name>  # Create a new migration
pnpm prisma db push   # Push schema changes without migration (dev only)
```

## Architecture

### Tech Stack
- **Next.js 16** with App Router (React 19)
- **Prisma** with PostgreSQL (hosted on Supabase)
- **better-sqlite3** for local video curation database (`embeds.db`)
- **Solana wallet adapter** for Phantom/Solflare authentication
- **Tailwind CSS 4** for styling
- **Resend** for transactional emails

### Dual Database Pattern
This app uses two databases:
1. **Prisma/PostgreSQL** (`src/lib/prisma.ts`): User accounts, sessions, subscriptions, comments, ratings
2. **SQLite** (`src/lib/db.ts`): Video catalog and curation data from `embeds.db`

Video metadata lives in SQLite; user-generated content and auth data live in PostgreSQL.

### Authentication Flow
- Session-based auth via HTTP-only cookies (`src/lib/auth.ts`, `src/lib/authCookies.ts`)
- Supports both email/password and Solana wallet sign-in
- Wallet linking allows email users to connect a Solana wallet later
- Sessions stored in Prisma `Session` table with configurable TTL

### Access Control (`src/lib/access.ts`)
Three tiers: `free`, `member`, `diamond`
- Free: Can view showcase videos only
- Member: Can view all videos, vote on comments
- Diamond: Full access including commenting and star ratings
- Admin/Mod roles determined by `ADMIN_WALLETS` env var

### Key Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/app/api/` - REST API endpoints
- `src/app/components/` - Shared UI components
- `src/lib/` - Core utilities (auth, db, email, access control, scoring)
- `src/components/` - Solana wallet providers and auth components
- `prisma/` - Database schema and migrations
- `data/approved.json` - Published video list for homepage

### Provider Hierarchy
`src/app/layout.tsx` wraps the app with:
1. `AgeGateEnforcer` - Age verification gate
2. `Providers` - Solana wallet context (ConnectionProvider → WalletProvider → WalletModalProvider)
3. `Toaster` - Toast notifications via sonner

### Path Alias
`@/*` maps to `./src/*` (e.g., `import { db } from "@/lib/prisma"`)

## Important Notes
- User should handle running/restarting dev and production servers manually
- Do not add logos to created content unless explicitly instructed
- Always close div tags properly when editing JSX

## Payment Systems

### NOWPayments (Crypto)
- Invoice IDs in `src/app/api/billing/nowpayments/start/route.ts` (PLAN_META)
- IPN webhook at `/api/billing/nowpayments/ipn`
- Success/failed/partial redirects at `/billing/nowpayments/{success,failed,partial}`
- Plan codes: M90 (90 days $10), MY (yearly $40), D1 (monthly $9), D2 (60 days $30), DY (yearly $70)

### Cash App (Manual Payments)
- Plan selection: `/paywithcashapp` → `/paywithcashapp/[plan]`
- Plans: member_monthly ($4), member_yearly ($40), diamond_monthly ($9), diamond_yearly ($70)
- Cash App tag: `$vape200100` (Jose Valdez)
- Creates `ManualPayment` records with verification codes
- Admin approval at `/admin/controls` → ManualPaymentsPanel

### Signup Page Payment Tabs
- Three tabs: Crypto, Cash App, Credit Card (coming soon)
- State: `paymentMethod: "crypto" | "cashapp" | "creditcard"`
- Crypto shows NOWPayments options
- Cash App shows $4/$40 Member, $9/$70 Diamond with links to `/paywithcashapp/[plan]`
- Credit Card shows disabled "Coming soon..." buttons

## Diamond Rewards Pipeline

### Weekly Distribution Flow
1. **weekly-distribute** (`/api/cron/rewards/weekly-distribute`)
   - Creates `RewardEvent` records with status=PAID
   - Pools: 75% Likes, 20% MVM, 5% Comments
   - Requires `weekKey` (Monday-based) and `weekIndex` (weeks since genesis 2026-01-19)

2. **build-week** (`/api/cron/claims/build-week`)
   - Finds PAID RewardEvents, builds merkle tree
   - Creates `ClaimEpoch` (epoch, weekKey, rootHex) and `ClaimLeaf` records
   - Uses SHA256 merkle tree compatible with Solana

3. **set-epoch-root** (CLI: `node solana-programs/xess-claim/set-epoch-root.mjs <epoch> <rootHex>`)
   - Publishes merkle root on-chain

4. **mark-epoch-onchain** (`/api/admin/mark-epoch-onchain`)
   - Sets `setOnChain=true` in ClaimEpoch after on-chain publish

### Key Models
- `RewardEvent`: Individual reward records (status: PENDING → PAID → claimed via claimedAt)
- `ClaimEpoch`: Weekly merkle roots (epoch is @id, no separate id field)
- `ClaimLeaf`: Per-user claim data with merkle proof
- `RewardBatch`: Weekly batch metadata

### Admin Pipeline UI
- `/admin/payout-pipeline` - Step-by-step UI for running the full flow
- `/api/admin/recompute-rewards-epoch` - Computes weekKey/weekIndex and calls weekly-distribute

## Recent Session Changes (Jan 2026)

### Signup Page 3-Tab Payment Selector
- Added `paymentMethod` state with Crypto/Cash App/Credit Card tabs
- Each tab shows appropriate membership options and pricing
- Cash App links to `/paywithcashapp/[plan]` routes
- Credit Card shows "Coming soon..." disabled buttons
- Files: `src/app/signup/page.tsx`

### Admin UI Updates
- Changed "Manage Subscriptions" → "Manage NOWPayments Subscriptions"
- File: `src/app/admin/controls/page.tsx`

### Bug Fixes
- Fixed `epoch.id` → `epoch.epoch` in rewards/summary/route.ts (ClaimEpoch uses epoch as @id)

### Wallet/Auth UX Overhaul
Comprehensive fix for wallet connection issues across platforms.

**Key Files:**
- `src/app/providers.tsx` - Global Solana wallet provider (used in layout.tsx)
- `src/components/SolanaProviders.tsx` - Alternative provider (used by /link-wallet)
- `src/components/AccountWalletStatus.tsx` - Status panel showing Account/Wallet/Link states
- `src/components/WalletActions.tsx` - State-based wallet action buttons with 409 handling
- `src/components/EmailLoginBox.tsx` - Simplified, routes to /link-wallet for Diamond wallet linking
- `src/app/login/page.client.tsx` - Uses AccountWalletStatus + WalletActions
- `src/app/link-wallet/page.tsx` - Dedicated wallet linking page

**Provider Configuration (src/app/providers.tsx):**
- Platform detection: `getPlatform()` checks for Android/iOS
- Desktop adapters (Phantom, Solflare) always included
- MWA (Mobile Wallet Adapter) only added on Android, never iOS
- `autoConnect` enabled for session persistence
- CSS import: `@solana/wallet-adapter-react-ui/styles.css`

**Mental Model - Three Separate States:**
1. Account session (email/Google login)
2. Wallet connection (browser extension or mobile)
3. Wallet linked to account (for payments/identity)

**409 WALLET_NOT_LINKED Handling:**
When wallet sign-in returns 409, WalletActions shows guided modal with:
- "Link this wallet" button → /link-wallet
- "Switch account (log out)" button

**API Response Shape (`/api/auth/me`):**
```typescript
{
  ok: true,
  authed: true,
  user: { id, email, role, solWallet, walletAddress },
  // Legacy fields for backward compat
  membership, walletAddress, hasEmail, needsSolWalletLink, sub
}
```

**Test Page:**
`/wallet-test` - Sanity check page with WalletMultiButton to verify provider chain works

### Video Rank System
`src/lib/videoRank.ts` - Recomputes video rankings using ROW_NUMBER() over avgStars, adminScore, starsCount, createdAt

### Admin Subscriptions Page Enhancements (Jan 2026)
Enhanced `/admin/subscriptions` with Expected vs Paid price tracking and grand totals.

**Files Modified:**
- `src/app/api/admin/subscriptions/list/route.ts` - API with plan catalog and totals
- `src/app/admin/subscriptions/page.tsx` - UI with mismatch highlighting and footer totals

**Plan Catalog (in API route):**
```typescript
// NOWPayments (parsed from orderId prefix like sx_M90_...)
NOW_PLAN_USD_CENTS: { M90: 1000, MY: 4000, D1: 900, D2: 3000, DY: 7000 }

// CashApp (from ManualPayment.planCode)
member_monthly: 400, member_yearly: 4000, diamond_monthly: 900, diamond_yearly: 7000
```

**New API Response Fields:**
- `expectedUsdCents` - Plan price from catalog (not recorded amount)
- `paidDisplay` - Actual paid amount from provider (e.g., "$9.00" or "0.069 SOL")
- `totalsAll` - Grand totals for entire filter: `{ count, expectedUsdCents, paidUsdCents, paidUsdCount, paidNonUsdCount }`

**UI Features:**
- Two columns: Expected | Paid (with mismatch detection)
- Paid cell highlighting:
  - Gray = normal (matches expected or crypto)
  - Yellow = mismatch (paid differs from expected)
  - Red = underpaid (paid < expected)
- Tooltip on hover shows expected amount
- Footer with two rows:
  1. Page totals (current loaded rows)
  2. Grand totals (all matching subscriptions for current filter)

### 14-Day Free Trial System (Jan 2026)
Implemented a complete free trial system with Diamond upsell teasers.

**Schema Changes (`prisma/schema.prisma`):**
- Added `trialUsed`, `trialStartedAt`, `trialEndsAt` fields to User model
- Added `TRIAL` to SubscriptionStatus enum

**Key Files:**
- `src/lib/auth.ts` - Two subscription helpers:
  - `isSubscriptionActive()` - Returns true only for ACTIVE/TRIAL (used for trial eligibility)
  - `hasSubscriptionAccess()` - Returns true for ACTIVE/TRIAL/PENDING/PARTIAL (used for content gating)
- `src/lib/access.ts` - Trial flags: `isOnTrial`, `trialUsed`, `trialDaysLeft`, `canStartTrial`, `trialDurationDays`
- `src/app/api/trial/start/route.ts` - POST endpoint to start trial
- `src/app/api/auth/me/route.ts` - Returns all trial fields from access context

**UI Components:**
- `src/app/components/TrialBanner.tsx` - Shows trial countdown with urgency styling when < 3 days left
- `src/app/components/DiamondTeaser.tsx` - Diamond upsell banner for trial/member users
- `src/app/signup/page.tsx` - "Start 14-Day Free Trial" button in trial banner and CC Member card

**Trial Flow:**
1. User signs up (no subscription created at registration)
2. User clicks "Start Free Trial" → `/api/trial/start`
3. Sets `user.trialUsed=true`, creates subscription with `status=TRIAL`, `tier=MEMBER`
4. User gets Member access for 14 days
5. TrialBanner shows countdown, DiamondTeaser prompts upgrade

**Error Codes (`/api/trial/start`):**
- `UNAUTHENTICATED` (401) - Not logged in
- `TRIAL_ALREADY_USED` (409) - Already used trial
- `ALREADY_SUBSCRIBED` (409) - Has ACTIVE/TRIAL subscription
- `INTERNAL_ERROR` (500) - Server error

**Critical Bug Fix - Placeholder Subscriptions:**
Registration routes were creating PENDING subscriptions with `expiresAt: null`, which granted free access.

Fixed by:
1. `hasSubscriptionAccess()` now returns `false` for PENDING with null expiry
2. Removed placeholder subscription creation from:
   - `/api/auth/email/register-for-checkout/route.ts`
   - `/api/auth/verify/route.ts`

**Rule:** Subscriptions are only created when:
- Payment is confirmed (ACTIVE)
- Trial is started (TRIAL)
- NOWPayments checkout starts (PENDING with real expiry)

### Credit Card Tab Enhancements (Jan 2026)
Updated Credit Card tab on signup page to match premium styling of other tabs.

**Changes to CC Diamond Card:**
- Added `id="diamond-card-cc"` for scroll targeting
- Changed opacity from 0.70 to 0.90 (less dead, still signals not live)
- Added "Exclusive Diamond badge" list item
- Added luxury copy block with 4 benefit tiles
- Added "Credit Card: Coming soon" notice

**Changes to CC Member Card:**
- Added 14-day trial button (works even though CC checkout is disabled)
- Shows trial status if active

**Diamond Card IDs for Scroll:**
- `diamond-card-crypto` - Crypto tab
- `diamond-card-cashapp` - Cash App tab
- `diamond-card-cc` - Credit Card tab

### Member XESS Rewards & Special Credits Expansion (Jan 2026)
Extended the rewards system to include Members (not just Diamond) and expanded Special Credits to all tiers.

**Member Voting Rewards:**
- Members now earn XESS for voting (likes) on comments
- Added Pending XESS and Paid XESS display to Member profiles
- Added History tab to Member profiles showing reward history
- Vote tracking now works for ALL members regardless of wallet status
- Files: `src/app/profile/page.tsx`, `src/app/api/comments/vote/route.ts`

**V2 Claim System (userId-based):**
- Rewards allocated by userId, not wallet address
- Users can claim with ANY wallet at claim time (wallet checked at claim, not earn)
- Merkle tree uses `userKey = keccak256(userId)` for leaves
- Member rewards created with null wallet, V2 system handles claim routing
- Files: `src/app/api/cron/rewards/weekly-distribute/route.ts`

**Emission Schedule Update (200M Total):**
Tokenomics changed from 300M to 200M for rewards (20% of 1B supply).
```typescript
// src/app/api/cron/rewards/weekly-distribute/route.ts
function getWeeklyEmission(weekIndex: number): bigint {
  if (weekIndex < 12) return 666_667n * EMISSION_MULTIPLIER;  // Phase 1: ~8M total
  if (weekIndex < 39) return 500_000n * EMISSION_MULTIPLIER;  // Phase 2: ~13.5M total
  if (weekIndex < 78) return 333_333n * EMISSION_MULTIPLIER;  // Phase 3: ~13M total
  return 166_667n * EMISSION_MULTIPLIER;                      // Phase 4: ~165.5M remaining
}
```

**Pool Splits:**
- 70% Likes Pool (was 75%)
- 20% MVM Pool
- 5% Comments Pool
- 5% Referrals Pool

**Likes Sub-Pools:**
- 85% Weekly Diamond Pool
- 10% All-Time Pool
- 5% Member Voter Pool (new)

**Diamond Auto-Link Wallet:**
When a user becomes Diamond via wallet login, their wallet is auto-linked as `solWallet`.
Added to:
- `src/app/api/billing/nowpayments/ipn/route.ts`
- `src/app/api/admin/manual-payments/[id]/approve/route.ts`
- `src/app/api/admin/subscriptions/activate/route.ts`

**Special Credits Tier System:**
Updated tier table with new monthly credit amounts and added 50k tier.
```typescript
// src/lib/specialCredits.ts
TIER_TABLE = [
  { minBalance: 0n, monthlyCredits: 0n },        // Tier 0: Below 50k
  { minBalance: 50_000n, monthlyCredits: 30n },  // Tier 1: 50k XESS
  { minBalance: 100_000n, monthlyCredits: 100n }, // Tier 2: 100k XESS
  { minBalance: 250_000n, monthlyCredits: 250n }, // Tier 3: 250k XESS
  { minBalance: 500_000n, monthlyCredits: 500n }, // Tier 4: 500k XESS
  { minBalance: 1_000_000n, monthlyCredits: 1_000n }, // Tier 5: 1M XESS
  { minBalance: 2_500_000n, monthlyCredits: 1_500n }, // Tier 6: 2.5M XESS
  { minBalance: 5_000_000n, monthlyCredits: 2_000n }, // Tier 7: 5M XESS
]
```

**Membership Redemption Pricing:**
Updated credit costs for redeeming membership time.
```typescript
// src/app/api/rewards-drawing/redeem/route.ts
MEMBER_CREDITS_PER_MONTH = 1000n;  // was 100
DIAMOND_CREDITS_PER_MONTH = 2000n; // was 200
```

**Special Credits for Members:**
Members can now earn Special Credits by linking a wallet with XESS tokens.
- Added conditional UI in profile Special Credits section
- If `solWallet` is linked: Shows balance and "Enter Drawing" button
- If no `solWallet`: Shows "Start Earning Special Credits" prompt with:
  - "Link Wallet to Earn Credits" button → `/link-wallet`
  - "View Earning Tiers" button to see credit formula
- File: `src/app/profile/page.tsx`

**Other Fixes:**
- Member ID now shows full ID (was truncated with `slice(0,8)...`)
- Fixed vote tracking to work without wallet (removed `if (voterHasWallet)` condition)

### iOS Wallet Sign-In Loop Fix (Jan 2026)
Fixed infinite "sign again" loop on iOS where Phantom kept reopening after signing.

**Root Cause:**
- iOS Phantom deep-link returns cause page remount/reload
- `useWalletSessionAutoFix` hook would fire on remount
- Hook called `syncWalletSession()` which triggered `signMessage()`
- Phantom reopened → repeat forever
- React refs (`lastPub.current`) reset on remount, so guards didn't survive

**Fix - Two Key Changes:**

1. **`syncWalletSession()` now has `mode` parameter:**
   - `mode: "auto"` (default) - NEVER signs, only passive cookie check
   - `mode: "manual"` - allowed to sign (user clicked button)
   - File: `src/lib/walletAuthFlow.ts`

2. **`useWalletSessionAutoFix` uses sessionStorage guard:**
   - Replaced ref-based guard with `sessionStorage` (survives iOS remounts)
   - 60-second cooldown per wallet pubkey
   - Always calls `syncWalletSession(wallet, { mode: "auto" })`
   - File: `src/hooks/useWalletSessionAutoFix.ts`

**Rule:** Never call `wallet.signMessage()` inside a `useEffect`. Signing must always be behind a user click.

**Files Modified:**
- `src/lib/walletAuthFlow.ts` - Added `mode` parameter
- `src/hooks/useWalletSessionAutoFix.ts` - sessionStorage guard + auto mode only
