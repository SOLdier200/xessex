import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { signR2PutUrl } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * POST /api/profile/avatar/upload
 * Returns a presigned URL for uploading an avatar to R2
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Get content type from request body (optional, defaults to image/webp)
    let contentType = "image/webp";
    try {
      const body = await req.json();
      if (body.contentType && ["image/jpeg", "image/png", "image/webp"].includes(body.contentType)) {
        contentType = body.contentType;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Generate unique key for this user's avatar
    const timestamp = Date.now();
    const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
    const key = `avatars/${user.id}-${timestamp}.${ext}`;

    // Generate presigned PUT URL (5 minute expiry)
    const uploadUrl = await signR2PutUrl(key, contentType, 300);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error("Avatar upload URL error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
