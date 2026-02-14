"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";

/* ── Shared reveal context ── */
const RevealCtx = createContext(false);
const RevealSetCtx = createContext<(() => void) | null>(null);

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

/* ── Responsive column count hook ── */
function useCols() {
  const [cols, setCols] = useState(7);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(7);
      else if (w >= 640) setCols(4);
      else setCols(2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

/* ── Timing constants ── */
const DEAL_DURATION = 2200;  // ms – all first-row cards share one duration
const DROP_BASE = 1200;      // ms – row 1 drop duration
const DROP_PER_ROW = 600;    // ms – extra per additional row

function getCardAnim(i: number, cols: number) {
  const row = Math.floor(i / cols);

  if (row === 0) {
    // All cards start simultaneously, same duration.
    // Different travel distances (via --deal-start-x) make them land left-to-right.
    return { name: "dealSlide", duration: DEAL_DURATION, delay: 0 };
  }

  return {
    name: "dropDown",
    duration: DROP_BASE + (row - 1) * DROP_PER_ROW,
    delay: DEAL_DURATION,
  };
}

/* ── Top 20 grid section ── */
export default function Top20Reveal({ children }: { children: React.ReactNode }) {
  const revealed = useContext(RevealCtx);
  const doReveal = useContext(RevealSetCtx);
  const items = React.Children.toArray(children);
  const cols = useCols();

  return (
    <section
      className="rounded-2xl p-4 md:p-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #050a1a, #0a1628)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.15'%3E%3Ccircle cx='100' cy='100' r='1'/%3E%3Ccircle cx='300' cy='50' r='0.5'/%3E%3Ccircle cx='500' cy='120' r='1.5'/%3E%3Ccircle cx='700' cy='80' r='0.8'/%3E%3Ccircle cx='150' cy='250' r='1'/%3E%3Ccircle cx='400' cy='200' r='0.6'/%3E%3Ccircle cx='600' cy='280' r='1.2'/%3E%3Ccircle cx='50' cy='400' r='0.7'/%3E%3Ccircle cx='250' cy='350' r='1'/%3E%3Ccircle cx='450' cy='420' r='0.5'/%3E%3Ccircle cx='650' cy='380' r='1.3'/%3E%3Ccircle cx='750' cy='450' r='0.9'/%3E%3Ccircle cx='100' cy='550' r='1.1'/%3E%3Ccircle cx='350' cy='500' r='0.6'/%3E%3Ccircle cx='550' cy='580' r='1'/%3E%3Ccircle cx='200' cy='650' r='0.8'/%3E%3Ccircle cx='400' cy='700' r='1.4'/%3E%3Ccircle cx='600' cy='650' r='0.5'/%3E%3Ccircle cx='750' cy='720' r='1'/%3E%3Ccircle cx='50' cy='750' r='0.7'/%3E%3C/g%3E%3C/svg%3E")`,
      }}
    >
      {/* Transparent coin logo behind everything */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image
          src="/logos/xessexcoinlogo2.png"
          alt=""
          width={600}
          height={600}
          className="w-[70%] max-w-[500px] h-auto opacity-[0.06]"
        />
      </div>

      {!revealed ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-16 md:py-24">
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
        <div className="relative z-10">
          <div className="mb-4">
            <Image
              src="/logos/textlogo/siteset3/top20100.png"
              alt="Top 20"
              width={938}
              height={276}
              className="h-[51px] w-auto"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-y-2 sm:gap-x-1.5" style={{ containerType: "inline-size" }}>
            {items.map((child, i) => {
              const anim = getCardAnim(i, cols);
              const isFirstRow = Math.floor(i / cols) === 0;
              const col = i % cols;

              // First row: all cards start from the same off-screen left position.
              // Each card's grid cell is at col*(100/cols) cqw, so we translate
              // backwards by that amount + a small pad to put them all off-screen left.
              const cellPercent = 100 / cols;
              const startX = isFirstRow ? -(col * cellPercent + 8) : 0;

              return (
                <div
                  key={i}
                  style={{
                    opacity: 0,
                    ...(isFirstRow
                      ? {
                          animation: `dealSlide ${anim.duration}ms cubic-bezier(0.25, 0.1, 0.25, 1) ${anim.delay}ms forwards`,
                          "--deal-start-x": `${startX}cqw`,
                        } as React.CSSProperties
                      : {
                          animation: `dropDown ${anim.duration}ms cubic-bezier(0.33, 0, 0.67, 1) ${anim.delay}ms forwards`,
                        }),
                  }}
                >
                  {child}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
