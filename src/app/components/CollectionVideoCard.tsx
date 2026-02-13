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
  locked: boolean;
  isAuthed: boolean;
  views: string;
  isFavorite?: boolean;
};

export default function CollectionVideoCard({
  videoId,
  viewkey,
  title,
  thumb,
  duration,
  rank,
  locked,
  isAuthed,
  views,
  isFavorite,
}: Props) {
  // Always link to video page — even locked cards navigate to /videos/[slug]
  // so the user can see the unlock button there
  const Wrapper = viewkey ? Link : "div";
  const wrapperProps = viewkey
    ? {
        href: `/videos/${viewkey}`,
        className: locked
          ? "neon-border rounded-xl bg-black/30 overflow-hidden opacity-60 block"
          : "neon-border rounded-xl bg-black/30 overflow-hidden hover:bg-white/5 active:bg-white/10 transition block",
      }
    : { className: "neon-border rounded-xl bg-black/30 overflow-hidden opacity-60 cursor-not-allowed block" };

  return (
    <div className="relative group">
      <Wrapper {...(wrapperProps as any)}>
        <div className="relative aspect-video bg-black/60">
          {thumb ? (
            <img
              src={thumb}
              alt={locked ? "Locked video" : title}
              className={`w-full h-full object-cover ${locked ? "" : "group-hover:scale-105"} transition-transform`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-[8px]">
              No Thumbnail
            </div>
          )}
          {/* Lock overlay for locked videos */}
          {locked && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
              <span className="text-xl">🔒</span>
              <span className="text-[8px] md:text-[10px] text-white/70 font-medium">Locked</span>
            </div>
          )}
          {/* Rank Badge */}
          {rank != null && !locked && (
            <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 min-w-[16px] md:min-w-[18px] h-4 flex items-center justify-center text-[8px] md:text-[10px] font-bold px-0.5 md:px-1 rounded bg-gradient-to-br from-purple-500/80 to-pink-500/80 text-white/90 backdrop-blur-sm shadow-md">
              #{rank}
            </div>
          )}
          {duration && (
            <div className="hidden md:block absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] md:text-[10px] text-white">
              {duration}
            </div>
          )}
          {isFavorite && !locked && (
            <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 bg-yellow-500/80 px-1 py-0.5 rounded text-[8px] md:text-[10px] text-black font-semibold">
              ★
            </div>
          )}
        </div>

        {!locked && (
          <div className="p-1.5 md:p-2">
            <div className="text-[8px] md:text-[10px] text-white/50">{views} views</div>
          </div>
        )}
      </Wrapper>

      {/* Playlist button - shown on hover for unlocked videos */}
      {isAuthed && !locked && videoId && (
        <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <AddToPlaylistButton
            videoId={videoId}
            iconOnly
            className="p-1 bg-black/70 hover:bg-black/90 rounded-md backdrop-blur-sm"
          />
        </div>
      )}
    </div>
  );
}
