import type { EasieStore, Product } from "./types";
import { postedTimestamps } from "./posting-history";

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

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type PostCounts = {
  today: number;
  week: number;
  total: number;
};

/** Count every completed post timestamp (postedHistory), not just live status. */
export function countPosted(store: EasieStore, now: Date): PostCounts {
  const dayStart = startOfLocalDay(now).getTime();
  const weekStart = startOfLocalWeek(now).getTime();
  let today = 0;
  let week = 0;
  let total = 0;

  for (const p of store.postings) {
    for (const iso of postedTimestamps(p)) {
      const ms = new Date(iso).getTime();
      if (!Number.isFinite(ms)) continue;
      total += 1;
      if (ms >= dayStart) today += 1;
      if (ms >= weekStart) week += 1;
    }
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
    const key = localDayKey(d.getTime());
    buckets.push({
      date: key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const p of store.postings) {
    for (const iso of postedTimestamps(p)) {
      const ms = new Date(iso).getTime();
      if (!Number.isFinite(ms)) continue;
      const idx = index.get(localDayKey(ms));
      if (idx != null) buckets[idx].count += 1;
    }
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
