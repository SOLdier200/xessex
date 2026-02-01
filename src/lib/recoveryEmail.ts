import crypto from "crypto";

type RecoveryEmailPayload = {
  userId: string;
  email: string;
  exp: number; // unix ms
};

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getRecoveryEmailSecret() {
  return (
    process.env.RECOVERY_EMAIL_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.WALLET_CHALLENGE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://xessex.me";
}

export function createRecoveryEmailToken(params: { userId: string; email: string; ttlMinutes?: number }) {
  const secret = getRecoveryEmailSecret();
  if (!secret) {
    throw new Error("RECOVERY_EMAIL_SECRET_MISSING");
  }

  const ttlMinutes = params.ttlMinutes ?? 30;
  const payload: RecoveryEmailPayload = {
    userId: params.userId,
    email: params.email,
    exp: Date.now() + ttlMinutes * 60_000,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyRecoveryEmailToken(token: string): RecoveryEmailPayload | null {
  const secret = getRecoveryEmailSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const provided = Buffer.from(sig, "base64url");
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;

  let payload: RecoveryEmailPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
  if (!payload?.userId || !payload?.email || !payload?.exp) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}
