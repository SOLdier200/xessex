export function getClientIp(req: Request): string {
  // Common reverse-proxy headers
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  // Fallback
  return "0.0.0.0";
}

export function getUserAgent(req: Request): string | null {
  return req.headers.get("user-agent");
}
