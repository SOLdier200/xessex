"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import WalletStatus from "./WalletStatus";
import MessagesModal from "./MessagesModal";

const tokenLinks = [
  { label: "Token Launch", href: "/launch" },
  { label: "Tokenomics", href: "/tokenomics" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Rewards", href: "/rewards" },
  { label: "Win Free Credits!", href: "/rewards-drawing" },
  { label: "Swap", href: "/swap" },
  { label: "Burned", href: "/burned" },
  { label: "Xess News", href: "/xess-news" },
  { label: "FAQ", href: "/faq" },
];

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count");
      const data = await res.json();
      if (data.ok) {
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(e.target as Node)) {
        setTokenDropdownOpen(false);
      }
    }
    if (tokenDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tokenDropdownOpen]);

  useEffect(() => {
    function checkAuth() {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          const loggedIn = data.ok && data.authed;
          setIsLoggedIn(loggedIn);
          if (loggedIn) {
            fetchUnreadCount();
          } else {
            setUnreadCount(0);
          }
        })
        .catch(() => {
          setIsLoggedIn(false);
          setUnreadCount(0);
        });
    }

    checkAuth();

    // Listen for auth changes (login/logout events)
    window.addEventListener("auth-changed", checkAuth);
    return () => window.removeEventListener("auth-changed", checkAuth);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 20000);
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchUnreadCount]);

  return (
    <header className="px-4 lg:px-6 py-4 lg:py-5 safe-top">
      {/* Preload images so they're ready when needed - hidden but forces browser to load */}
      <div className="hidden" aria-hidden="true">
        <Image src="/logos/textlogo/siteset3/profile100.png" alt="" width={1} height={1} priority />
        <Image src="/logos/textlogo/siteset3/diamond100.png" alt="" width={1} height={1} priority />
        <Image src="/logos/textlogo/siteset3/member100.png" alt="" width={1} height={1} priority />
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex lg:items-start lg:justify-between gap-4">
        {/* Left side: Logo */}
        <div className="shrink-0">
          <Link href="/" title="Click for homepage">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[132px] w-auto"
              priority
            />
          </Link>
        </div>

        {/* Right side: All nav links in one row with WalletStatus between Login and Collections */}
        <div className="flex flex-col items-end gap-2 mt-[10px]">
          <div className="flex flex-nowrap items-center justify-end gap-3">
            <WalletStatus />
            <Link href="/login/diamond" className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/login100.png" alt="Connect Wallet" width={982} height={247} priority className="h-[37px] w-auto" />
            </Link>
            <Link href="/collections" className="hover:opacity-80 transition shrink-0">
              <Image src="/logos/textlogo/siteset3/collect1001.png" alt="Collections" width={938} height={276} priority className="h-[33px] w-auto" />
            </Link>
            <Link href="/leaderboard" className="hover:opacity-80 transition shrink-0">
              <Image src="/logos/textlogo/siteset3/diamondladdea.png" alt="Diamond Ladder" width={1308} height={286} priority className="h-[44px] w-auto" />
            </Link>
            <div className="relative shrink-0" ref={tokenDropdownRef}>
              <button
                onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}
                className="hover:opacity-80 transition flex items-center gap-1"
              >
                <Image src="/logos/textlogo/siteset3/token100.png" alt="Xess Token" width={938} height={276} className="h-[38px] w-auto mt-[1px]" />
                <svg
                  className={`w-4 h-4 text-white/70 transition-transform ${tokenDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tokenDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-black/95 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.3)] backdrop-blur-sm z-50 overflow-hidden">
                  {tokenLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setTokenDropdownOpen(false)}
                      className="block px-4 py-3 text-white/90 hover:bg-pink-500/20 hover:text-white transition border-b border-white/5 last:border-b-0"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {isLoggedIn && (
              <>
                <button
                  onClick={() => setMessagesModalOpen(true)}
                  className="relative hover:opacity-80 transition shrink-0"
                >
                  <Image src="/logos/textlogo/siteset3/messages110.png" alt="Messages" width={938} height={276} className="h-[42px] w-auto mt-[6px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold bg-pink-500 text-white rounded-full animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                <Link href="/profile" className="hover:opacity-80 transition shrink-0">
                  <Image src="/logos/textlogo/siteset3/profile100.png" alt="Profile" width={938} height={276} priority className="h-[37px] w-auto mt-[5px]" />
                </Link>
              </>
            )}
          </div>

          {/* Admin button (if applicable) */}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        {/* Top row: Logo on left, actions on right */}
        <div className="flex items-start justify-between gap-3">
          <Link href="/" onClick={() => setMenuOpen(false)} title="Click for homepage">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[77px] w-auto"
              priority
            />
          </Link>

          <div className="flex items-start gap-2">
            {isLoggedIn && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setMessagesModalOpen(true);
                }}
                className="relative mt-4 hover:opacity-80 transition"
                aria-label="Open messages"
              >
                <Image
                  src="/logos/textlogo/siteset3/messages110.png"
                  alt="Messages"
                  width={938}
                  height={276}
                  className="h-[30px] w-auto mt-[6px]"
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold bg-pink-500 text-white rounded-full animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            )}

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
        </div>

        {/* Mobile Dropdown Menu */}
        <nav
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            menuOpen ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col items-center gap-4 pb-3">
            {/* WalletStatus on its own row */}
            <WalletStatus />

            {/* Nav items stacked and centered below WalletStatus */}
            <Link href="/login/diamond" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/login100.png" alt="Connect Wallet" width={982} height={247} className="h-[33px] w-auto" />
            </Link>
            <Link href="/collections" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/collect1001.png" alt="Collections" width={938} height={276} className="h-[30px] w-auto" />
            </Link>
            <Link href="/leaderboard" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
              <Image src="/logos/textlogo/siteset3/diamondladdea.png" alt="Diamond Ladder" width={1308} height={286} className="h-[40px] w-auto" />
            </Link>
            <div className="flex flex-col items-center">
              <button
                onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}
                className="hover:opacity-80 transition flex items-center gap-1"
              >
                <Image src="/logos/textlogo/siteset3/token100.png" alt="Xess Token" width={938} height={276} className="h-[34px] w-auto mt-[1px]" />
                <svg
                  className={`w-4 h-4 text-white/70 transition-transform ${tokenDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tokenDropdownOpen && (
                <div className="mt-2 w-48 rounded-xl bg-black/95 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.3)] overflow-hidden">
                  {tokenLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => {
                        setTokenDropdownOpen(false);
                        setMenuOpen(false);
                      }}
                      className="block px-4 py-3 text-white/90 hover:bg-pink-500/20 hover:text-white transition border-b border-white/5 last:border-b-0 text-center"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {isLoggedIn && (
              <>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setMessagesModalOpen(true);
                  }}
                  className="relative hover:opacity-80 transition"
                >
                  <Image src="/logos/textlogo/siteset3/messages110.png" alt="Messages" width={938} height={276} className="h-[39px] w-auto mt-[6px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold bg-pink-500 text-white rounded-full animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="hover:opacity-80 transition">
                  <Image src="/logos/textlogo/siteset3/profile100.png" alt="Profile" width={938} height={276} priority className="h-[33px] w-auto mt-[5px]" />
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* Messages Modal */}
      <MessagesModal
        isOpen={messagesModalOpen}
        onClose={() => setMessagesModalOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </header>
  );
}
