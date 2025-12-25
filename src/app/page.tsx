import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-8">xessex</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Placeholder categories */}
          {["category-1", "category-2", "category-3", "category-4"].map((cat) => (
            <Link
              key={cat}
              href={`/categories/${cat}`}
              className="p-6 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors text-center"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Recent Videos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Placeholder videos */}
          {["video-1", "video-2", "video-3"].map((vid) => (
            <Link
              key={vid}
              href={`/videos/${vid}`}
              className="p-6 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <div className="aspect-video bg-zinc-800 rounded mb-2"></div>
              <p>{vid}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
