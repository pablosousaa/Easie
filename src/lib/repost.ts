import type { Posting } from "./types";

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

/** Last posted datetime for product+group (any prior posting marked posted). */
export function lastPostedAt(
  postings: Posting[],
  productId: string,
  groupId: string,
): string | null {
  const hits = postings
    .filter(
      (p) =>
        p.productId === productId &&
        p.groupId === groupId &&
        p.status === "posted" &&
        p.postedAt,
    )
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  return hits[0]?.postedAt ?? null;
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
