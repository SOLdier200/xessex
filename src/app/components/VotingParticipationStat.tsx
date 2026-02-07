"use client";

import { useEffect, useState } from "react";

type VotingData = {
  ok: boolean;
  votesCast: number;
  totalComments: number;
  percentage: number;
};

function getColorClass(pct: number): string {
  if (pct >= 100) return ""; // Rainbow handled separately
  if (pct >= 84) return "text-blue-400"; // Diamond blue
  if (pct >= 56) return "text-green-400";
  if (pct >= 36) return "text-yellow-400";
  if (pct >= 16) return "text-orange-400";
  return "text-red-400";
}

function getColorForBar(pct: number): string {
  if (pct >= 100) return "from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500";
  if (pct >= 84) return "from-blue-500 to-blue-400";
  if (pct >= 56) return "from-green-500 to-green-400";
  if (pct >= 36) return "from-yellow-500 to-yellow-400";
  if (pct >= 16) return "from-orange-500 to-orange-400";
  return "from-red-500 to-red-400";
}

export default function VotingParticipationStat() {
  const [data, setData] = useState<VotingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats/voting-participation", {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.ok) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch voting participation:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Re-fetch when page becomes visible (covers tab switch + in-app navigation)
    function onVisible() {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    // Also refresh every 5 minutes as fallback
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-black/40 rounded-xl p-4 text-center animate-pulse">
        <div className="h-8 bg-white/10 rounded w-16 mx-auto mb-2" />
        <div className="h-3 bg-white/10 rounded w-24 mx-auto" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isPerfect = data.percentage >= 100;
  const colorClass = getColorClass(data.percentage);
  const barColor = getColorForBar(data.percentage);

  return (
    <div className="bg-black/40 rounded-xl p-4 text-center relative overflow-hidden">
      {/* Sparkle/Crystal effects for 100% */}
      {isPerfect && (
        <>
          {/* Animated sparkles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-sparkle"
                style={{
                  left: `${10 + (i * 7) % 80}%`,
                  top: `${5 + (i * 13) % 90}%`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                <svg
                  className="w-3 h-3 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>
            ))}
          </div>

          {/* Crystal shards */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div
                key={`crystal-${i}`}
                className="absolute animate-crystal"
                style={{
                  left: `${15 + (i * 11) % 70}%`,
                  bottom: `-10px`,
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                <svg
                  className="w-2 h-4 text-cyan-400/80"
                  viewBox="0 0 8 16"
                  fill="currentColor"
                >
                  <path d="M4 0L8 12L4 16L0 12L4 0Z" />
                </svg>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Percentage display */}
      <div
        className={`font-bold transition-all ${
          isPerfect
            ? "text-3xl animate-rainbow-text"
            : `text-2xl ${colorClass}`
        }`}
      >
        {data.percentage.toFixed(1)}%
      </div>

      {/* Label */}
      <div className="text-xs text-white/60 mt-1">
        Voting Participation
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} ${
            isPerfect ? "animate-rainbow-bar" : ""
          } transition-all duration-500`}
          style={{ width: `${Math.min(data.percentage, 100)}%` }}
        />
      </div>

      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes crystal {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.5);
          }
          50% {
            opacity: 1;
            transform: translateY(-30px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(0.5);
          }
        }

        @keyframes rainbow-text {
          0% { color: #ff0000; }
          14% { color: #ff7f00; }
          28% { color: #ffff00; }
          42% { color: #00ff00; }
          57% { color: #0000ff; }
          71% { color: #4b0082; }
          85% { color: #9400d3; }
          100% { color: #ff0000; }
        }

        @keyframes rainbow-bar {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }

        .animate-sparkle {
          animation: sparkle 1.5s ease-in-out infinite;
        }

        .animate-crystal {
          animation: crystal 2s ease-out infinite;
        }

        .animate-rainbow-text {
          animation: rainbow-text 2s linear infinite;
          text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
        }

        .animate-rainbow-bar {
          animation: rainbow-bar 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
