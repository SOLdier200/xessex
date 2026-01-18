/**
 * XESS Token Decimal Precision:
 * - Token mint uses 9 decimals (1 XESS = 1,000,000,000 atomic units)
 * - RewardEvent.amount stored with 6 decimals (from emission schedule)
 * - ClaimLeaf.amountAtomic uses 9 decimals (for on-chain transfers)
 *
 * Use formatXess() for 9-decimal atomic units (mint/on-chain).
 * Use formatXess6() for 6-decimal amounts (RewardEvent storage).
 */

/**
 * Format XESS atomic units (9 decimals) to human-readable string.
 * Use this for on-chain amounts and ClaimLeaf.amountAtomic.
 * @param atomicStr - String representation of 9-decimal atomic units (from BigInt)
 * @param decimals - Number of decimal places to show (default: 2)
 */
export function formatXess(atomicStr: string, decimals = 2): string {
  if (!atomicStr || atomicStr === "0") return "0";

  const DECIMALS = 9;
  const padded = atomicStr.padStart(DECIMALS + 1, "0");
  const integerPart = padded.slice(0, -DECIMALS) || "0";
  const fractionalPart = padded.slice(-DECIMALS);

  // Format integer part with commas
  const formattedInteger = Number(integerPart).toLocaleString("en-US");

  if (decimals === 0) {
    return formattedInteger;
  }

  // Get the requested decimal places
  const truncatedFractional = fractionalPart.slice(0, decimals);

  // Remove trailing zeros
  const trimmed = truncatedFractional.replace(/0+$/, "");

  if (trimmed === "") {
    return formattedInteger;
  }

  return `${formattedInteger}.${trimmed}`;
}

/**
 * Format XESS 6-decimal units to human-readable string.
 * Use this for RewardEvent.amount values.
 * @param amount6Str - String representation of 6-decimal units (from BigInt)
 * @param decimals - Number of decimal places to show (default: 2)
 */
export function formatXess6(amount6Str: string, decimals = 2): string {
  if (!amount6Str || amount6Str === "0") return "0";

  const DECIMALS = 6;
  const padded = amount6Str.padStart(DECIMALS + 1, "0");
  const integerPart = padded.slice(0, -DECIMALS) || "0";
  const fractionalPart = padded.slice(-DECIMALS);

  const formattedInteger = Number(integerPart).toLocaleString("en-US");

  if (decimals === 0) {
    return formattedInteger;
  }

  const truncatedFractional = fractionalPart.slice(0, decimals);
  const trimmed = truncatedFractional.replace(/0+$/, "");

  if (trimmed === "") {
    return formattedInteger;
  }

  return `${formattedInteger}.${trimmed}`;
}

/**
 * Get a friendly label for reward types
 */
export function rewardTypeLabel(type: string): string {
  switch (type) {
    case "WEEKLY_LIKES":
      return "Likes Received";
    case "WEEKLY_MVM":
      return "MVM Bonus";
    case "WEEKLY_COMMENTS":
      return "Diamond Comments";
    case "REF_L1":
      return "Referral (L1)";
    case "REF_L2":
      return "Referral (L2)";
    case "REF_L3":
      return "Referral (L3)";
    default:
      return type;
  }
}
