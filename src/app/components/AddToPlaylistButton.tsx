"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  thumbnails: string[];
}

interface Props {
  videoId: string;
  className?: string;
  iconOnly?: boolean;
}

export default function AddToPlaylistButton({ videoId, className = "", iconOnly = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [inAnyPlaylist, setInAnyPlaylist] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (data.ok) {
        setPlaylists(data.playlists);
        // Check which playlists already contain this video
        const containing = new Set<string>();
        for (const pl of data.playlists) {
          const check = await fetch(`/api/playlists/${pl.id}`);
          const checkData = await check.json();
          if (checkData.ok && checkData.playlist.items.some((i: { video: { id: string } }) => i.video.id === videoId)) {
            containing.add(pl.id);
          }
        }
        setSelected(containing);
        setOriginalSelected(new Set(containing));
        setInAnyPlaylist(containing.size > 0);
      }
    } catch {
      toast.error("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (isOpen && isAuthed) {
      fetchPlaylists();
    }
  }, [isOpen, isAuthed, fetchPlaylists]);

  // Check auth on mount only
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setIsAuthed(d.ok && d.authed);
      })
      .catch(() => setIsAuthed(false));
  }, []);

  // ESC to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowCreate(false);
      setNewName("");
      setCreating(false);
      setSaving(false);
    }
  }, [isOpen]);

  const handleToggle = (playlistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    toast("Creating playlist now...");
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaylists((prev) => [data.playlist, ...prev]);
        setSelected((prev) => new Set([...prev, data.playlist.id]));
        setNewName("");
        setShowCreate(false);
        toast.success(`Created "${name}"`);
      } else {
        toast.error(data.error || "Failed to create playlist");
      }
    } catch {
      toast.error("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find playlists to add to and remove from
      const toAdd = [...selected].filter((id) => !originalSelected.has(id));
      const toRemove = [...originalSelected].filter((id) => !selected.has(id));

      // Add to playlists
      for (const playlistId of toAdd) {
        await fetch(`/api/playlists/${playlistId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });
      }

      // Remove from playlists
      for (const playlistId of toRemove) {
        await fetch(`/api/playlists/${playlistId}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        toast.success("Playlists updated");
      }
      setInAnyPlaylist(selected.size > 0);
      setOriginalSelected(new Set(selected));
      setIsOpen(false);
    } catch {
      toast.error("Failed to update playlists");
    } finally {
      setSaving(false);
    }
  };

  const handleButtonClick = () => {
    if (isAuthed === false) {
      toast.error("Please log in to create playlists");
      return;
    }
    setIsOpen(true);
  };

  // Don't render button if not authed
  if (isAuthed === false) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleButtonClick}
        className={`group flex items-center gap-1.5 transition-colors ${inAnyPlaylist ? "text-pink-400 hover:text-pink-300" : "text-white/70 hover:text-white"} ${className}`}
        title={inAnyPlaylist ? "Remove from Playlist" : "Add to Playlist"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          {inAnyPlaylist ? (
            <>
              <path d="M5 12h14" />
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </>
          ) : (
            <>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </>
          )}
        </svg>
        {!iconOnly && (
          <span className="text-sm">{inAnyPlaylist ? "Remove from Playlist" : "Add to Playlist"}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Add to Playlist</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : playlists.length === 0 && !showCreate ? (
                    <div className="text-center py-8">
                      <p className="text-white/60 mb-4">No playlists yet</p>
                      <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                      >
                        Create your first playlist
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Create new playlist section */}
                      {showCreate ? (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Playlist name"
                            className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-pink-500 mb-3"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newName.trim()) handleCreate();
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleCreate}
                              disabled={!newName.trim() || creating}
                              className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white rounded-lg transition-colors text-sm"
                            >
                              {creating ? "Creating..." : "Create"}
                            </button>
                            <button
                              onClick={() => {
                                setShowCreate(false);
                                setNewName("");
                              }}
                              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowCreate(true)}
                          className="w-full p-3 flex items-center gap-3 text-left bg-white/5 hover:bg-white/10 rounded-lg border border-dashed border-white/20 transition-colors"
                        >
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-pink-500/20 text-pink-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <span className="text-white/80">Create new playlist</span>
                        </button>
                      )}

                      {/* Existing playlists */}
                      {playlists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handleToggle(playlist.id)}
                          className={`w-full p-3 flex items-start gap-3 text-left rounded-lg border transition-colors ${
                            selected.has(playlist.id)
                              ? "bg-pink-500/20 border-pink-500/50"
                              : "bg-white/5 hover:bg-white/10 border-white/10"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 shrink-0 flex items-center justify-center rounded border transition-colors ${
                              selected.has(playlist.id)
                                ? "bg-pink-500 border-pink-500"
                                : "border-white/40"
                            }`}
                          >
                            {selected.has(playlist.id) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          {/* Tiny thumbnails - max 60 (10 rows of 6) */}
                          {playlist.thumbnails && playlist.thumbnails.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 shrink-0 max-w-[200px]">
                              {playlist.thumbnails.slice(0, 60).map((thumb, i) => (
                                <img
                                  key={i}
                                  src={thumb}
                                  alt=""
                                  className="w-8 h-6 rounded-sm object-cover"
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{playlist.name}</p>
                            <p className="text-sm text-white/50">
                              {playlist.itemCount} video{playlist.itemCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {playlists.length > 0 && (
                  <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white rounded-lg transition-colors"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
