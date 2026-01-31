-- Remove solWallet and solWalletLinkedAt columns from User table
-- These are no longer needed as walletAddress is now used for both auth and payouts

-- Drop the unique constraint on solWallet first
DROP INDEX IF EXISTS "User_solWallet_key";

-- Remove the columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "solWallet";
ALTER TABLE "User" DROP COLUMN IF EXISTS "solWalletLinkedAt";

-- Remove PAYOUT_LINK from WalletLinkPurpose enum
-- First update any existing records to AUTH_LINK
UPDATE "WalletLinkChallenge" SET "purpose" = 'AUTH_LINK' WHERE "purpose" = 'PAYOUT_LINK';

-- Note: Postgres doesn't support removing enum values easily
-- The PAYOUT_LINK value will remain in the enum but won't be used
-- A full enum recreation would require more complex migration
