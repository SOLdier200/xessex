import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

// Username validation: 2-20 chars, letters, numbers, special characters allowed
const USERNAME_REGEX = /^[\w\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]{2,20}$/;

/**
 * POST /api/profile/username
 * Set or update username
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ ok: false, error: "missing_username" }, { status: 400 });
    }

    const trimmed = username.trim();

    // Validate length
    if (trimmed.length < 2 || trimmed.length > 20) {
      return NextResponse.json({ ok: false, error: "invalid_length" }, { status: 400 });
    }

    // Validate characters
    if (!USERNAME_REGEX.test(trimmed)) {
      return NextResponse.json({ ok: false, error: "invalid_characters" }, { status: 400 });
    }

    // Check if username is already taken (case insensitive)
    const existing = await db.user.findFirst({
      where: {
        username: { equals: trimmed, mode: "insensitive" },
        id: { not: user.id },
      },
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }

    // Update username
    await db.user.update({
      where: { id: user.id },
      data: { username: trimmed },
    });

    return NextResponse.json({ ok: true, username: trimmed });
  } catch (error) {
    console.error("Username update error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/username
 * Remove username
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { username: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Username delete error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
