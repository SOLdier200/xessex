import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/admin/add-xessex-video
 * Creates a XESSEX video entry in the database
 * Admin only
 */
export async function POST(request: Request) {
  const access = await getAccessContext();

  if (!access.isAdminOrMod) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { slug, title, mediaUrl, thumbnailUrl, posterUrl, unlockCost = 0 } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    // Check if video already exists
    const existing = await db.video.findFirst({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "video_exists", video: existing }, { status: 409 });
    }

    // Create the XESSEX video
    const video = await db.video.create({
      data: {
        slug,
        title,
        embedUrl: mediaUrl || "", // For XESSEX, embedUrl can be the mediaUrl or empty
        mediaUrl,
        thumbnailUrl,
        posterUrl,
        kind: "XESSEX",
        unlockCost,
        isActive: true,
        sortOrder: 0,
      },
    });

    return NextResponse.json({ ok: true, video });
  } catch (error) {
    console.error("Error creating XESSEX video:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
