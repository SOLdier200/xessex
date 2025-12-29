import { NextRequest, NextResponse } from "next/server";
import { getVideoByViewkey, updateCuration, type CurationStatus } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ rowid: string }> };

// Note: [rowid] is actually viewkey in the new architecture
export async function GET(_request: NextRequest, context: RouteContext) {
  const { rowid: viewkey } = await context.params;

  const video = getVideoByViewkey(viewkey);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { rowid: viewkey } = await context.params;

  const body = await request.json();

  const updateData: { status?: CurationStatus; note?: string; favorite?: boolean } = {};

  if (typeof body.status === "string") {
    updateData.status = body.status as CurationStatus;
  }

  if (typeof body.note === "string") {
    updateData.note = body.note;
  }

  if (typeof body.favorite === "boolean") {
    updateData.favorite = body.favorite;
  }

  if (Object.keys(updateData).length > 0) {
    updateCuration(viewkey, updateData);
  }

  const updated = getVideoByViewkey(viewkey);
  return NextResponse.json(updated);
}
