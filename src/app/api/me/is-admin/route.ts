import { getAccessContext } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
  const access = await getAccessContext();
  return NextResponse.json({
    isAdmin: access.isAdminOrMod,
    role: access.user?.role || null,
    isMod: access.user?.role === "MOD",
    isAdminRole: access.user?.role === "ADMIN",
  });
}
