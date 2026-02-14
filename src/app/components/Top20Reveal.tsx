"use client";

import React, { createContext, useContext, useState } from "react";
import Image from "next/image";

/* ── Shared reveal context ── */
const RevealCtx = createContext(false);
const RevealSetCtx = createContext<(() => void) | null>(null);

/** Wrap around any sections that should share the reveal state. */
export function Top20RevealProvider({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <RevealCtx.Provider value={revealed}>
      <RevealSetCtx.Provider value={() => setRevealed(true)}>
        {children}
      </RevealSetCtx.Provider>
    </RevealCtx.Provider>
  );
}

/** Gate that hides its children until revealed, then pops them in. */
export function RevealGate({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const revealed = useContext(RevealCtx);
  if (!revealed) return null;
  return (
    <div
      style={{
        opacity: 0,
        animation: `popIn 500ms ease-out ${delay}ms forwards`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Top 20 grid section ── */
export default function Top20Reveal({ children }: { children: React.ReactNode }) {
  const revealed = useContext(RevealCtx);
  const doReveal = useContext(RevealSetCtx);
  const items = React.Children.toArray(children);

  return (
    <section
      className="rounded-2xl p-4 md:p-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #050a1a, #0a1628)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.15'%3E%3Ccircle cx='100' cy='100' r='1'/%3E%3Ccircle cx='300' cy='50' r='0.5'/%3E%3Ccircle cx='500' cy='120' r='1.5'/%3E%3Ccircle cx='700' cy='80' r='0.8'/%3E%3Ccircle cx='150' cy='250' r='1'/%3E%3Ccircle cx='400' cy='200' r='0.6'/%3E%3Ccircle cx='600' cy='280' r='1.2'/%3E%3Ccircle cx='50' cy='400' r='0.7'/%3E%3Ccircle cx='250' cy='350' r='1'/%3E%3Ccircle cx='450' cy='420' r='0.5'/%3E%3Ccircle cx='650' cy='380' r='1.3'/%3E%3Ccircle cx='750' cy='450' r='0.9'/%3E%3Ccircle cx='100' cy='550' r='1.1'/%3E%3Ccircle cx='350' cy='500' r='0.6'/%3E%3Ccircle cx='550' cy='580' r='1'/%3E%3Ccircle cx='200' cy='650' r='0.8'/%3E%3Ccircle cx='400' cy='700' r='1.4'/%3E%3Ccircle cx='600' cy='650' r='0.5'/%3E%3Ccircle cx='750' cy='720' r='1'/%3E%3Ccircle cx='50' cy='750' r='0.7'/%3E%3C/g%3E%3C/svg%3E")`,
      }}
    >
      {!revealed ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-24">
          <button
            onClick={() => doReveal?.()}
            className="cursor-pointer focus:outline-none group"
          >
            <Image
              src="/logos/textlogo/siteset3/top20100.png"
              alt="Top 20"
              width={938}
              height={276}
              className="h-[64px] md:h-[80px] w-auto animate-top20-glow drop-shadow-lg group-hover:scale-105 transition-transform"
            />
          </button>
          <p className="mt-4 text-white/40 text-sm animate-pulse">Tap to reveal</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Image
              src="/logos/textlogo/siteset3/top20100.png"
              alt="Top 20"
              width={938}
              height={276}
              className="h-[51px] w-auto"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-y-2 sm:gap-x-1.5">
            {items.map((child, i) => (
              <div
                key={i}
                style={{
                  opacity: 0,
                  animation: `popIn 600ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 120}ms forwards`,
                }}
              >
                {child}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
