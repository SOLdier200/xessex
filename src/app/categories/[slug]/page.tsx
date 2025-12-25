import Link from "next/link";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-8 capitalize">{slug.replace(/-/g, " ")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Placeholder videos in this category */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Link
            key={i}
            href={`/videos/${slug}-video-${i}`}
            className="p-4 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <div className="aspect-video bg-zinc-800 rounded mb-2"></div>
            <p className="text-sm">{slug} video {i}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
