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
      {/* Preload images so they're ready when needed - hidden but forces browser to load */}
      <div className="hidden">
        <Image src="/logos/textlogo/siteset3/profile100.png" alt="" width={1} height={1} priority />
        <Image src="/logos/textlogo/siteset3/diamond100.png" alt="" width={1} height={1} priority />
        <Image src="/logos/textlogo/siteset3/member100.png" alt="" width={1} height={1} priority />
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex md:items-start md:justify-between gap-4">
        {/* Left side: Logo */}
        <div className="shrink-0">
          <Link href="/" title="Click for homepage">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[155px] w-auto"
              priority
            />
          </Link>
        </div>

        {/* Right side: All nav links in one row with WalletStatus between Login and Collections */}
        <div className="flex flex-col items-end gap-2 mt-[10px]">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/signup" className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/signup5.png" alt="Sign Up" width={1230} height={238} priority className="h-[36px] w-auto" />
            </Link>
            <Link href="/login" className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/login100.png" alt="Login" width={982} height={247} priority className="h-[36px] w-auto" />
            </Link>
            <WalletStatus />
            <Link href="/collections" className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/collect1001.png" alt="Collections" width={938} height={276} priority className="h-[36px] w-auto" />
            </Link>
            <Link href="/leaderboard" className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/diamondladdea.png" alt="Diamond Ladder" width={1308} height={286} priority className="h-[40px] w-auto" />
            </Link>
            <button onClick={() => setShowXessTokenModal(true)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/token100.png" alt="Xess Token" width={938} height={276} className="h-[36px] w-auto" />
            </button>
            {isLoggedIn && (
              <Link href="/profile" className="hover:opacity-80 transition">
                <Image src="/logos/textlogo/siteset3/profile100.png" alt="Profile" width={938} height={276} priority className="h-[36px] w-auto" />
              </Link>
            )}
          </div>

          {/* Admin button (if applicable) */}
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-300/70 hover:bg-purple-500/20"
            >
              Admin
              <PendingManualBadge />
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Top row: Logo on left, hamburger on right */}
        <div className="flex items-start justify-between gap-3">
          <Link href="/" onClick={() => setMenuOpen(false)} title="Click for homepage">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[81px] w-auto"
              priority
            />
          </Link>

          {/* Hamburger menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`mt-3 flex flex-col justify-center items-center w-10 h-10 rounded-lg border-2 border-pink-500 bg-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.6)] transition-all duration-300 ${
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

        {/* WalletStatus centered */}
        <div className="flex justify-center mt-3">
          <WalletStatus />
        </div>

        {/* Mobile Dropdown Menu - centered under WalletStatus */}
        <nav
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            menuOpen ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col items-center gap-3 pb-2">
            <Link href="/collections" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/collect1001.png" alt="Collections" width={938} height={276} className="h-[32px] w-auto" />
            </Link>
            <Link href="/signup" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/signup5.png" alt="Sign Up" width={1230} height={238} className="h-[32px] w-auto" />
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/login100.png" alt="Login" width={982} height={247} className="h-[32px] w-auto" />
            </Link>
            <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/diamondladdea.png" alt="Diamond Ladder" width={1308} height={286} className="h-[36px] w-auto" />
            </Link>
            <button
              onClick={() => {
                setShowXessTokenModal(true);
                setMenuOpen(false);
              }}
              className="hover:opacity-80 transition"
            >
              <Image src="/logos/textlogo/siteset3/token100.png" alt="Xess Token" width={938} height={276} className="h-[32px] w-auto" />
            </button>
            {isLoggedIn && (
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
                <Image src="/logos/textlogo/siteset3/profile100.png" alt="Profile" width={938} height={276} priority className="h-[32px] w-auto" />
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-white transition"
              >
                Admin
                <PendingManualBadge />
              </Link>
            )}
          </div>
        </nav>
      </div>

      <XessTokenModal
        open={showXessTokenModal}
        onClose={() => setShowXessTokenModal(false)}
      />
    </header>
  );
}
