import type { EasieStore, Posting, Product } from "./types";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalWeek(d: Date): Date {
  // Segunda como início da semana (pt-BR)
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 domingo
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function postedAtMs(posting: Posting): number | null {
  if (posting.status !== "posted" || !posting.postedAt) return null;
  const t = new Date(posting.postedAt).getTime();
  return Number.isFinite(t) ? t : null;
}

export type PostCounts = {
  today: number;
  week: number;
  total: number;
};

export function countPosted(store: EasieStore, now: Date): PostCounts {
  const dayStart = startOfLocalDay(now).getTime();
  const weekStart = startOfLocalWeek(now).getTime();
  let today = 0;
  let week = 0;
  let total = 0;

  for (const p of store.postings) {
    const ms = postedAtMs(p);
    if (ms == null) continue;
    total += 1;
    if (ms >= dayStart) today += 1;
    if (ms >= weekStart) week += 1;
  }

  return { today, week, total };
}

export type DayBucket = { date: string; label: string; count: number };

/** Last N calendar days (including today), oldest first. */
export function postsPerDay(store: EasieStore, days: number, now: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfLocalDay(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      date: key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const p of store.postings) {
    const ms = postedAtMs(p);
    if (ms == null) continue;
    const key = new Date(ms).toISOString().slice(0, 10);
    const idx = index.get(key);
    if (idx != null) buckets[idx].count += 1;
  }
  return buckets;
}

export function sumResults(products: Product[]) {
  return products.reduce(
    (acc, p) => {
      acc.clicks += p.clicks || 0;
      acc.sales += p.sales || 0;
      return acc;
    },
    { clicks: 0, sales: 0 },
  );
}
