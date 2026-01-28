"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * DEPRECATED: Redirects to wallet connect page.
 */
export default function LinkAuthWalletPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login/diamond");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black flex items-center justify-center">
      <div className="text-white/60">Redirecting...</div>
    </div>
  );
}
