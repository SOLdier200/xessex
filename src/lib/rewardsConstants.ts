/**
 * Constants for the Special Credits Rewards Drawing system
 *
 * Rules:
 * - Special Credits are not purchasable and have no cash value.
 * - Special Credits cannot be converted into any token.
 * - Special Credits cannot be sold or withdrawn.
 * - Special Credits are used only for:
 *   (1) entering the Rewards Drawing (tickets)
 *   (2) redeeming membership months
 */

// XESS token decimals (standard SPL token) - used for Diamond XESS payouts only
export const XESS_DECIMALS = 9n;
export const XESS_MULTIPLIER = 10n ** XESS_DECIMALS; // 1_000_000_000n
export const XESS_ATOMIC = XESS_MULTIPLIER; // alias for client code

// Special Credits: 1 credit = 1000 microcredits (for fractional accrual)
export const CREDIT_MICRO = 1000n;

// Ticket pricing (1 credit = 1 ticket)
export const DRAWING_TICKET_MICRO = CREDIT_MICRO; // 1000 microcredits = 1 credit = 1 ticket

// Legacy alias (keep for existing code references)
export const RAFFLE_CREDIT_TICKET_MICRO = DRAWING_TICKET_MICRO;

// Prize split in basis points (50%, 30%, 20%)
export const PRIZE_SPLIT = {
  first: 5000n,   // 50%
  second: 3000n,  // 30%
  third: 2000n,   // 20%
} as const;

export const BPS_BASE = 10000n;

// Drawing timing (PT timezone)
export const DRAWING_OPEN_HOUR = 0;
export const DRAWING_CLOSE_HOUR = 23;

// Winners have 1 week to claim
export const CLAIM_EXPIRY_DAYS = 7;

// Default match ratio (internal system match, not user purchase)
export const DEFAULT_MATCH_RATIO = 1n;
