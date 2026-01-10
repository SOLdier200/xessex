"use client";

import { Suspense } from "react";
import AgeGateContent from "./AgeGateContent";

export default function AgeGatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AgeGateContent />
    </Suspense>
  );
}
