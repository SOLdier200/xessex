import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * DELETE /api/profile/avatar
 * Removes the user's profile picture
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const oldKey = user.profilePictureKey;

    if (!oldKey) {
      return NextResponse.json({ ok: true, message: "no_avatar" });
    }

    // Clear the profile picture key
    await db.user.update({
      where: { id: user.id },
      data: { profilePictureKey: null },
    });

    // Delete from R2
    try {
      await deleteR2Object(oldKey);
    } catch {
      // Silent fail - file might not exist
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Avatar delete error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
