import Link from "next/link";
import TopNav from "../components/TopNav";
import { XESSEX_CONTENT } from "@/lib/xessexContent";

export const metadata = {
  title: "Xessex Content",
  description: "Original Xessex videos — unlock with Special Credits",
};

export default function XessexContentGallery() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
          Xessex Content
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {XESSEX_CONTENT.map((item) => (
            <div key={item.id} className="neon-border-gold rounded-2xl overflow-hidden bg-black/30">
              <div className="relative w-full aspect-video">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                  draggable={false}
                />
                {/* Lock overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                  <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-sm">Video Locked</p>
                  <p className="text-yellow-400 font-bold text-lg mt-1">
                    {item.unlockCost.toLocaleString()} Credits
                  </p>
                  <Link
                    href={`/xessex-content/${item.id}`}
                    className="mt-3 px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-bold transition"
                  >
                    Unlock Video
                  </Link>
                </div>
              </div>

              <div className="p-3">
                <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1">
                  Xessex Original
                </p>
                <h2 className="text-sm font-bold text-white">
                  {item.title}
                </h2>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
