"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type MembershipInfo = {
  membership: string;
  isOnTrial: boolean;
};

export default function DiamondTeaser() {
  const [info, setInfo] = useState<MembershipInfo | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data?.authed) {
          setInfo({
            membership: data.membership,
            isOnTrial: data.isOnTrial ?? false,
          });
        }
      } catch {
        // Ignore
      }
    }
    fetchStatus();

    const handleAuthChange = () => fetchStatus();
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  // Only show to trial users and regular members
  if (!info) return null;
  if (info.membership === "DIAMOND") return null;
  if (info.membership === "FREE" && !info.isOnTrial) return null;

  return (
    <div className="rounded-xl p-4 bg-gradient-to-r from-yellow-500/10 via-purple-500/10 to-yellow-500/10 border border-yellow-400/30">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 flex-shrink-0">
          <Image
            src="/logos/diamond3.png"
            alt="Diamond"
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-yellow-300 font-semibold">
            {info.isOnTrial ? "Upgrade to Diamond After Your Trial" : "Upgrade to Diamond"}
          </h3>
          <p className="text-white/60 text-sm mt-1">
            Earn XESS tokens for watching and rating videos. Get paid to watch.
          </p>
        </div>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-purple-500/20 border border-yellow-400/50 text-yellow-300 font-semibold hover:from-yellow-500/30 hover:to-purple-500/30 transition whitespace-nowrap"
        >
          Learn More
        </Link>
      </div>
    </div>
  );
}
