"use client";

import { useState } from "react";

export function LazyEmbed({ viewkey }: { viewkey: string }) {
  const [loaded, setLoaded] = useState(false);

  const src = `https://www.pornhub.com/embed/${viewkey}`;

  return (
    <div className="w-64 h-64">
      {!loaded ? (
        <button
          onClick={() => setLoaded(true)}
          className="w-full h-full rounded-xl neon-border bg-black/40 cursor-pointer hover:bg-white/5 transition flex items-center justify-center"
        >
          <span className="text-white/70 text-4xl">▶</span>
        </button>
      ) : (
        <iframe
          src={src}
          width="100%"
          height="100%"
          loading="lazy"
          allowFullScreen
          frameBorder="0"
          scrolling="no"
          className="w-full h-full rounded-xl"
        />
      )}
    </div>
  );
}
