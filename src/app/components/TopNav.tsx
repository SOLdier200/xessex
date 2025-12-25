import Link from "next/link";

export default function TopNav() {
  return (
    <header className="px-6 py-4 flex items-center justify-between">
      <Link href="/" className="neon-border rounded-xl px-3 py-1 font-semibold neon-text">
        Xessex
      </Link>

      <nav className="flex items-center gap-3">
        <Link href="/categories" className="neon-border rounded-xl px-3 py-1.5 hover:bg-white/5">
          Categories
        </Link>
        <Link href="/signup" className="neon-border rounded-xl px-3 py-1.5 hover:bg-white/5">
          Sign up
        </Link>
        <Link href="/login" className="neon-border rounded-xl px-3 py-1.5 hover:bg-white/5">
          Login
        </Link>
      </nav>
    </header>
  );
}
