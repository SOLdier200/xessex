import { NextResponse } from "next/server";
import { deleteRejectedVideos } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const count = deleteRejectedVideos();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error) {
    console.error("Failed to delete rejected videos:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}
