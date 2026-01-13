"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PlanCode = "MM" | "MY" | "DM" | "DY";

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  return nextValue;
}

function extractPlan(next: string): PlanCode | null {
  const match = next.match(/plan=(MM|MY|DM|DY)/);
  return match ? (match[1] as PlanCode) : null;
}

function Spinner({ status }: { status: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-400">{status}</p>
      </div>
    </div>
  );
}

function AuthCallbackContent() {
  const sp = useSearchParams();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    (async () => {
      const next = sanitizeNext(sp.get("next"));

      setStatus("Creating your session...");

      const res = await fetch("/api/auth/supabase/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ next }),
      }).catch(() => null);

      if (!res || !res.ok) {
        console.error("complete endpoint failed", res?.status);
        window.location.href = "/login?error=session_failed";
        return;
      }

      let plan = extractPlan(next);
      if (!plan) {
        const stored = localStorage.getItem("selected_plan");
        if (stored && ["MM", "MY", "DM", "DY"].includes(stored)) {
          plan = stored as PlanCode;
        }
      }
      localStorage.removeItem("selected_plan");

      if (plan) {
        setStatus("Redirecting to payment...");
        try {
          const payRes = await fetch("/api/billing/nowpayments/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ plan }),
          });

          if (payRes.ok) {
            const payData = await payRes.json().catch(() => null);
            const redirectUrl = payData?.redirectUrl;
            if (redirectUrl) {
              window.location.href = redirectUrl;
              return;
            }
          } else {
            console.error("NOWPayments start failed:", payRes.status);
          }
        } catch (err) {
          console.error("NOWPayments error:", err);
        }
        window.location.href = `/signup?plan=${plan}`;
        return;
      }

      window.location.href = next;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner status={status} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner status="Loading..." />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
