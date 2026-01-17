"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import WalletStatus from "./WalletStatus";
import XessTokenModal from "./XessTokenModal";

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showXessTokenModal, setShowXessTokenModal] = useState(false);

  useEffect(() => {
    fetch("/api/me/is-admin")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false));

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setIsLoggedIn(data.ok && data.authed))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <header className="px-4 md:px-6 py-4 md:py-5 safe-top">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Right side - Xess Token, Wallet Status, Profile and Admin */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Xess Token - desktop only, mobile goes in dropdown */}
          <button
            onClick={() => setShowXessTokenModal(true)}
            className="hidden md:inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:border-amber-300/70 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            Xess Token
          </button>
          <WalletStatus />
          {isLoggedIn && (
            <Link
              href="/profile"
              className="hidden md:inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/70 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
            >
              Profile
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden md:inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-300/70 hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
            >
              Admin
            </Link>
          )}
          {/* Mobile hamburger menu - always visible on mobile */}
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
      </div>

      {/* Mobile Navigation Menu */}
      <nav
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          menuOpen ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-2xl border-2 border-pink-500 bg-black/80 p-4 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
          <div className="text-xs text-pink-400 font-semibold uppercase tracking-wider mb-3 text-center">
            Menu
          </div>
          <div className="flex flex-col gap-2">
            {/* Xess Token - mobile only */}
            <button
              onClick={() => {
                setShowXessTokenModal(true);
                setMenuOpen(false);
              }}
              className="flex items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition active:bg-amber-500/30"
            >
              Xess Token
            </button>
            {isLoggedIn && (
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-sky-400/50 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-sky-500/30"
              >
                Profile
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-purple-400/50 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-purple-500/30"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </nav>

      <XessTokenModal
        open={showXessTokenModal}
        onClose={() => setShowXessTokenModal(false)}
      />
    </header>
  );
}
