import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { deleteR2Object, putR2Object, signR2GetUrl, signR2PutUrl } from "@/lib/r2";

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

    const contentTypeHeader = req.headers.get("content-type") || "";
    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
      }

      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
      }

      const timestamp = Date.now();
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const key = `avatars/${user.id}-${timestamp}.${ext}`;
      const oldKey = user.profilePictureKey;

      const bytes = new Uint8Array(await file.arrayBuffer());
      await putR2Object(key, bytes, file.type);

      await db.user.update({
        where: { id: user.id },
        data: { profilePictureKey: key },
      });

      if (oldKey && oldKey !== key) {
        await deleteR2Object(oldKey).catch(() => {});
      }

      const avatarUrl = await signR2GetUrl(key, 3600);

      return NextResponse.json({
        ok: true,
        key,
        avatarUrl,
      });
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
