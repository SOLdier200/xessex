"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import TopNav from "../../components/TopNav";

interface VideoItem {
  id: string;
  position: number;
  addedAt: string;
  video: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    avgStars: number;
    starsCount: number;
  };
}

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  items: VideoItem[];
}

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlaylist = useCallback(async () => {
    try {
      const res = await fetch(`/api/playlists/${id}`);
      const data = await res.json();
      if (data.ok) {
        setPlaylist(data.playlist);
        setEditName(data.playlist.name);
        setEditDescription(data.playlist.description || "");
      } else if (data.error === "not_found") {
        router.push("/playlists");
      }
    } catch {
      toast.error("Failed to load playlist");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const handleSave = async () => {
    const name = editName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: editDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaylist((prev) =>
          prev
            ? {
                ...prev,
                name: data.playlist.name,
                description: data.playlist.description,
              }
            : null
        );
        setEditMode(false);
        toast.success("Playlist updated");
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/playlists/${id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaylist((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((item) => item.video.id !== videoId),
              }
            : null
        );
        toast.success("Video removed");
      } else {
        toast.error(data.error || "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleDelete = async () => {
    if (!playlist) return;
    if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        toast.success("Playlist deleted");
        router.push("/playlists");
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNav />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNav />
        <div className="text-center py-20">
          <p className="text-white/60">Playlist not found</p>
          <Link href="/playlists" className="text-pink-400 hover:text-pink-300 mt-4 inline-block">
            Back to playlists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to playlists
        </Link>

        {/* Header */}
        <div className="mb-8">
          {editMode ? (
            <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!editName.trim() || saving}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white rounded-lg transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditName(playlist.name);
                    setEditDescription(playlist.description || "");
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{playlist.name}</h1>
                {playlist.description && <p className="text-white/60">{playlist.description}</p>}
                <p className="text-sm text-white/40 mt-2">
                  {playlist.items.length} video{playlist.items.length !== 1 ? "s" : ""}
                </p>
              </div>
              {playlist.isOwner && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    title="Edit playlist"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
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
              )}
            </div>
          )}
        </div>

        {/* Videos grid */}
        {playlist.items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-white/60 mb-4">No videos in this playlist yet</p>
            <Link
              href="/"
              className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors inline-block border border-white/20"
            >
              Browse videos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlist.items.map((item) => (
              <div key={item.id} className="group relative">
                <Link href={`/v/${item.video.slug}`} className="block">
                  <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                    {item.video.thumbnailUrl ? (
                      <Image
                        src={item.video.thumbnailUrl}
                        alt={item.video.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-white/20"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-pink-500/90 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-pink-400 transition-colors">
                      {item.video.title}
                    </h3>
                    {item.video.starsCount > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-white/50">
                        <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span>{item.video.avgStars.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Remove button */}
                {playlist.isOwner && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveVideo(item.video.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from playlist"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
