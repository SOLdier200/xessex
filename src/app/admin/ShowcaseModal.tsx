"use client";

import { useEffect, useMemo, useState } from "react";

type PublishedVideo = { slug: string; title: string; isShowcase: boolean };
type CurrentShowcase = { slug: string; title: string };

export default function ShowcaseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [videos, setVideos] = useState<PublishedVideo[]>([]);
  const [current, setCurrent] = useState<CurrentShowcase[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedKeys = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const currentSet = useMemo(() => new Set(current.map((c) => c.slug)), [current]);

  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      try {
        // 1) Current 3 (pinned)
        const curRes = await fetch("/api/admin/showcase");
        const cur = await curRes.json();

        const curList: CurrentShowcase[] = cur.ok && Array.isArray(cur.current) ? cur.current : [];
        setCurrent(curList);

        // preset selection with current 3
        const preset: Record<string, boolean> = {};
        for (const v of curList) preset[v.slug] = true;
        setSelected(preset);

        // 2) Published list
        const listRes = await fetch("/api/admin/published");
        const list = await listRes.json();
        if (list.ok) setVideos(list.videos || []);
      } catch {
        // keep silent
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/published?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (d.ok) setVideos(d.videos || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const toggle = (slug: string) => {
    setSelected((s) => {
      const next = { ...s };
      const willEnable = !next[slug];

      // hard max 3 selected
      const count = Object.keys(next).filter((k) => next[k]).length;
      if (willEnable && count >= 3) return s;

      next[slug] = willEnable;
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    if (selectedKeys.length !== 3) return;

    setSaving(true);
    try {
      const r = await fetch("/api/admin/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewkeys: selectedKeys }),
      });
      const d = await r.json();
      if (d.ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  // Show pinned "current 3" first (even if they don't match search)
  const pinnedRows = useMemo(() => {
    return current.map((c) => ({
      slug: c.slug,
      title: c.title,
      isShowcase: true,
      _pinned: true as const,
    }));
  }, [current]);

  // Dedup: exclude pinned slugs from the general list
  const listRows = useMemo(() => {
    const filtered = videos.filter((v) => !currentSet.has(v.slug));
    return filtered.map((v) => ({ ...v, _pinned: false as const }));
  }, [videos, currentSet]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl neon-border bg-black/90 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-white">
              Select 3 Free Page Videos
            </h2>
            <p className="text-xs md:text-sm text-white/50">
              Updating replaces the old 3 automatically (there will only ever be 3).
            </p>
            <p className="text-xs text-white/40 mt-1">
              Selected: <span className="text-yellow-300">{selectedKeys.length}/3</span>
              {selectedKeys.length !== 3 && (
                <span className="ml-2 text-white/40">(must be exactly 3)</span>
              )}
            </p>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search published videos (title or viewkey)..."
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-white/30 text-sm"
          />
          <button
            onClick={save}
            disabled={saving || selectedKeys.length !== 3}
            className="px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 text-yellow-100 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Updating..." : "Update Free 3"}
          </button>
        </div>

        {loading ? (
          <div className="text-white/60 py-10 text-center">Loading…</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10">
            {/* Pinned current */}
            <div className="p-3 border-b border-white/10 bg-white/[0.02]">
              <div className="text-xs font-semibold text-white/60 mb-2">
                Current Free 3 (pinned)
              </div>

              {pinnedRows.length === 0 ? (
                <div className="text-xs text-white/50">
                  None set yet (once you set them, they will appear here).
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {pinnedRows.map((v) => {
                    const checked = !!selected[v.slug];
                    const disabled = !checked && selectedKeys.length >= 3;

                    return (
                      <button
                        key={v.slug}
                        onClick={() => toggle(v.slug)}
                        disabled={disabled}
                        className={`text-left rounded-xl border px-3 py-2 transition ${
                          checked
                            ? "border-emerald-400/40 bg-emerald-500/10"
                            : "border-white/10 bg-black/40 hover:bg-white/[0.04]"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-emerald-200 font-semibold">
                            {checked ? "Selected" : "Not selected"}
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                            current
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-white font-medium line-clamp-2">
                          {v.title}
                        </div>
                        <div className="mt-1 text-[10px] text-white/40 font-mono break-all">
                          {v.slug}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List */}
            <div className="divide-y divide-white/10">
              {listRows.map((v) => {
                const checked = !!selected[v.slug];
                const disabled = !checked && selectedKeys.length >= 3;

                return (
                  <div key={v.slug} className="p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(v.slug)}
                    />

                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium line-clamp-1">
                        {v.title}
                      </div>
                      <div className="text-xs text-white/40 font-mono break-all">
                        {v.slug}
                      </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {v.isShowcase && !currentSet.has(v.slug) && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                          showcase
                        </span>
                      )}

                      <a
                        href={`https://www.pornhub.com/embed/${v.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-pink-300 hover:underline"
                      >
                        preview
                      </a>
                    </div>
                  </div>
                );
              })}

              {listRows.length === 0 && (
                <div className="p-6 text-white/60 text-center">
                  No published videos found.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-white/40">
          Only published videos appear here. Publish first, then pick your 3.
        </div>
      </div>
    </div>
  );
}
