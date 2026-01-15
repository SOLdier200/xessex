import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST() {
  try {
    await db.siteStat.upsert({
      where: { key: "page_views" },
      update: { value: { increment: 1 } },
      create: { key: "page_views", value: 1 },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error tracking view:", error);
    return NextResponse.json({ ok: false });
  }
}
