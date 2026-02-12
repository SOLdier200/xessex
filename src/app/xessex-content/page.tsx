import Link from "next/link";
import { XESSEX_CONTENT } from "@/lib/xessexContent";
import HoverPreviewVideo from "@/app/components/HoverPreviewVideo";

export const metadata = {
  title: "Xessex Content",
  description: "Original Xessex videos — unlock with Special Credits",
};

export default function XessexContentGallery() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
        Xessex Content
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {XESSEX_CONTENT.map((item) => (
          <Link
            key={item.id}
            href={`/xessex-content/${item.id}`}
            className="group block"
          >
            <div className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
              <div className="relative w-full aspect-video">
                <HoverPreviewVideo
                  src={item.videoUrl}
                  poster={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full"
                />
              </div>

              <div className="p-3">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1">
                  Xessex Original
                </p>
                <h2 className="text-sm font-bold text-white group-hover:text-yellow-300 transition-colors">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-white/60">
                  {item.unlockCost.toLocaleString()} Credits to Unlock
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
