import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAllApprovedVideos } from "@/lib/db";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function POST() {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const videos = getAllApprovedVideos();

  const outDir = path.join(process.cwd(), "data");
  const outFile = path.join(outDir, "approved.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(videos, null, 2), "utf8");

  // Count by source
  const embedsCount = videos.filter((v) => v.source === "embeds").length;
  const youpornCount = videos.filter((v) => v.source === "youporn").length;

  return NextResponse.json({
    ok: true,
    exported: videos.length,
    embeds: embedsCount,
    youporn: youpornCount,
    file: "data/approved.json",
  });
}
