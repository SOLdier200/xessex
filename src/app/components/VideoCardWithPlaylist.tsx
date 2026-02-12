"use client";

import Link from "next/link";
import AddToPlaylistButton from "./AddToPlaylistButton";

type Props = {
  videoId: string;
  viewkey: string;
  title: string;
  thumb: string | null;
  duration: string;
  rank?: number | null;
  isFree: boolean;
  isAuthed: boolean;
  viewsCount: number;
  isFavorite?: boolean;
  className?: string;
};

export default function VideoCardWithPlaylist({
  videoId,
  viewkey,
  title,
  thumb,
  duration,
  rank,
  isFree,
  isAuthed,
  viewsCount,
  isFavorite,
  className,
}: Props) {
  const formatViews = (views: number) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <div className={`relative group ${className || ""}`}>
      <Link
        href={`/videos/${viewkey}`}
        className="neon-border rounded-lg sm:rounded-2xl bg-black/30 overflow-hidden hover:bg-white/5 transition block"
      >
        <div className="relative aspect-video bg-black/60">
          {thumb ? (
            <img
              src={thumb}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              No Thumbnail
            </div>
          )}
          {rank != null && (
            <div
              className="absolute top-1 left-1 md:top-1.5 md:left-1.5 min-w-[20px] md:min-w-[22px] h-5 flex items-center justify-center text-[10px] md:text-xs font-bold px-1 md:px-1.5 rounded-md bg-gradient-to-br from-purple-500/40 to-pink-500/40 text-white backdrop-blur-sm shadow-md"
              style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
            >
              #{rank}
            </div>
          )}
          {isFavorite && (
            <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-yellow-500/80 px-2 py-0.5 rounded text-xs text-black font-semibold">
              ★
            </div>
          )}
          {isFree && !isAuthed && (
            <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-emerald-500/80 px-2 py-0.5 rounded text-xs text-white font-semibold">
              FREE
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center justify-between px-2 py-1 text-[10px] md:text-xs text-white/70 bg-black/30">
          <span>{duration}</span>
          <span>{formatViews(viewsCount)} XESS Views</span>
        </div>
      </Link>

      {/* Playlist button - shown on hover */}
      {isAuthed && videoId && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <AddToPlaylistButton
            videoId={videoId}
            iconOnly
            className="p-1.5 bg-black/70 hover:bg-black/90 rounded-lg backdrop-blur-sm"
          />
        </div>
      )}
    </div>
  );
}
