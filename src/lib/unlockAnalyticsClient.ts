/**
 * Client-side unlock analytics helper.
 * Tracks events like LOCKED_IMPRESSION, UNLOCK_CLICK, WATCH_AFTER_UNLOCK.
 */

export async function trackUnlockEvent(
  event: string,
  opts?: { videoId?: string; meta?: Record<string, unknown> }
) {
  try {
    // Get or create persistent session ID
    const sessionId = (() => {
      if (typeof window === "undefined") return null;
      const k = "xessex_session_id";
      let v = localStorage.getItem(k);
      if (!v) {
        v = crypto.randomUUID();
        localStorage.setItem(k, v);
      }
      return v;
    })();

    await fetch("/api/analytics/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        sessionId,
        videoId: opts?.videoId ?? null,
        meta: opts?.meta ?? null,
      }),
    });
  } catch {
    // Silently ignore analytics errors
  }
}
