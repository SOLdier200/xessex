/**
 * Shared tier color definitions.
 * Import these everywhere a tier level is displayed to ensure consistent colors.
 */

export const TIER_COLORS: Record<number, { text: string; bg: string; border: string; badge: string }> = {
  0:  { text: "text-white/50",    bg: "bg-white/5",          border: "border-white/20",     badge: "from-white/10 to-white/5 border-white/20 text-white/50" },
  1:  { text: "text-gray-300",    bg: "bg-gray-500/10",      border: "border-gray-400/30",  badge: "from-gray-500/30 to-gray-600/20 border-gray-400/40 text-gray-300" },
  2:  { text: "text-green-400",   bg: "bg-green-500/10",     border: "border-green-400/30", badge: "from-green-500/30 to-green-600/20 border-green-400/40 text-green-400" },
  3:  { text: "text-blue-400",    bg: "bg-blue-500/10",      border: "border-blue-400/30",  badge: "from-blue-500/30 to-blue-600/20 border-blue-400/40 text-blue-400" },
  4:  { text: "text-purple-400",  bg: "bg-purple-500/10",    border: "border-purple-400/30",badge: "from-purple-500/30 to-purple-600/20 border-purple-400/40 text-purple-400" },
  5:  { text: "text-pink-400",    bg: "bg-pink-500/10",      border: "border-pink-400/30",  badge: "from-pink-500/30 to-pink-600/20 border-pink-400/40 text-pink-400" },
  6:  { text: "text-orange-400",  bg: "bg-orange-500/10",    border: "border-orange-400/30",badge: "from-orange-500/30 to-orange-600/20 border-orange-400/40 text-orange-400" },
  7:  { text: "text-red-400",     bg: "bg-red-500/10",       border: "border-red-400/30",   badge: "from-red-500/30 to-red-600/20 border-red-400/40 text-red-400" },
  8:  { text: "text-cyan-400",    bg: "bg-cyan-500/10",      border: "border-cyan-400/30",  badge: "from-cyan-500/30 to-cyan-600/20 border-cyan-400/40 text-cyan-400" },
  9:  { text: "text-amber-400",   bg: "bg-amber-500/10",     border: "border-amber-400/30", badge: "from-amber-500/30 to-amber-600/20 border-amber-400/40 text-amber-400" },
  10: { text: "text-yellow-300",  bg: "bg-yellow-500/10",    border: "border-yellow-400/30",badge: "from-yellow-500/30 to-yellow-600/20 border-yellow-400/40 text-yellow-300" },
};

/** Get color config for a tier, defaulting to tier 0 */
export function getTierColor(tier: number) {
  return TIER_COLORS[tier] ?? TIER_COLORS[0];
}
