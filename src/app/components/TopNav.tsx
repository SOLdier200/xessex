import Link from "next/link";
import Image from "next/image";

export default function TopNav() {
  return (
    <header className="px-6 py-5 flex items-center justify-between">
      <Link href="/">
        <Image
          src="/logos/neonmainlogo1.png"
          alt="Xessex"
          width={285}
          height={95}
          className="h-[95px] w-auto"
          priority
        />
      </Link>

      <nav className="flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-300/70 hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
        >
          Admin
        </Link>
        <Link
          href="/categories"
          className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/70 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
        >
          Collections
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/70 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
        >
          Diamond Member Connect
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center rounded-full border border-pink-400/50 bg-pink-500/20 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_12px_rgba(255,43,214,0.25)] transition hover:border-pink-300/70 hover:bg-pink-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70"
        >
          Register a Diamond Account
        </Link>
      </nav>
    </header>
  );
}
