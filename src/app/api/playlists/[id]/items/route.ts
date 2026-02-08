/**
 * POST /api/playlists/[id]/items - Add video to playlist
 * DELETE /api/playlists/[id]/items - Remove video from playlist
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const playlist = await db.playlist.findUnique({
    where: { id: playlistId },
    select: { userId: true },
  });

  if (!playlist) {
    return NextResponse.json({ ok: false, error: "playlist_not_found" }, { status: 404 });
  }

  if (playlist.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  let body: { videoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { videoId } = body;
  if (!videoId) {
    return NextResponse.json({ ok: false, error: "video_id_required" }, { status: 400 });
  }

  // Check video exists
  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "video_not_found" }, { status: 404 });
  }

  // Check if already in playlist
  const existing = await db.playlistItem.findUnique({
    where: {
      playlistId_videoId: { playlistId, videoId },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  // Get max position
  const maxPos = await db.playlistItem.aggregate({
    where: { playlistId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const item = await db.playlistItem.create({
    data: {
      playlistId,
      videoId,
      position,
    },
  });

  // Update playlist timestamp
  await db.playlist.update({
    where: { id: playlistId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: item.id,
      position: item.position,
      addedAt: item.addedAt.toISOString(),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const playlist = await db.playlist.findUnique({
    where: { id: playlistId },
    select: { userId: true },
  });

  if (!playlist) {
    return NextResponse.json({ ok: false, error: "playlist_not_found" }, { status: 404 });
  }

  if (playlist.userId !== access.user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  let body: { videoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { videoId } = body;
  if (!videoId) {
    return NextResponse.json({ ok: false, error: "video_id_required" }, { status: 400 });
  }

  // Delete the item
  const result = await db.playlistItem.deleteMany({
    where: { playlistId, videoId },
  });

  if (result.count === 0) {
    return NextResponse.json({ ok: true, notInPlaylist: true });
  }

  // Update playlist timestamp
  await db.playlist.update({
    where: { id: playlistId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
