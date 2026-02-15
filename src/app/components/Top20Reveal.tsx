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
const SLIDE_PAD = 80;        // cqw – base off-screen distance (even card 0 travels this far)
const SLIDE_BASE_MS = 1000;  // ms – how long card 0 takes (shortest journey)

function getRowDone(rowIndex: number, cols: number): number {
  // Time when a given row's last card finishes sliding in
  const cellPercent = 100 / cols;
  const maxDistance = SLIDE_PAD + (cols - 1) * cellPercent;
  const rowDuration = Math.round(SLIDE_BASE_MS * maxDistance / SLIDE_PAD);
  // Each row starts after the previous row fully finishes
  return rowIndex * rowDuration;
}

function getCardAnim(i: number, cols: number) {
  const row = Math.floor(i / cols);
  const col = i % cols;
  const cellPercent = 100 / cols;

  // Every row uses the same slide animation — all cards in the row
  // start simultaneously from off-screen left, same speed, left lands first.
  const distance = SLIDE_PAD + col * cellPercent;
  const duration = Math.round(SLIDE_BASE_MS * distance / SLIDE_PAD);
  const delay = getRowDone(row, cols);

  return { name: "dealSlide", duration, delay };
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
          <Image
            src="/logos/xessexcoinlogo2.png"
            alt=""
            width={400}
            height={400}
            className="absolute w-[200px] md:w-[280px] h-auto opacity-[0.07] pointer-events-none"
          />
          <button
            onClick={() => doReveal?.()}
            className="relative cursor-pointer focus:outline-none group"
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
              const col = i % cols;
              const cellPercent = 100 / cols;
              const startX = -(SLIDE_PAD + col * cellPercent);

              return (
                <div
                  key={i}
                  style={{
                    opacity: 0,
                    animation: `dealSlide ${anim.duration}ms cubic-bezier(0.25, 0.1, 0.25, 1) ${anim.delay}ms forwards`,
                    "--deal-start-x": `${startX}cqw`,
                  } as React.CSSProperties}
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
