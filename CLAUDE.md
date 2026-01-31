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
