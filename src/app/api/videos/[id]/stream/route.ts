/**
 * Video Stream API
 *
 * GET /api/videos/[id]/stream
 * Returns a signed R2 URL for authorized video playback.
 *
 * Access requirements:
 * - Free videos (unlockCost=0): No auth required
 * - Locked videos: Must be unlocked by user OR user is admin/mod
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";
import { signR2GetUrl, extractR2Key } from "@/lib/r2";

export const runtime = "nodejs";

const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoKey } = await params;

  // Find video by id or slug
  const video = await db.video.findFirst({
    where: {
      OR: [{ id: videoKey }, { slug: videoKey }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      kind: true,
      unlockCost: true,
      mediaUrl: true,
      embedUrl: true,
      isActive: true,
    },
  });

  if (!video) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: noCache }
    );
  }

  // For EMBED videos, return the embed URL directly
  if (video.kind === "EMBED") {
    return NextResponse.json(
      {
        ok: true,
        type: "embed",
        embedUrl: video.embedUrl,
      },
      { headers: noCache }
    );
  }

  // XESSEX videos require mediaUrl
  if (!video.mediaUrl) {
    return NextResponse.json(
      { ok: false, error: "no_media_url" },
      { status: 500, headers: noCache }
    );
  }

  const ctx = await getAccessContext();

  // Free videos (unlockCost = 0) don't require auth
  const isFree = video.unlockCost === 0;

  if (!isFree) {
    // Must be authenticated for locked videos
    if (!ctx.isAuthed || !ctx.user) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401, headers: noCache }
      );
    }

    // Admin/mod bypass
    const hasStaffAccess = ctx.isAdminOrMod;

    if (!hasStaffAccess) {
      // Check if user has unlocked this video
      const unlock = await db.videoUnlock.findUnique({
        where: {
          userId_videoId: {
            userId: ctx.user.id,
            videoId: video.id,
          },
        },
        select: { id: true },
      });

      if (!unlock) {
        return NextResponse.json(
          { ok: false, error: "not_unlocked", unlockCost: video.unlockCost },
          { status: 403, headers: noCache }
        );
      }
    }
  }

  // Generate signed URL
  try {
    const r2Key = extractR2Key(video.mediaUrl);
    const signedUrl = await signR2GetUrl(r2Key, 3600); // 1 hour expiry

    return NextResponse.json(
      {
        ok: true,
        type: "stream",
        streamUrl: signedUrl,
        expiresIn: 3600,
      },
      { headers: noCache }
    );
  } catch (err) {
    console.error("R2 signing error:", err);
    return NextResponse.json(
      { ok: false, error: "stream_generation_failed" },
      { status: 500, headers: noCache }
    );
  }
}
