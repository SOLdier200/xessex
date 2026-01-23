"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import WalletStatus from "./WalletStatus";
import XessTokenModal from "./XessTokenModal";
import PendingManualBadge from "./PendingManualBadge";

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
        <Link href="/" onClick={() => setMenuOpen(false)} title="Click for homepage">
          <Image
            src="/logos/mainsitelogo.png"
            alt="Xessex"
            width={285}
            height={95}
            className="h-[81px] md:h-[155px] w-auto"
            priority
          />
        </Link>

        {/* Right side - Wallet Status, Xess Token, Profile and Admin */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <WalletStatus />
          <button
            onClick={() => setShowXessTokenModal(true)}
            className="hidden md:inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:border-amber-300/70 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          >
            Xess Token
          </button>
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
              <PendingManualBadge />
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg border-2 border-pink-500 bg-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.6)] transition-all duration-300 ${
              menuOpen ? "animate-none bg-pink-500/40" : "animate-pulse"
            }`}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-0.5 bg-pink-200 transition-all duration-300 ${
                menuOpen ? "rotate-45 translate-y-1" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-pink-200 my-1 transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-pink-200 transition-all duration-300 ${
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
        <div className="flex flex-col gap-3 pb-2">
          {/* Xess Token - hot pink with glow animation */}
          <button
            onClick={() => {
              setShowXessTokenModal(true);
              setMenuOpen(false);
            }}
            className={`flex items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-500/20 px-4 py-3 text-sm font-semibold text-pink-200 shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 active:bg-pink-500/40 ${
              menuOpen ? "animate-pulse" : ""
            }`}
          >
            Xess Token
          </button>
          {/* Profile - hot pink with glow animation */}
          {isLoggedIn && (
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-500/20 px-4 py-3 text-sm font-semibold text-pink-200 shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 active:bg-pink-500/40 ${
                menuOpen ? "animate-pulse" : ""
              }`}
            >
              Profile
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-white transition active:bg-purple-500/30"
            >
              Admin
              <PendingManualBadge />
            </Link>
          )}
          {/* Leaderboard */}
          <Link
            href="/leaderboard"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition active:bg-amber-500/30"
          >
            Leaderboard
          </Link>
          {/* Signup & Login - only show when not logged in */}
          {!isLoggedIn && (
            <>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition active:bg-emerald-500/30"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-300 transition active:bg-sky-500/30"
              >
                Login
              </Link>
            </>
          )}
        </div>
      </nav>

      <XessTokenModal
        open={showXessTokenModal}
        onClose={() => setShowXessTokenModal(false)}
      />
    </header>
  );
}
