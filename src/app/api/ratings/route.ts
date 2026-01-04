import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  if (!isSubscriptionActive(user)) {
    return NextResponse.json(
      { ok: false, error: "Diamond membership required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { viewkey, stars } = body;

  if (!viewkey || typeof viewkey !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing viewkey" },
      { status: 400 }
    );
  }

  if (!stars || typeof stars !== "number" || stars < 1 || stars > 5) {
    return NextResponse.json(
      { ok: false, error: "Stars must be 1-5" },
      { status: 400 }
    );
  }

  // Check if user already rated this video
  const existing = await prisma.rating.findUnique({
    where: {
      userId_viewkey: {
        userId: user.id,
        viewkey,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "You have already rated this video" },
      { status: 409 }
    );
  }

  // Create rating
  await prisma.rating.create({
    data: {
      userId: user.id,
      viewkey,
      stars,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewkey = searchParams.get("viewkey");

  if (!viewkey) {
    return NextResponse.json(
      { ok: false, error: "Missing viewkey" },
      { status: 400 }
    );
  }

  // Get average rating and count
  const ratings = await prisma.rating.findMany({
    where: { viewkey },
    select: { stars: true },
  });

  const count = ratings.length;
  const average = count > 0
    ? ratings.reduce((sum, r) => sum + r.stars, 0) / count
    : 0;

  // Check if current user has rated
  const user = await getCurrentUser();
  let userRating: number | null = null;

  if (user) {
    const existing = await prisma.rating.findUnique({
      where: {
        userId_viewkey: {
          userId: user.id,
          viewkey,
        },
      },
    });
    userRating = existing?.stars ?? null;
  }

  return NextResponse.json({
    ok: true,
    average: Math.round(average * 10) / 10,
    count,
    userRating,
  });
}
