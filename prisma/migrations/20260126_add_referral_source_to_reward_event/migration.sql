-- Add referral source to RewardEvent for per-referral attribution

ALTER TABLE "RewardEvent"
  ADD COLUMN IF NOT EXISTS "referralFromUserId" TEXT;

-- FK to User (set null if user deleted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RewardEvent_referralFromUserId_fkey'
  ) THEN
    ALTER TABLE "RewardEvent"
      ADD CONSTRAINT "RewardEvent_referralFromUserId_fkey"
      FOREIGN KEY ("referralFromUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "RewardEvent_referralFromUserId_idx" ON "RewardEvent"("referralFromUserId");
