"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import TopNav from "../components/TopNav";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  thumbnails: string[];
  createdAt: string;
  updatedAt: string;
}

export default function PlaylistsPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (data.ok) {
        setPlaylists(data.playlists);
      }
    } catch {
      toast.error("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const authed = d.ok && d.authed;
        setIsAuthed(authed);
        if (!authed) {
          router.push("/login");
        } else {
          fetchPlaylists();
        }
      })
      .catch(() => {
        setIsAuthed(false);
        router.push("/login");
      });
  }, [router, fetchPlaylists]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    toast("Creating playlist now...");
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaylists((prev) => [data.playlist, ...prev]);
        setNewName("");
        setNewDescription("");
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

  const handleDelete = async (playlist: Playlist) => {
    if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
        toast.success(`Deleted "${playlist.name}"`);
      } else {
        toast.error(data.error || "Failed to delete playlist");
      }
    } catch {
      toast.error("Failed to delete playlist");
    }
  };

  if (isAuthed === null || loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNav />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-center">
            <Image
              src="/logos/textlogo/siteset3/playlistpage.png"
              alt="Playlist"
              width={1356}
              height={372}
              className="w-full max-w-[358px] h-auto"
              priority
            />
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-8 p-5 bg-white/5 border border-white/10 rounded-xl">
            <h2 className="text-lg font-semibold mb-4">Create New Playlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Favorites"
                  className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-pink-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Description (optional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A collection of my favorite videos..."
                  rows={2}
                  className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white rounded-lg transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                    setNewDescription("");
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Playlists grid */}
        {playlists.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="text-white/60 mb-4">No playlists yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
            >
              Create your first playlist
            </button>
          </div>
        ) : (
          <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Playlist
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl overflow-hidden transition-colors"
              >
                <Link href={`/playlists/${playlist.id}`} className="block">
                  {/* Thumbnail grid */}
                  {playlist.thumbnails.length > 0 ? (
                    <div className="grid grid-cols-3 gap-0.5 bg-black/60">
                      {playlist.thumbnails.map((thumb, i) => (
                        <div key={i} className="aspect-video bg-black/80">
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video flex items-center justify-center bg-white/5 text-white/20 text-xs">
                      No videos yet
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-white truncate mb-1">{playlist.name}</h3>
                    {playlist.description && (
                      <p className="text-sm text-white/50 line-clamp-2 mb-2">{playlist.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {playlist.itemCount} video{playlist.itemCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(playlist);
                  }}
                  className="absolute top-3 right-3 p-1.5 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete playlist"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          </>
        )}
      </main>
    </div>
  );
}
