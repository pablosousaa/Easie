import type { Posting } from "./types";

/** Fold live `postedAt` into history when the row is currently marked posted. */
export function ensurePostedHistory(posting: Posting): string[] {
  const hist = Array.isArray(posting.postedHistory)
    ? posting.postedHistory.filter((t) => typeof t === "string" && t.length > 0)
    : [];
  if (
    posting.status === "posted" &&
    posting.postedAt &&
    !hist.includes(posting.postedAt)
  ) {
    return [...hist, posting.postedAt];
  }
  return hist;
}

/** Every completed-post timestamp for Relatórios (legacy rows without history included). */
export function postedTimestamps(posting: Posting): string[] {
  const hist = ensurePostedHistory(posting);
  if (hist.length > 0) return hist;
  if (posting.status === "posted" && posting.postedAt) return [posting.postedAt];
  return [];
}

export function lastHistoryPostedAt(posting: Posting): string | null {
  const stamps = postedTimestamps(posting);
  if (stamps.length === 0) return null;
  return stamps.reduce((a, b) => (a > b ? a : b));
}
