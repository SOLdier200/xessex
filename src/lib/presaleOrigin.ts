/**
 * Re-export from origins.ts for backward compatibility.
 * Prefer importing from "@/lib/origins" or "@/lib/fetchByHost" directly.
 */
export { PRESALE_ORIGIN } from "./origins";

import { PRESALE_ORIGIN } from "./origins";

/** Build a presale API URL. Returns absolute URL to presale origin. */
export function presaleUrl(path: string): string {
  return `${PRESALE_ORIGIN}${path}`;
}
