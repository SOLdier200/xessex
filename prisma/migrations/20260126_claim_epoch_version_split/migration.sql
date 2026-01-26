-- Split claim epochs by version (v1 wallet, v2 userKey)

-- Ensure version/buildHash columns exist
ALTER TABLE "ClaimEpoch" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClaimEpoch" ADD COLUMN IF NOT EXISTS "buildHash" TEXT;

-- Drop legacy unique constraint on weekKey (single-version assumption)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClaimEpoch_weekKey_key'
  ) THEN
    ALTER TABLE "ClaimEpoch" DROP CONSTRAINT "ClaimEpoch_weekKey_key";
  END IF;
END$$;

-- Add composite unique constraint on (weekKey, version)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClaimEpoch_weekKey_version_key'
  ) THEN
    ALTER TABLE "ClaimEpoch"
      ADD CONSTRAINT "ClaimEpoch_weekKey_version_key" UNIQUE ("weekKey", "version");
  END IF;
END$$;

-- Drop legacy unique constraint that prevented v1/v2 for same week
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClaimLeaf_weekKey_wallet_key'
  ) THEN
    ALTER TABLE "ClaimLeaf" DROP CONSTRAINT "ClaimLeaf_weekKey_wallet_key";
  END IF;
END$$;
