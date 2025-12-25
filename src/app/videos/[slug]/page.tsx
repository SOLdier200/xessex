import Link from "next/link";

interface VideoPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug } = await params;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-2xl font-bold mb-6">{slug}</h1>

      {/* Video embed placeholder */}
      <div className="aspect-video bg-zinc-900 rounded-lg flex items-center justify-center mb-6">
        <p className="text-gray-500">Video embed goes here</p>
      </div>

      <div className="bg-zinc-900 rounded-lg p-6">
        <h2 className="font-semibold mb-2">Description</h2>
        <p className="text-gray-400">Video description placeholder</p>
      </div>
    </main>
  );
}
