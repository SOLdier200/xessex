"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import WalletStatus from "./WalletStatus";
import MessagesModal from "./MessagesModal";
import WalletBalancesModal from "./WalletBalancesModal";
import PayoutCountdown from "./PayoutCountdown";
import CreditAccrualCountdown from "./CreditAccrualCountdown";
import CreditManagementModal from "./CreditManagementModal";
import PayoutHistoryModal from "./PayoutHistoryModal";
import { AnimatePresence, motion } from "framer-motion";
import { PRESALE_ORIGIN, MAIN_ORIGIN } from "@/lib/origins";

/** Absolute URLs (http/https/protocol-relative) get a plain <a>, relative paths get next/link */
function isAbsoluteUrl(href: string) {
  const h = (href || "").trim();
  return /^https?:\/\//i.test(h) || h.startsWith("//");
}

function NavHref({
  href: rawHref,
  className,
  onClick,
  title,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const href = (rawHref || "").trim();
  if (isAbsoluteUrl(href)) {
    return (
      <a href={href} className={className} onClick={onClick} title={title}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick} title={title}>
      {children}
    </Link>
  );
}

type TokenLink =
  | { label: string; href: string; action?: never }
  | { label: string; action: "wallet"; href?: never };

// Links that only exist on the main site need MAIN_ORIGIN prefix when viewed on presale
const tokenLinks: TokenLink[] = [
  { label: "Wallet", action: "wallet" },
  { label: "Token Launch", href: `${PRESALE_ORIGIN}/launch` },
  { label: "Tokenomics", href: `${PRESALE_ORIGIN}/tokenomics` },
  { label: "Whitepaper", href: `${MAIN_ORIGIN}/whitepaper` },
  { label: "Rewards", href: `${MAIN_ORIGIN}/rewards` },
  { label: "Win Free Credits!", href: `${MAIN_ORIGIN}/rewards-drawing` },
  { label: "Swap", href: `${MAIN_ORIGIN}/swap` },
  { label: "Burned", href: `${MAIN_ORIGIN}/burned` },
  { label: "Xess News", href: `${MAIN_ORIGIN}/xess-news` },
  { label: "FAQ", href: `${MAIN_ORIGIN}/faq` },
];

type TopItem =
  | { type: "link"; href: string; img: string; alt: string; h: number }
  | { type: "token"; img: string; alt: string; h: number }
  | { type: "messages"; img: string; alt: string; h: number };

export default function TopNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPresale, setIsPresale] = useState(false);

  useEffect(() => {
    setIsPresale(window.location.hostname.startsWith("presale."));
  }, []);

  // Menu open/close (replaces old token dropdown and mobile hamburger)
  const [menuOpen, setMenuOpen] = useState(false);

  // Token submenu open/close inside the menu
  const [tokenSubOpen, setTokenSubOpen] = useState(false);

  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [creditRankingModalOpen, setCreditRankingModalOpen] = useState(false);
  const [payoutHistoryModalOpen, setPayoutHistoryModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count");
      const data = await res.json();
      if (data.ok) setUnreadCount(data.count);
    } catch {
      // Silently fail
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTokenSubOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // ESC to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setTokenSubOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // On presale, main-site links need full origin to avoid proxy redirect
  const m = isPresale ? MAIN_ORIGIN : "";

  const TOP_ITEMS: TopItem[] = [
    { type: "link", href: `${m}/login/diamond`, img: "/logos/textlogo/siteset3/login100.png", alt: "Connect Wallet", h: 32 },
    { type: "link", href: `${m}/signup`, img: "/logos/textlogo/siteset3/signup5.png", alt: "Sign Up", h: 32 },
    { type: "link", href: `${m}/collections`, img: "/logos/textlogo/siteset3/collect1001.png", alt: "Collections", h: 30 },
    { type: "link", href: `${m}/leaderboard`, img: "/logos/textlogo/siteset3/diamondladdea.png", alt: "Leaderboard", h: 40 },
    { type: "token", img: "/logos/textlogo/siteset3/token100.png", alt: "Xess Token", h: 36 },
    ...(isLoggedIn
      ? ([
          { type: "link", href: `${m}/xessex-content`, img: "/logos/textlogo/siteset3/xessexnav.png", alt: "Xessex Content", h: 36 },
          { type: "link", href: `${m}/playlists`, img: "/logos/textlogo/siteset3/playlistfinal2.png", alt: "Playlists", h: 36 },
          { type: "link", href: `${m}/profile`, img: "/logos/textlogo/siteset3/profile100.png", alt: "Profile", h: 34 },
          { type: "messages", img: "/logos/textlogo/siteset3/messages110.png", alt: "Messages", h: 36 },
        ] as TopItem[])
      : []),
  ];

  const closeMenu = () => { setMenuOpen(false); setTokenSubOpen(false); };

  // Motion variants (menu drops items in one-by-one)
  const menuContainer = {
    hidden: { opacity: 0, height: 0, scale: 0.98 },
    show: {
      opacity: 1,
      height: "auto",
      scale: 1,
      transition: { duration: 0.12, when: "beforeChildren" as const, staggerChildren: 0.06 },
    },
    exit: { opacity: 0, height: 0, scale: 0.98, transition: { duration: 0.10, when: "afterChildren" as const } },
  };

  const menuItem = {
    hidden: { opacity: 0, y: -10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.14, ease: [0, 0, 0.2, 1] as const } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.08 } },
  };

  return (
    <header className="px-4 lg:px-6 py-4 lg:py-5 safe-top">

      {/* Single unified layout (works for desktop + mobile) */}
      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Logo */}
          <NavHref
            href={isPresale ? MAIN_ORIGIN : "/"}
            onClick={closeMenu}
            title="Click for homepage"
            className="shrink-0"
          >
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[77px] lg:h-[132px] w-auto"
              priority
            />
          </NavHref>

          {/* Right: WalletStatus + countdowns (desktop) + menu icon */}
          <div className="flex flex-col items-end gap-1.5 mt-[10px]">
            {/* Countdowns (desktop only) + WalletStatus in one row */}
            <motion.div
              animate={{
                y: menuOpen ? 2 : 0,
                opacity: 1,
              }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex items-center gap-2 md:gap-3"
            >
              <div className="hidden md:flex items-center gap-3">
                <PayoutCountdown variant="inline" showSeconds onClick={() => setPayoutHistoryModalOpen(true)} />
                <CreditAccrualCountdown variant="inline" onClick={() => setCreditRankingModalOpen(true)} />
              </div>
              <WalletStatus />
            </motion.div>

          {/* Menu (dropdownlogo trigger) */}
          <div className="relative" ref={menuRef}>
            <motion.button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((v) => !v);
                // When closing, also close token submenu
                if (menuOpen) setTokenSubOpen(false);
              }}
              className="group relative select-none rounded-lg p-[2px] hover:shadow-[0_0_20px_rgba(236,72,153,0.6)]"
              style={{
                background: "linear-gradient(90deg, #ec4899, #a855f7, #06b6d4, #a855f7, #ec4899)",
                backgroundSize: "200% 100%",
                animation: "gradient-shift 2s ease infinite",
              }}
              animate={{
                rotate: menuOpen ? 8 : 0,
                scale: menuOpen ? 1.05 : 1,
              }}
              whileHover={{
                boxShadow: "0 0 25px rgba(168, 85, 247, 0.7)",
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="rounded-lg bg-black p-1 group-hover:bg-gray-900 transition-colors">
                <Image
                  src="/logos/dropdownlogo.png"
                  alt="Menu"
                  width={46}
                  height={46}
                  priority
                  className={[
                    "h-10 w-10 md:h-11 md:w-11",
                    "transition-all duration-150 ease-out",
                    "group-hover:brightness-125 group-hover:scale-110",
                  ].join(" ")}
                />
              </div>
            </motion.button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  key="allnav-dropdown"
                  role="menu"
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  variants={menuContainer}
                  className={[
                    "absolute right-0 top-[calc(100%+10px)] z-50 origin-top-right",
                    "translate-x-[2px] md:translate-x-0",
                    "w-[290px] overflow-hidden rounded-2xl",
                    "bg-black/75 backdrop-blur-md",
                    "border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                    "py-2",
                  ].join(" ")}
                >
                  {TOP_ITEMS.map((it) => (
                    <motion.div key={it.alt} variants={menuItem} className="px-3">
                      {it.type === "link" ? (
                        <NavHref
                          href={it.href}
                          onClick={closeMenu}
                          className="flex items-center justify-center rounded-xl py-2 hover:bg-white/5 transition-colors"
                        >
                          <Image
                            src={it.img}
                            alt={it.alt}
                            width={1000}
                            height={300}
                            style={{ height: it.h }}
                            className="w-auto object-contain"
                          />
                        </NavHref>
                      ) : it.type === "messages" ? (
                        <button
                          onClick={() => {
                            closeMenu();
                            setMessagesModalOpen(true);
                          }}
                          className="relative flex w-full items-center justify-center rounded-xl py-2 hover:bg-white/5 transition-colors"
                        >
                          <Image
                            src={it.img}
                            alt={it.alt}
                            width={1000}
                            height={300}
                            style={{ height: it.h }}
                            className="w-auto object-contain"
                          />
                          {unreadCount > 0 && (
                            <span className="absolute right-3 top-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold bg-pink-500 text-white rounded-full animate-pulse">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </button>
                      ) : (
                        <>
                          {/* Token header item */}
                          <button
                            onClick={() => setTokenSubOpen((v) => !v)}
                            className="flex w-full items-center justify-center rounded-xl py-2 hover:bg-white/5 transition-colors"
                          >
                            <Image
                              src={it.img}
                              alt={it.alt}
                              width={1000}
                              height={300}
                              style={{ height: it.h }}
                              className="w-auto object-contain"
                            />
                          </button>

                          {/* Token submenu — no per-item y-animation to avoid iOS touch target misalignment */}
                          <AnimatePresence>
                            {tokenSubOpen && (
                              <motion.div
                                key="token-submenu"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto", transition: { duration: 0.15 } }}
                                exit={{ opacity: 0, height: 0, transition: { duration: 0.1 } }}
                                className="mt-1 mb-2 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                              >
                                {tokenLinks.map((link) => (
                                  <div key={link.action || link.href} className="relative">
                                    {link.action === "wallet" ? (
                                      <button
                                        onClick={() => {
                                          closeMenu();
                                          setWalletModalOpen(true);
                                        }}
                                        className="block w-full px-4 py-3 text-sm text-white/90 hover:bg-white/10 active:bg-white/15 transition-colors text-center lg:text-left"
                                      >
                                        {link.label}
                                      </button>
                                    ) : (
                                      <NavHref
                                        href={link.href!}
                                        onClick={closeMenu}
                                        className="block px-4 py-3 text-sm text-white/90 hover:bg-white/10 active:bg-white/15 transition-colors text-center lg:text-left"
                                      >
                                        {link.label}
                                      </NavHref>
                                    )}
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

        {/* Mobile: countdowns stacked below logo */}
        <div className="flex md:hidden flex-col gap-1.5 mt-1.5">
          <PayoutCountdown variant="inline" showSeconds onClick={() => setPayoutHistoryModalOpen(true)} />
          <CreditAccrualCountdown variant="inline" onClick={() => setCreditRankingModalOpen(true)} />
        </div>
      </div>

      {/* Messages Modal */}
      <MessagesModal
        isOpen={messagesModalOpen}
        onClose={() => setMessagesModalOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Wallet Balances Modal */}
      <WalletBalancesModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      {/* Credit Ranking Modal */}
      <CreditManagementModal
        open={creditRankingModalOpen}
        onClose={() => setCreditRankingModalOpen(false)}
      />

      {/* XESS Payout History Modal */}
      <PayoutHistoryModal
        open={payoutHistoryModalOpen}
        onClose={() => setPayoutHistoryModalOpen(false)}
      />
    </header>
  );
}
