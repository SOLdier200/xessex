/**
 * XESS math utilities for token calculations
 */

export const XESS_DECIMALS = 9n;
export const ONE = 10n ** XESS_DECIMALS;

export function toAtomic(whole: number): bigint {
  return BigInt(Math.floor(whole)) * ONE;
}

export function mulBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10_000n;
}

export function divRoundDown(amount: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) return 0n;
  return amount / divisor;
}

export function formatXess(atomic: bigint): string {
  const whole = atomic / ONE;
  const frac = atomic % ONE;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
