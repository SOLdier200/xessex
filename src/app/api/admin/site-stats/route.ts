import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const pageViews = await db.siteStat.findUnique({
      where: { key: "page_views" },
    });

    return NextResponse.json({
      pageViews: pageViews?.value?.toString() || "0",
    });
  } catch (error) {
    console.error("Error fetching site stats:", error);
    return NextResponse.json({ pageViews: "0" });
  }
}
