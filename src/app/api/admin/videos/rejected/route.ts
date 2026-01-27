import { NextRequest, NextResponse } from "next/server";
import { deleteRejectedVideos, type DbSource } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = (searchParams.get("source") as DbSource) || "embeds";
    const count = deleteRejectedVideos(source);
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("Failed to delete rejected videos:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}
