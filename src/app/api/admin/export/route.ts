import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getApprovedVideos } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const videos = getApprovedVideos();

  const outDir = path.join(process.cwd(), "data");
  const outFile = path.join(outDir, "approved.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(videos, null, 2), "utf8");

  return NextResponse.json({
    ok: true,
    exported: videos.length,
    file: "data/approved.json",
  });
}
