import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const file = path.join(process.cwd(), "data", "approved.json");

  if (!fs.existsSync(file)) {
    return NextResponse.json(
      { ok: false, error: "approved.json not found. Export from /admin first." },
      { status: 404 }
    );
  }

  const raw = fs.readFileSync(file, "utf8");
  return new Response(raw, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
