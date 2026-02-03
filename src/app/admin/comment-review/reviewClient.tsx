"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  status: "PENDING" | "HIDDEN";
  autoReason: string | null;
  createdAt: string;
  body: string;
  video: { id: string; videoId: string; title: string | null; kind: string };
  author: { id: string; authorWallet: string };
  reports: {
    unresolvedCount: number;
    reasonCounts: Record<string, number>;
    latestAt: string | null;
  };
};

type QueueResponse = {
  ok: boolean;
  filter: { status: string; limit: number };
  cursor: { nextCursor: string | null };
  items: QueueItem[];
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtIso(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

async function fetchQueue(status: "ALL" | "PENDING" | "HIDDEN", cursor?: string | null) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("limit", "30");
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/mod/comments/queue?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Queue fetch failed (${res.status})`);
  return (await res.json()) as QueueResponse;
}

async function approveComment(commentId: string) {
  const res = await fetch("/api/mod/comments/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "Approve failed");
  return json as { ok: true; alreadyActive: boolean; creditsAwarded: number; statIncremented: boolean };
}

async function removeComment(commentId: string, reason?: string) {
  const res = await fetch("/api/mod/comments/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentId, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "Remove failed");
  return json as { ok: true; alreadyRemoved: boolean };
}

// Detect severe content for auto-ban reason
function isSevereComment(c: QueueItem) {
  const reasons = c.reports.reasonCounts || {};
  const hasSevereReport = Boolean(reasons.THREAT || reasons.SEXUAL_VIOLENCE);

  const auto = (c.autoReason || "").toLowerCase();
  const hasSevereAuto =
    auto.includes("severe") ||
    auto.includes("threat") ||
    auto.includes("sexual") ||
    auto.includes("ai: blocked") ||
    auto.includes("keyword: severe");

  return hasSevereReport || hasSevereAuto;
}

export default function ReviewClient() {
  const [status, setStatus] = useState<"ALL" | "PENDING" | "HIDDEN">("ALL");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState<string>("");

  // Navigation helpers
  const selectedIndex = useMemo(() => items.findIndex((i) => i.id === selectedId), [items, selectedId]);
  const selectByIndex = (idx: number) => {
    if (idx >= 0 && idx < items.length) setSelectedId(items[idx].id);
  };
  const selectNext = () => selectByIndex(selectedIndex + 1);
  const selectPrev = () => selectByIndex(selectedIndex - 1);

  async function loadFirst() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchQueue(status, null);
      setItems(data.items);
      setNextCursor(data.cursor.nextCursor);
      setSelectedId(data.items[0]?.id ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchQueue(status, nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.cursor.nextCursor);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          selectNext();
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          selectPrev();
          break;
        case "a":
        case "A":
          if (selected && !actionBusyId) {
            e.preventDefault();
            onApprove(selected.id, true);
          }
          break;
        case "r":
        case "R":
          if (selected && !actionBusyId) {
            e.preventDefault();
            onRemove(selected.id, true);
          }
          break;
        case "Escape":
          setSelectedId(null);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, actionBusyId, items, selectedIndex]);

  async function onApprove(id: string, goNextAfter = false) {
    const idx = items.findIndex((x) => x.id === id);
    setActionBusyId(id);
    setErr(null);
    try {
      await approveComment(id);
      // Remove from list (it's now ACTIVE and shouldn't be in queue)
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (goNextAfter && idx >= 0 && idx < items.length - 1) {
        // Select the item that will slide into this slot
        setSelectedId(items[idx + 1]?.id ?? null);
      } else if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Approve failed");
    } finally {
      setActionBusyId(null);
    }
  }

  async function onRemove(id: string, goNextAfter = false) {
    const idx = items.findIndex((x) => x.id === id);
    setActionBusyId(id);
    setErr(null);
    try {
      await removeComment(id, removeReason || undefined);
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (goNextAfter && idx >= 0 && idx < items.length - 1) {
        setSelectedId(items[idx + 1]?.id ?? null);
      } else if (selectedId === id) {
        setSelectedId(null);
      }
      setRemoveReason("");
    } catch (e: any) {
      setErr(e?.message ?? "Remove failed");
    } finally {
      setActionBusyId(null);
    }
  }

  // Ban user from commenting for 24h
  async function banUser24h(userId: string, reason: string) {
    try {
      const res = await fetch("/api/mod/users/ban-commenting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, hours: 24, reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to ban user");
        return false;
      }

      if (data?.skipped) {
        toast.success("User is already permanently banned");
        return true;
      }

      toast.success("User banned from commenting for 24h");
      // Clear this user's comments from queue
      setItems((prev) => prev.filter((c) => c.author.id !== userId));
      if (selected?.author.id === userId) setSelectedId(null);
      return true;
    } catch {
      toast.error("Failed to ban user");
      return false;
    }
  }

  // Unban user from commenting
  async function unbanUser(userId: string) {
    try {
      const res = await fetch("/api/mod/users/unban-commenting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to unban user");
        return;
      }

      if (data?.skipped) {
        toast.success("User is permanently banned (not changed)");
        return;
      }

      toast.success("User unbanned for commenting");
    } catch {
      toast.error("Failed to unban user");
    }
  }

  // Permanently ban user from commenting
  async function permBanUser(userId: string, reason: string) {
    try {
      const res = await fetch("/api/mod/users/perm-ban-commenting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to permanently ban user");
        return false;
      }

      if (data?.already) {
        toast.success("User is already permanently banned");
      } else {
        toast.success("User permanently banned from commenting");
      }

      // Clear this user's comments from queue
      setItems((prev) => prev.filter((c) => c.author.id !== userId));
      if (selected?.author.id === userId) setSelectedId(null);
      return true;
    } catch {
      toast.error("Failed to permanently ban user");
      return false;
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4">
      {/* Left: Queue */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              className={cx("px-3 py-1.5 rounded-full text-sm border", status === "ALL" ? "border-white/40" : "border-white/10")}
              onClick={() => setStatus("ALL")}
            >
              All
            </button>
            <button
              className={cx("px-3 py-1.5 rounded-full text-sm border", status === "PENDING" ? "border-white/40" : "border-white/10")}
              onClick={() => setStatus("PENDING")}
            >
              Pending
            </button>
            <button
              className={cx("px-3 py-1.5 rounded-full text-sm border", status === "HIDDEN" ? "border-white/40" : "border-white/10")}
              onClick={() => setStatus("HIDDEN")}
            >
              Hidden
            </button>
          </div>

          <button
            className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-white/25"
            onClick={loadFirst}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">
            {err}
          </div>
        )}

        <div className="mt-3 space-y-2 max-h-[70vh] overflow-auto pr-1">
          {loading && items.length === 0 ? (
            <div className="text-sm opacity-70 px-2 py-6">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm opacity-70 px-2 py-6">No comments in queue.</div>
          ) : (
            items.map((it) => {
              const isSelected = it.id === selectedId;
              return (
                <button
                  key={it.id}
                  className={cx(
                    "w-full text-left rounded-xl border px-3 py-2 transition",
                    isSelected ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/20"
                  )}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs opacity-70">{fmtIso(it.createdAt)}</div>
                    <div className="flex items-center gap-2">
                      <span className={cx("text-xs px-2 py-0.5 rounded-full border",
                        it.status === "PENDING" ? "border-yellow-500/30" : "border-red-500/30"
                      )}>
                        {it.status}
                      </span>
                      {it.reports.unresolvedCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-white/10">
                          {it.reports.unresolvedCount} reports
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 text-sm font-medium truncate">{it.author.authorWallet}</div>
                  <div className="text-xs opacity-80 truncate">{it.video.title ?? it.video.videoId}</div>
                  <div className="mt-1 text-sm opacity-90 truncate">{it.body}</div>
                  {it.autoReason && <div className="mt-1 text-xs opacity-60 truncate">Auto: {it.autoReason}</div>}
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs opacity-60">{items.length} loaded</div>
          <button
            className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-white/25 disabled:opacity-50"
            onClick={loadMore}
            disabled={loading || !nextCursor}
          >
            Load more
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 text-xs opacity-50">
          <span className="font-medium">Shortcuts:</span> ↑/↓ or j/k navigate • A approve & next • R remove & next • Esc deselect
        </div>
      </div>

      {/* Right: Detail */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        {!selected ? (
          <div className="text-sm opacity-70 px-2 py-6">Select a comment to review.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Review</div>
                <div className="text-sm opacity-70 mt-1">
                  {selected.author.authorWallet} • {fmtIso(selected.createdAt)}
                </div>
                <div className="text-sm opacity-70 mt-1">
                  Video: <span className="opacity-90">{selected.video.title ?? selected.video.videoId}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-xl border border-white/15 hover:border-white/30 disabled:opacity-50 text-sm"
                  onClick={() => onApprove(selected.id, false)}
                  disabled={actionBusyId === selected.id}
                >
                  Approve
                </button>
                <button
                  className="px-3 py-1.5 rounded-xl border border-green-500/30 bg-green-500/10 hover:border-green-500/50 disabled:opacity-50 text-sm"
                  onClick={() => onApprove(selected.id, true)}
                  disabled={actionBusyId === selected.id}
                  title="Keyboard: A"
                >
                  Approve & Next
                </button>
                <button
                  className="px-3 py-1.5 rounded-xl border border-red-500/30 hover:border-red-500/60 disabled:opacity-50 text-sm"
                  onClick={() => onRemove(selected.id, false)}
                  disabled={actionBusyId === selected.id}
                >
                  Remove
                </button>
                <button
                  className="px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:border-red-500/50 disabled:opacity-50 text-sm"
                  onClick={() => onRemove(selected.id, true)}
                  disabled={actionBusyId === selected.id}
                  title="Keyboard: R"
                >
                  Remove & Next
                </button>
              </div>
            </div>

            {/* User ban actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs opacity-60 mr-1">User actions:</span>
              <button
                onClick={() =>
                  banUser24h(
                    selected.author.id,
                    isSevereComment(selected)
                      ? "Auto-ban 24h: severe content (threat/sexual violence)"
                      : "Temp ban 24h: abusive behavior"
                  )
                }
                className="px-3 py-1 rounded-lg bg-purple-500/15 text-purple-200 border border-purple-400/30 text-xs font-semibold hover:bg-purple-500/25 transition"
                title="Ban this user from commenting for 24 hours"
              >
                Ban 24h
              </button>
              <button
                onClick={() => unbanUser(selected.author.id)}
                className="px-3 py-1 rounded-lg bg-sky-500/15 text-sky-200 border border-sky-400/30 text-xs font-semibold hover:bg-sky-500/25 transition"
                title="Unban this user from commenting (does not undo permanent bans)"
              >
                Unban
              </button>
              <button
                onClick={async () => {
                  const label = selected.author.authorWallet || selected.author.id.slice(0, 8) + "...";
                  const confirmed = window.confirm(
                    `PERMANENT BAN from commenting?\n\nUser: ${label}\n\nThis cannot be undone by the Unban button. Continue?`
                  );
                  if (!confirmed) return;
                  await permBanUser(
                    selected.author.id,
                    "Permanent ban: severe abuse (threats/hate/sexual violence)"
                  );
                }}
                className="px-3 py-1 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-400/30 text-xs font-semibold hover:bg-fuchsia-500/25 transition"
                title="Permanent commenting ban (requires confirmation)"
              >
                Perm ban
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs opacity-70">Status</div>
              <div className="mt-1 text-sm">
                <span className="px-2 py-0.5 rounded-full border border-white/15">{selected.status}</span>
                {selected.autoReason && <span className="ml-2 text-xs opacity-70">Auto: {selected.autoReason}</span>}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs opacity-70">Comment</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-xs opacity-70">Unresolved reports</div>
                <div className="mt-1 text-sm">
                  {selected.reports.unresolvedCount === 0 ? (
                    <span className="opacity-70">None</span>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(selected.reports.reasonCounts).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between">
                          <span className="text-sm">{k}</span>
                          <span className="text-sm opacity-80">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selected.reports.latestAt && (
                  <div className="mt-2 text-xs opacity-60">Latest report: {fmtIso(selected.reports.latestAt)}</div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="text-xs opacity-70">Remove reason</div>
                <textarea
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                  rows={5}
                  placeholder='Example: "Threat of violence"'
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                />
                <div className="mt-2 text-xs opacity-60">
                  Tip: be brief — this is stored in <code className="opacity-80">removedReason</code>.
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs opacity-60">
              Approve will activate the comment and retro-award credits/stats (if not already granted). Remove marks it
              as REMOVED and resolves open reports.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
