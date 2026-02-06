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
1. **Prisma/PostgreSQL** (`src/lib/prisma.ts`): User accounts, sessions, comments, ratings, rewards
2. **SQLite** (`src/lib/db.ts`): Video catalog and curation data from `embeds.db`

Video metadata lives in SQLite; user-generated content and auth data live in PostgreSQL.

### Authentication Flow
- Session-based auth via HTTP-only cookies (`src/lib/auth.ts`, `src/lib/authCookies.ts`)
- Supports both email/password and Solana wallet sign-in
- Wallet linking allows email users to connect a Solana wallet later
- Sessions stored in Prisma `Session` table with configurable TTL

### Access Control (`src/lib/access.ts`)
Wallet-native access model:
- All authenticated users can view videos, vote on comments, and earn rewards
- Video unlocks via Special Credits (earned by holding XESS tokens)
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

## Rewards Pipeline

### Twice-Weekly Distribution Flow (v2)
XESS rewards are now paid out twice weekly (P1 and P2 periods) instead of weekly.

**Payout Periods (PT timezone):**
- **Period 1 (P1)**: Sunday-Wednesday activity, paid out Wednesday evening
- **Period 2 (P2)**: Thursday-Saturday activity, paid out Saturday evening
- Each period emits **half** the weekly allocation

**Period Key Format:** `YYYY-MM-DD-P1` or `YYYY-MM-DD-P2` where date is the Sunday of the week.

1. **weekly-distribute** (`/api/cron/rewards/weekly-distribute`)
   - Creates `RewardEvent` records with status=PAID
   - Pools: 70% Likes, 20% MVM, 5% Comments, 5% Referrals
   - **New params:** `periodKey` (e.g., "2026-01-19-P1"), `weekIndex` (weeks since genesis)
   - Legacy `weekKey` param falls back to P1 for backwards compatibility
   - Stats are looked up by the underlying weekKey (same for both periods)

2. **build-week** (`/api/cron/claims/build-week`)
   - Data-driven: finds latest periodKey with PAID RewardEvents
   - Builds merkle tree per period (each period gets its own epoch)
   - Creates `ClaimEpoch` and `ClaimLeaf` records

3. **set-epoch-root** (CLI: `node solana-programs/xess-claim/set-epoch-root.mjs <epoch> <rootHex>`)
   - Publishes merkle root on-chain

4. **mark-epoch-onchain** (`/api/admin/mark-epoch-onchain`)
   - Sets `setOnChain=true` in ClaimEpoch after on-chain publish

### Key Helpers (`src/lib/weekKey.ts`)
```typescript
weekKeySundayMidnightPT(d)   // Returns "YYYY-MM-DD" for Sunday of week in PT
getPayoutPeriod(d)           // Returns 1 (Sun-Wed) or 2 (Thu-Sat)
periodKeyPT(d)               // Returns "YYYY-MM-DD-P1" or "YYYY-MM-DD-P2"
parsePeriodKey(periodKey)    // Parses back to {weekKey, period}
```

### Key Models
- `RewardEvent`: Individual reward records; `weekKey` field stores periodKey for twice-weekly
- `ClaimEpoch`: Merkle roots per period (epoch is @id, weekKey stores periodKey)
- `ClaimLeaf`: Per-user claim data with merkle proof
- `RewardBatch`: Batch metadata; `weekKey` stores periodKey for uniqueness

### Admin Pipeline UI
- `/admin/payout-pipeline` - Step-by-step UI for running the full flow
- `/api/admin/recompute-rewards-epoch` - Computes periodKey/weekIndex and calls weekly-distribute
  - GET: Returns period info for current and last week (P1/P2 batch status)
  - POST: Accepts `periodKey` (new) or `weekKey` (legacy, defaults to P1)

## Wallet/Auth UX
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
3. Wallet linked to account (for identity)

**409 WALLET_NOT_LINKED Handling:**
When wallet sign-in returns 409, WalletActions shows guided modal with:
- "Link this wallet" button → /link-wallet
- "Switch account (log out)" button

**Test Page:**
`/wallet-test` - Sanity check page with WalletMultiButton to verify provider chain works

### Video Rank System
`src/lib/videoRank.ts` - Recomputes video rankings using ROW_NUMBER() over avgStars, adminScore, starsCount, createdAt

### XESS Rewards & Special Credits
Users earn XESS for voting (likes) on comments. All users can earn Special Credits by linking a wallet with XESS tokens.

**V2 Claim System (userId-based):**
- Rewards allocated by userId, not wallet address
- Users can claim with ANY wallet at claim time (wallet checked at claim, not earn)
- Merkle tree uses `userKey = keccak256(userId)` for leaves
- Files: `src/app/api/cron/rewards/weekly-distribute/route.ts`

**Pool Splits:**
- 70% Likes Pool
- 20% MVM Pool
- 5% Comments Pool
- 5% Referrals Pool

**Special Credits Tier System:**
```typescript
// src/lib/specialCredits.ts
TIER_TABLE = [
  { minBalance: 0n, monthlyCredits: 0n },          // Tier 0: Below 10k
  { minBalance: 10_000n, monthlyCredits: 80n },    // Tier 1: 10k XESS
  { minBalance: 25_000n, monthlyCredits: 240n },   // Tier 2: 25k XESS
  { minBalance: 50_000n, monthlyCredits: 480n },   // Tier 3: 50k XESS
  { minBalance: 100_000n, monthlyCredits: 1_600n },  // Tier 4: 100k XESS
  { minBalance: 250_000n, monthlyCredits: 4_000n }, // Tier 5: 250k XESS
  { minBalance: 500_000n, monthlyCredits: 8_000n }, // Tier 6: 500k XESS
  { minBalance: 1_000_000n, monthlyCredits: 16_000n }, // Tier 7: 1M XESS
  { minBalance: 2_500_000n, monthlyCredits: 24_000n }, // Tier 8: 2.5M XESS
  { minBalance: 5_000_000n, monthlyCredits: 32_000n }, // Tier 9: 5M XESS
]
```

**Twice-Daily Special Credits Accrual:**
- Credits accrue twice per day (AM and PM slots, PT timezone)
- Cron: `/api/cron/daily-xess-snapshot-and-credits` runs twice daily
- Each accrual = (monthlyCredits / daysInMonth / 2) microcredits
- Idempotent via refId: `${userId}:${dateKey}:${timeSlot}` (e.g., "user123:2026-01-19:AM")
- AM = before noon PT, PM = noon and after
- Uses `calculateTwiceDailyAccrual()` for fractional carry-over handling

### iOS Wallet Sign-In Loop Fix
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
