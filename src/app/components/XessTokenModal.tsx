"use client";

import Link from "next/link";

type XessTokenModalProps = {
  open: boolean;
  onClose: () => void;
};

const tokenLinks = [
  {
    label: "Tokenomics",
    href: "/tokenomics",
    description: "Learn about XESS token distribution and economics",
    gradient: "from-purple-500/20 to-violet-500/20",
    border: "border-purple-400/40",
    hoverGradient: "hover:from-purple-500/30 hover:to-violet-500/30",
  },
  {
    label: "Whitepaper",
    href: "/whitepaper",
    description: "Read the official XESS whitepaper",
    gradient: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-400/40",
    hoverGradient: "hover:from-blue-500/30 hover:to-cyan-500/30",
  },
  {
    label: "SOL/XESS Pool",
    href: "/sol-xess-pool",
    description: "View liquidity pool information",
    gradient: "from-green-500/20 to-emerald-500/20",
    border: "border-green-400/40",
    hoverGradient: "hover:from-green-500/30 hover:to-emerald-500/30",
  },
  {
    label: "Jupiter Swap",
    href: "/jupiter-swap",
    description: "Swap tokens on Jupiter",
    gradient: "from-orange-500/20 to-amber-500/20",
    border: "border-orange-400/40",
    hoverGradient: "hover:from-orange-500/30 hover:to-amber-500/30",
  },
  {
    label: "Xess News",
    href: "/xess-news",
    description: "Latest updates and announcements",
    gradient: "from-pink-500/20 to-rose-500/20",
    border: "border-pink-400/40",
    hoverGradient: "hover:from-pink-500/30 hover:to-rose-500/30",
  },
];

export default function XessTokenModal({ open, onClose }: XessTokenModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl neon-border bg-black/90 p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-white mb-2">XESS Token</h2>
        <p className="text-sm text-white/60 mb-6">
          Explore the XESS ecosystem
        </p>

        <div className="flex flex-col gap-3">
          {tokenLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r ${link.gradient} ${link.hoverGradient} border ${link.border} text-white font-semibold transition flex flex-col`}
            >
              <span>{link.label}</span>
              <span className="text-xs font-normal text-white/50">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
