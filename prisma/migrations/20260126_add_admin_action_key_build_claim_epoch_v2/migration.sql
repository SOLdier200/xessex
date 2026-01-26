-- Add admin action key for v2 claim epoch builds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AdminActionKey' AND e.enumlabel = 'BUILD_CLAIM_EPOCH_V2'
  ) THEN
    ALTER TYPE "AdminActionKey" ADD VALUE 'BUILD_CLAIM_EPOCH_V2';
  END IF;
END$$;
