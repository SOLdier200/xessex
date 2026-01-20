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
