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
  // Use SITE_URL (production) over BASE_URL to avoid localhost:3001 issues
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
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
  const cookieSuffix = `; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${proto === "https" ? "; secure" : ""}`;
  const redirectHref = redirectUrl.toString();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${redirectHref}" />
    <title>Entering...</title>
  </head>
  <body>
    <p>Continuing...</p>
    <p><a href="${redirectHref}">Continue</a></p>
    <script>
      try {
        document.cookie = "age_ok=1${cookieSuffix}";
        document.cookie = "age_verified=true${cookieSuffix}";
      } catch {}
      window.location.replace(${JSON.stringify(redirectHref)});
    </script>
  </body>
</html>`;
  const response = new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

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

async function getNextFromForm(request: NextRequest) {
  try {
    const form = await request.formData();
    const raw = form.get("next");
    return typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const nextValue = await getNextFromForm(request);
  const nextPath = sanitizeNext(nextValue);
  return buildAcceptResponse(request, nextPath);
}

export function GET(request: NextRequest) {
  const nextValue = request.nextUrl.searchParams.get("next");
  const nextPath = sanitizeNext(nextValue);
  return buildAcceptResponse(request, nextPath);
}
