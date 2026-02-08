/**
 * GET /api/playlists/[id] - Get playlist with videos
 * PATCH /api/playlists/[id] - Update playlist (name, description, isPublic)
 * DELETE /api/playlists/[id] - Delete playlist
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await getAccessContext();

  const playlist = await db.playlist.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          video: {
            select: {
              id: true,
              slug: true,
              title: true,
              thumbnailUrl: true,
              avgStars: true,
              starsCount: true,
            },
          },
        },
      },
    },
  });

  if (!playlist) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Only owner can view private playlists
  if (!playlist.isPublic && playlist.userId !== access.user?.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const isOwner = playlist.userId === access.user?.id;

  return NextResponse.json({
    ok: true,
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      isOwner,
      createdAt: playlist.createdAt.toISOString(),
      updatedAt: playlist.updatedAt.toISOString(),
      items: playlist.items.map((item) => ({
        id: item.id,
        position: item.position,
        addedAt: item.addedAt.toISOString(),
        video: {
          id: item.video.id,
          slug: item.video.slug,
          title: item.video.title,
          thumbnailUrl: item.video.thumbnailUrl,
          avgStars: item.video.avgStars,
          starsCount: item.video.starsCount,
        },
      })),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const playlist = await db.playlist.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!playlist) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (playlist.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  let body: { name?: string; description?: string; isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const updates: { name?: string; description?: string | null; isPublic?: boolean } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ ok: false, error: "name_too_long" }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    const description = body.description.trim() || null;
    if (description && description.length > 500) {
      return NextResponse.json({ ok: false, error: "description_too_long" }, { status: 400 });
    }
    updates.description = description;
  }

  if (body.isPublic !== undefined) {
    updates.isPublic = body.isPublic;
  }

  const updated = await db.playlist.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({
    ok: true,
    playlist: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isPublic: updated.isPublic,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const playlist = await db.playlist.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!playlist) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (playlist.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  await db.playlist.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
