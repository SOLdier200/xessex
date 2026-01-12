import { NextRequest, NextResponse } from "next/server";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (nextValue.startsWith("/") && !nextValue.startsWith("//")) {
    return nextValue;
  }
  return "/";
}

function resolveOrigin(request: NextRequest) {
  const forwardedHostHeader = request.headers.get("x-forwarded-host");
  const forwardedProtoHeader = request.headers.get("x-forwarded-proto");
  const forwardedPortHeader = request.headers.get("x-forwarded-port");
  const hostHeader = request.headers.get("host");
  const forwardedHost = forwardedHostHeader?.split(",")[0].trim();
  const forwardedProto = forwardedProtoHeader?.split(",")[0].trim();
  const forwardedPort = forwardedPortHeader?.split(",")[0].trim();
  const rawHost = (forwardedHost || hostHeader || "").split(",")[0].trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "");
  const envOrigin = process.env.NEXT_PUBLIC_BASE_URL;
  let origin = request.nextUrl.origin;

  if (rawHost) {
    const host =
      forwardedPort && !rawHost.includes(":")
        ? `${rawHost}:${forwardedPort}`
        : rawHost;
    origin = `${proto}://${host}`;
  } else if (envOrigin) {
    origin = envOrigin;
  }

  return { origin, proto };
}

function buildAcceptResponse(request: NextRequest, nextPath: string) {
  const { origin, proto } = resolveOrigin(request);
  const redirectUrl = new URL(nextPath, origin);
  const response = NextResponse.redirect(redirectUrl, 303);

  response.cookies.set({
    name: "age_ok",
    value: "1",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: proto === "https",
    httpOnly: false,
  });
  response.cookies.set({
    name: "age_verified",
    value: "true",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: proto === "https",
    httpOnly: false,
  });

  return response;
}

export async function POST(request: NextRequest) {
  let nextValue: string | null = null;
  try {
    const form = await request.formData();
    const raw = form.get("next");
    nextValue = typeof raw === "string" ? raw : null;
  } catch {}
  const nextPath = sanitizeNext(nextValue);
  return buildAcceptResponse(request, nextPath);
}

export function GET(request: NextRequest) {
  const { origin } = resolveOrigin(request);
  const redirectUrl = new URL("/age", origin);
  return NextResponse.redirect(redirectUrl, 303);
}
