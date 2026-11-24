import type { Posting } from "./types";
import { lastHistoryPostedAt } from "./posting-history";

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

/**
 * Last completed post datetime for product+group.
 * Uses postedHistory so cooldown still works after "Não postado" / re-open.
 */
export function lastPostedAt(
  postings: Posting[],
  productId: string,
  groupId: string,
): string | null {
  let latest: string | null = null;
  for (const p of postings) {
    if (p.productId !== productId || p.groupId !== groupId) continue;
    const at = lastHistoryPostedAt(p);
    if (at && (!latest || at > latest)) latest = at;
  }
  return latest;
}

export type RepostGuard =
  | { blocked: false }
  | { blocked: true; lastPostedAt: string; daysLeft: number };

export function checkRepostWindow(
  postings: Posting[],
  productId: string,
  groupId: string,
  windowDays: number,
  now = new Date().toISOString(),
): RepostGuard {
  const last = lastPostedAt(postings, productId, groupId);
  if (!last) return { blocked: false };
  const elapsed = daysBetween(last, now);
  if (elapsed >= windowDays) return { blocked: false };
  return {
    blocked: true,
    lastPostedAt: last,
    daysLeft: Math.ceil(windowDays - elapsed),
  };
}
