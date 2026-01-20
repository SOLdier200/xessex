/**
 * Constants for the XESS rewards and raffle system
 */

// XESS token decimals (standard SPL token)
export const XESS_DECIMALS = 9n;
export const XESS_MULTIPLIER = 10n ** XESS_DECIMALS; // 1_000_000_000n
export const XESS_ATOMIC = XESS_MULTIPLIER; // alias for client code

// Special Credits: 1 credit = 1000 microcredits (for fractional accrual)
export const CREDIT_MICRO = 1000n;

// Ticket pricing (1 credit = 1 ticket, 100 XESS = 1 ticket)
export const RAFFLE_CREDIT_TICKET_MICRO = CREDIT_MICRO; // 1000 microcredits = 1 credit = 1 ticket
export const RAFFLE_XESS_TICKET_ATOMIC = 100n * XESS_MULTIPLIER; // 100 XESS = 1 ticket

// Legacy aliases
export const CREDITS_PER_TICKET = RAFFLE_CREDIT_TICKET_MICRO;
export const XESS_PER_TICKET = RAFFLE_XESS_TICKET_ATOMIC;

// Prize split in basis points (50%, 30%, 20%)
export const PRIZE_SPLIT = {
  first: 5000n,   // 50%
  second: 3000n,  // 30%
  third: 2000n,   // 20%
} as const;

export const BPS_BASE = 10000n;

// Raffle timing (in PT timezone)
export const RAFFLE_OPEN_HOUR = 0; // Midnight PT on Sunday
export const RAFFLE_CLOSE_HOUR = 23; // 11 PM PT on Saturday
export const CLAIM_EXPIRY_DAYS = 7; // Winners have 1 week to claim

// Default match ratio (1:1)
export const DEFAULT_MATCH_RATIO = 1n;
