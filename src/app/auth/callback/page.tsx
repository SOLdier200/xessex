// src/app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

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

function AuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      const next = sanitizeNext(sp.get("next"));
      const supabase = supabaseBrowser();

      // Server already did the PKCE exchange - just get the session from cookies
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        console.error("No supabase session after server exchange");
        router.replace(`/login?error=auth_failed`);
        return;
      }

      // Create Prisma session cookie (your real auth)
      setStatus("Creating your account…");
      const res = await fetch("/api/auth/supabase/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken, next }),
      }).catch(() => null);

      if (!res || !res.ok) {
        console.error("complete endpoint failed", res?.status);
        router.replace(`/login?error=session_failed`);
        return;
      }

      // Clear Supabase session (Prisma cookie is your long-term session)
      await supabase.auth.signOut().catch(() => null);

      // Get plan from next param OR localStorage
      let plan = extractPlan(next);
      if (!plan) {
        const stored = localStorage.getItem("selected_plan");
        if (stored && ["MM", "MY", "DM", "DY"].includes(stored)) {
          plan = stored as PlanCode;
        }
      }
      // Clean up localStorage
      localStorage.removeItem("selected_plan");

      // If we have a plan, start NOWPayments directly
      if (plan) {
        setStatus("Redirecting to payment…");
        try {
          const payRes = await fetch("/api/billing/nowpayments/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planCode: plan }),
          });

          if (payRes.ok) {
            const payData = await payRes.json();
            const invoiceUrl = payData.invoiceUrl || payData.payment_url || payData.invoice_url;
            if (invoiceUrl) {
              window.location.href = invoiceUrl;
              return;
            }
          } else {
            console.error("NOWPayments start failed:", payRes.status);
          }
        } catch (err) {
          console.error("NOWPayments error:", err);
        }
        // If payment fails, still redirect to signup with plan
        window.location.href = `/signup?plan=${plan}`;
        return;
      }

      // No plan - just go to next destination
      window.location.href = next;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-400">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400">Loading…</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
