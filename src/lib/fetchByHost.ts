import { PRESALE_ORIGIN } from "./origins";

/** Fetch from the presale backend. Always resolves to the presale origin. */
export async function fetchPresale(
  inputPath: string,
  init?: RequestInit,
): Promise<Response> {
  const url = inputPath.startsWith("http")
    ? inputPath
    : `${PRESALE_ORIGIN}${inputPath.startsWith("/") ? "" : "/"}${inputPath}`;

  return fetch(url, init);
}
