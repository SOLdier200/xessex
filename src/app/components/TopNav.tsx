"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="px-4 md:px-6 py-4 md:py-5 safe-top">
      <div className="flex items-center justify-between">
        <Link href="/" onClick={() => setMenuOpen(false)}>
          <Image
            src="/logos/neonmainlogo1.png"
            alt="Xessex"
            width={285}
            height={95}
            className="h-[50px] md:h-[95px] w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-3">
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

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg border border-pink-400/40 bg-pink-500/10"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-5 h-0.5 bg-white transition-all duration-300 ${
              menuOpen ? "rotate-45 translate-y-1" : ""
            }`}
          />
          <span
            className={`block w-5 h-0.5 bg-white my-1 transition-all duration-300 ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-5 h-0.5 bg-white transition-all duration-300 ${
              menuOpen ? "-rotate-45 -translate-y-1" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      <nav
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          menuOpen ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <Link
            href="/admin"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-purple-500/30"
          >
            Admin
          </Link>
          <Link
            href="/categories"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-emerald-500/30"
          >
            Collections
          </Link>
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-sky-500/30"
          >
            Diamond Member Connect
          </Link>
          <Link
            href="/signup"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center rounded-xl border border-pink-400/50 bg-pink-500/20 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_12px_rgba(255,43,214,0.25)] transition active:bg-pink-500/40"
          >
            Register a Diamond Account
          </Link>
        </div>
      </nav>
    </header>
  );
}
