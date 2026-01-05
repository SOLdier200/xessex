import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Rate limit config
const WINDOW_SECS = 60;
const MAX_PER_WINDOW = 30;

function getClientIp(req: NextRequest): string {
  // If behind proxy/CDN, x-forwarded-for should be set
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  let body: { commentId: string; visitorId: string; vote: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { commentId, visitorId, vote } = body;

  if (!commentId || typeof commentId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing commentId" }, { status: 400 });
  }

  if (!visitorId || typeof visitorId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing visitorId" }, { status: 400 });
  }

  if (vote !== 1 && vote !== -1) {
    return NextResponse.json({ ok: false, error: "Vote must be 1 (up) or -1 (down)" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECS);

  try {
    // Use a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Check comment exists
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new Error("COMMENT_NOT_FOUND");
      }

      // Rate limiting - visitor
      await tx.rateLimit.upsert({
        where: {
          scope_key_windowStart: {
            scope: "vote:visitor",
            key: visitorId,
            windowStart,
          },
        },
        create: {
          scope: "vote:visitor",
          key: visitorId,
          windowStart,
          count: 1,
        },
        update: {
          count: { increment: 1 },
        },
      });

      const visitorRate = await tx.rateLimit.findUnique({
        where: {
          scope_key_windowStart: {
            scope: "vote:visitor",
            key: visitorId,
            windowStart,
          },
        },
      });

      // Rate limiting - IP
      await tx.rateLimit.upsert({
        where: {
          scope_key_windowStart: {
            scope: "vote:ip",
            key: ip,
            windowStart,
          },
        },
        create: {
          scope: "vote:ip",
          key: ip,
          windowStart,
          count: 1,
        },
        update: {
          count: { increment: 1 },
        },
      });

      const ipRate = await tx.rateLimit.findUnique({
        where: {
          scope_key_windowStart: {
            scope: "vote:ip",
            key: ip,
            windowStart,
          },
        },
      });

      // Check if rate limited
      if ((visitorRate?.count ?? 0) > MAX_PER_WINDOW || (ipRate?.count ?? 0) > MAX_PER_WINDOW) {
        // Log blocked attempt
        await tx.voteEvent.create({
          data: {
            visitorId,
            commentId,
            ip,
            userAgent,
            action: "blocked",
            vote,
            prevVote: null,
          },
        });
        throw new Error("RATE_LIMITED");
      }

      // Check existing vote
      const existing = await tx.commentVote.findUnique({
        where: {
          visitorId_commentId: {
            visitorId,
            commentId,
          },
        },
      });

      let action: string;
      let newUpCount = comment.upCount;
      let newDownCount = comment.downCount;
      let userVote: number | null = vote;

      if (!existing) {
        // New vote
        await tx.commentVote.create({
          data: {
            visitorId,
            commentId,
            vote,
          },
        });

        if (vote === 1) {
          newUpCount += 1;
        } else {
          newDownCount += 1;
        }
        action = vote === 1 ? "up" : "down";

        // Log event
        await tx.voteEvent.create({
          data: {
            visitorId,
            commentId,
            ip,
            userAgent,
            action,
            vote,
            prevVote: null,
          },
        });
      } else if (existing.vote === vote) {
        // Same vote - toggle off (remove vote)
        await tx.commentVote.delete({
          where: {
            visitorId_commentId: {
              visitorId,
              commentId,
            },
          },
        });

        if (vote === 1) {
          newUpCount -= 1;
        } else {
          newDownCount -= 1;
        }
        action = "noop";
        userVote = null;

        // Log event
        await tx.voteEvent.create({
          data: {
            visitorId,
            commentId,
            ip,
            userAgent,
            action: "toggle_off",
            vote: null,
            prevVote: existing.vote,
          },
        });
      } else {
        // Flip vote
        await tx.commentVote.update({
          where: {
            visitorId_commentId: {
              visitorId,
              commentId,
            },
          },
          data: {
            vote,
          },
        });

        // Adjust counts: remove old, add new
        if (vote === 1) {
          // Flipping from down to up
          newUpCount += 1;
          newDownCount -= 1;
        } else {
          // Flipping from up to down
          newUpCount -= 1;
          newDownCount += 1;
        }
        action = "flip";

        // Log event
        await tx.voteEvent.create({
          data: {
            visitorId,
            commentId,
            ip,
            userAgent,
            action,
            vote,
            prevVote: existing.vote,
          },
        });
      }

      // Update comment counts
      await tx.comment.update({
        where: { id: commentId },
        data: {
          upCount: newUpCount,
          downCount: newDownCount,
        },
      });

      // Cleanup old rate limit windows (keep last 2 hours)
      await tx.rateLimit.deleteMany({
        where: {
          windowStart: {
            lt: windowStart - 120,
          },
        },
      });

      return {
        upvotes: newUpCount,
        downvotes: newDownCount,
        userVote,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "COMMENT_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Comment not found" }, { status: 404 });
    }
    if (error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { ok: false, error: "Rate limited. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    console.error("Vote error:", error);
    return NextResponse.json({ ok: false, error: "Vote failed" }, { status: 500 });
  }
}
