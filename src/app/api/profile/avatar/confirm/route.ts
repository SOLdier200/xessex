import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { signR2GetUrl, deleteR2Object } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * POST /api/profile/avatar/confirm
 * Confirms avatar upload and updates user's profilePictureKey
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });
    }

    // Validate that the key belongs to this user
    if (!key.startsWith(`avatars/${user.id}-`)) {
      return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 400 });
    }

    // Get the old avatar key to delete later
    const oldKey = user.profilePictureKey;

    // Update user's profile picture key
    await db.user.update({
      where: { id: user.id },
      data: { profilePictureKey: key },
    });

    // Delete old avatar if it exists and is different
    if (oldKey && oldKey !== key) {
      try {
        await deleteR2Object(oldKey);
      } catch {
        // Silent fail - old file might not exist
      }
    }

    // Generate signed URL for the new avatar
    const avatarUrl = await signR2GetUrl(key, 3600);

    return NextResponse.json({
      ok: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("Avatar confirm error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
