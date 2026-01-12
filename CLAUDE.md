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
