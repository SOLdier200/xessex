ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "supabaseId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseId_key"
ON "public"."User" ("supabaseId");
