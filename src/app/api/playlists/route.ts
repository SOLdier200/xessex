/**
 * GET /api/playlists - List user's playlists
 * POST /api/playlists - Create a new playlist
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const playlists = await db.playlist.findMany({
    where: { userId: access.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          video: {
            select: { thumbnailUrl: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isPublic: p.isPublic,
      itemCount: p._count.items,
      thumbnails: p.items
        .map((i) => i.video.thumbnailUrl)
        .filter((url): url is string => !!url),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: { name?: string; description?: string; isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ ok: false, error: "name_too_long" }, { status: 400 });
  }

  const description = (body.description || "").trim() || null;
  if (description && description.length > 500) {
    return NextResponse.json({ ok: false, error: "description_too_long" }, { status: 400 });
  }

  const playlist = await db.playlist.create({
    data: {
      userId: access.user.id,
      name,
      description,
      isPublic: body.isPublic ?? false,
    },
  });

  return NextResponse.json({
    ok: true,
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      itemCount: 0,
      thumbnails: [],
      createdAt: playlist.createdAt.toISOString(),
      updatedAt: playlist.updatedAt.toISOString(),
    },
  });
}
