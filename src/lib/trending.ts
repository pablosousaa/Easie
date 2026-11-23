import { createId, nowIso } from "./ids";
import { getSqlite } from "./db";
import {
  DEFAULT_TRENDING_CATEGORIES,
  parseCategoriesEnv,
} from "./ml/categories";
import { fetchCategoryBestsellers, hasMlCredentials } from "./ml/client";
import type { TrendingListResponse, TrendingSource } from "./ml/types";

type CatRow = {
  id: string;
  ml_category_id: string;
  name: string;
  enabled: number;
  sort_order: number;
};

type ItemRow = {
  id: string;
  ml_item_id: string;
  name: string;
  thumbnail: string;
  price: number;
  currency: string;
  category_id: string;
  category_name: string;
  rank: number;
  permalink: string;
  free_shipping: number;
  week_key: string;
  updated_at: string;
};

function cadence(): "weekly" | "daily" {
  const raw = (process.env.ML_REFRESH_CADENCE || "weekly").toLowerCase();
  return raw === "daily" ? "daily" : "weekly";
}

function weekKey(d = new Date()): string {
  // ISO week
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function refreshKey(): string {
  return cadence() === "daily" ? dayKey() : weekKey();
}

function getMeta(key: string): string | null {
  const row = getSqlite()
    .prepare("SELECT value FROM trending_meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string) {
  getSqlite()
    .prepare(
      `INSERT INTO trending_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function ensureTrendingCategories() {
  const db = getSqlite();
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM trending_categories").get() as {
      c: number;
    }
  ).c;
  if (count > 0) return;

  const defs = parseCategoriesEnv() ?? DEFAULT_TRENDING_CATEGORIES;
  const insert = db.prepare(
    `INSERT INTO trending_categories (id, ml_category_id, name, enabled, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const def of defs) {
    insert.run(
      createId("tcat"),
      def.mlCategoryId,
      def.name,
      def.enabled ? 1 : 0,
      def.sortOrder,
    );
  }
}

function listCategories(enabledOnly = false): CatRow[] {
  ensureTrendingCategories();
  const sql = enabledOnly
    ? `SELECT * FROM trending_categories WHERE enabled = 1 ORDER BY sort_order ASC, name ASC`
    : `SELECT * FROM trending_categories ORDER BY sort_order ASC, name ASC`;
  return getSqlite().prepare(sql).all() as CatRow[];
}

function isStale(): boolean {
  const lastKey = getMeta("refresh_key");
  return lastKey !== refreshKey();
}

function nextRefreshAt(fromIso: string | null): string | null {
  if (!fromIso) return null;
  const d = new Date(fromIso);
  if (cadence() === "daily") {
    d.setUTCDate(d.getUTCDate() + 1);
  } else {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d.toISOString();
}

function readItems(categoryFilter?: string): ItemRow[] {
  if (categoryFilter) {
    return getSqlite()
      .prepare(
        `SELECT * FROM trending_items WHERE category_id = ? ORDER BY category_name ASC, rank ASC`,
      )
      .all(categoryFilter) as ItemRow[];
  }
  return getSqlite()
    .prepare(`SELECT * FROM trending_items ORDER BY category_name ASC, rank ASC`)
    .all() as ItemRow[];
}

export async function refreshTrending(force = false): Promise<{
  source: TrendingSource;
  count: number;
  warning: string | null;
}> {
  ensureTrendingCategories();
  if (!force && !isStale() && readItems().length > 0) {
    return {
      source: (getMeta("source") as TrendingSource) || "cache",
      count: readItems().length,
      warning: null,
    };
  }

  const cats = listCategories(true);
  const all: Array<ResolvedInsert> = [];
  let source: TrendingSource = "mock";
  let usedMock = false;
  let usedLive = false;

  type ResolvedInsert = {
    mlItemId: string;
    name: string;
    thumbnail: string;
    price: number;
    currency: string;
    categoryId: string;
    categoryName: string;
    rank: number;
    permalink: string;
    freeShipping: boolean;
  };

  for (const cat of cats) {
    const { items, source: catSource } = await fetchCategoryBestsellers(
      cat.ml_category_id,
      cat.name,
    );
    if (catSource === "mock") usedMock = true;
    else usedLive = true;
    if (catSource === "highlights") source = "highlights";
    else if (catSource === "search" && source !== "highlights") source = "search";
    for (const item of items) {
      all.push({
        mlItemId: item.mlItemId,
        name: item.name,
        thumbnail: item.thumbnail,
        price: item.price,
        currency: item.currency,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        rank: item.rank,
        permalink: item.permalink,
        freeShipping: item.freeShipping,
      });
    }
  }

  if (usedMock && !usedLive) source = "mock";
  else if (usedMock && usedLive) source = source === "mock" ? "search" : source;

  const key = refreshKey();
  const now = nowIso();
  const db = getSqlite();
  db.exec("DELETE FROM trending_items");
  const insert = db.prepare(
    `INSERT INTO trending_items (
      id, ml_item_id, name, thumbnail, price, currency, category_id, category_name,
      rank, permalink, free_shipping, week_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of all) {
    insert.run(
      createId("trit"),
      item.mlItemId,
      item.name,
      item.thumbnail,
      item.price,
      item.currency,
      item.categoryId,
      item.categoryName,
      item.rank,
      item.permalink,
      item.freeShipping ? 1 : 0,
      key,
      now,
    );
  }

  setMeta("refresh_key", key);
  setMeta("last_updated_at", now);
  setMeta("source", source);

  let warning: string | null = null;
  if (source === "mock") {
    warning = hasMlCredentials()
      ? "A API do Mercado Livre não respondeu. Mostrando lista demo; a última tentativa falhou."
      : "Sem credenciais ML (ML_ACCESS_TOKEN). Usando lista demo. Configure o .env para dados oficiais.";
  } else if (usedMock) {
    warning =
      "Algumas categorias usaram dados demo porque a API falhou ou exige token (Highlights).";
  }

  return { source, count: all.length, warning };
}

export async function getTrendingList(opts?: {
  categoryId?: string;
  q?: string;
  forceRefresh?: boolean;
}): Promise<TrendingListResponse> {
  ensureTrendingCategories();
  const existing = readItems();
  let warning: string | null = null;
  let source = (getMeta("source") as TrendingSource) || "cache";

  if (opts?.forceRefresh || existing.length === 0 || isStale()) {
    const result = await refreshTrending(Boolean(opts?.forceRefresh));
    source = result.source;
    warning = result.warning;
  } else {
    source = "cache";
  }

  let items = readItems(opts?.categoryId);
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category_name.toLowerCase().includes(q),
    );
  }

  const lastUpdatedAt = getMeta("last_updated_at");

  return {
    items: items.map((i) => ({
      id: i.id,
      mlItemId: i.ml_item_id,
      name: i.name,
      thumbnail: i.thumbnail,
      price: i.price,
      currency: i.currency,
      categoryId: i.category_id,
      categoryName: i.category_name,
      rank: i.rank,
      permalink: i.permalink,
      freeShipping: Boolean(i.free_shipping),
      weekKey: i.week_key,
    })),
    categories: listCategories().map((c) => ({
      id: c.id,
      mlCategoryId: c.ml_category_id,
      name: c.name,
      enabled: Boolean(c.enabled),
      sortOrder: c.sort_order,
    })),
    lastUpdatedAt,
    nextRefreshAt: nextRefreshAt(lastUpdatedAt),
    cadence: cadence(),
    source,
    stale: isStale(),
    warning,
  };
}

export function updateCategoryEnabled(mlCategoryId: string, enabled: boolean) {
  ensureTrendingCategories();
  getSqlite()
    .prepare(`UPDATE trending_categories SET enabled = ? WHERE ml_category_id = ?`)
    .run(enabled ? 1 : 0, mlCategoryId);
}
