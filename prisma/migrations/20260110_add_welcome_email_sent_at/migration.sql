ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMP(3);
