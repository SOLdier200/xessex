import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/admin/make-me-admin
 * Temporary helper to promote current user to ADMIN
 * Requires ADMIN_API_KEY header
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-api-key");

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  return NextResponse.json({
    ok: true,
    user: { id: updated.id, role: updated.role },
  });
}
