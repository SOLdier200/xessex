import Link from "next/link";
import AcceptClient from "./AcceptClient";

type AgeAcceptPageProps = {
  searchParams?: { next?: string | string[] };
};

function sanitizeNext(nextValue: string | null | undefined) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  if (nextValue.startsWith("/age")) return "/";
  return nextValue;
}

export default function AgeAcceptPage({ searchParams }: AgeAcceptPageProps) {
  const nextValue = searchParams?.next;
  const nextParam = Array.isArray(nextValue) ? nextValue[0] : nextValue;
  const next = sanitizeNext(nextParam);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8">
      <AcceptClient next={next} />
      <div className="w-full max-w-md rounded-2xl border border-pink-500/40 bg-black/70 p-6 text-center">
        <h1 className="text-xl font-semibold">Continuing...</h1>
        <p className="mt-3 text-white/70">
          Setting your access now. If you are not redirected, use the link below.
        </p>
        <div className="mt-5">
          <Link
            href={next || "/"}
            className="inline-flex items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-500/20 px-6 py-3 font-semibold"
          >
            Continue
          </Link>
        </div>
      </div>
    </main>
  );
}
