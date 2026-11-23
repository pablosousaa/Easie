import { createId, nowIso } from "./ids";
import { ensureDbReady, sqlAll, sqlGet, sqlRun } from "./db";
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

async function ready() {
  await ensureDbReady();
}

function cadence(): "weekly" | "daily" {
  const raw = (process.env.ML_REFRESH_CADENCE || "weekly").toLowerCase();
  return raw === "daily" ? "daily" : "weekly";
}

function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function refreshKey(): string {
  return cadence() === "daily" ? dayKey() : weekKey();
}

async function getMeta(key: string): Promise<string | null> {
  const row = await sqlGet<{ value: string }>(
    "SELECT value FROM trending_meta WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

async function setMeta(key: string, value: string) {
  await sqlRun(
    `INSERT INTO trending_meta (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function ensureTrendingCategories() {
  await ready();
  const countRow = await sqlGet<{ c: number | string }>(
    "SELECT COUNT(*) AS c FROM trending_categories",
  );
  const count = Number(countRow?.c ?? 0);
  if (count > 0) return;

  const defs = parseCategoriesEnv() ?? DEFAULT_TRENDING_CATEGORIES;
  for (const def of defs) {
    await sqlRun(
      `INSERT INTO trending_categories (id, ml_category_id, name, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        createId("tcat"),
        def.mlCategoryId,
        def.name,
        def.enabled ? 1 : 0,
        def.sortOrder,
      ],
    );
  }
}

async function listCategories(enabledOnly = false): Promise<CatRow[]> {
  await ensureTrendingCategories();
  if (enabledOnly) {
    return sqlAll<CatRow>(
      `SELECT * FROM trending_categories WHERE enabled = 1 ORDER BY sort_order ASC, name ASC`,
    );
  }
  return sqlAll<CatRow>(
    `SELECT * FROM trending_categories ORDER BY sort_order ASC, name ASC`,
  );
}

async function isStale(): Promise<boolean> {
  const lastKey = await getMeta("refresh_key");
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

async function readItems(categoryFilter?: string): Promise<ItemRow[]> {
  if (categoryFilter) {
    return sqlAll<ItemRow>(
      `SELECT * FROM trending_items WHERE category_id = ? ORDER BY category_name ASC, rank ASC`,
      [categoryFilter],
    );
  }
  return sqlAll<ItemRow>(
    `SELECT * FROM trending_items ORDER BY category_name ASC, rank ASC`,
  );
}

export async function refreshTrending(force = false): Promise<{
  source: TrendingSource;
  count: number;
  warning: string | null;
}> {
  await ensureTrendingCategories();
  const existing = await readItems();
  if (!force && !(await isStale()) && existing.length > 0) {
    return {
      source: ((await getMeta("source")) as TrendingSource) || "cache",
      count: existing.length,
      warning: null,
    };
  }

  const cats = await listCategories(true);
  const all: Array<{
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
  }> = [];
  let source: TrendingSource = "mock";
  let usedMock = false;
  let usedLive = false;

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
  await sqlRun("DELETE FROM trending_items");
  for (const item of all) {
    await sqlRun(
      `INSERT INTO trending_items (
        id, ml_item_id, name, thumbnail, price, currency, category_id, category_name,
        rank, permalink, free_shipping, week_key, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
  }

  await setMeta("refresh_key", key);
  await setMeta("last_updated_at", now);
  await setMeta("source", source);

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
  await ensureTrendingCategories();
  const existing = await readItems();
  let warning: string | null = null;
  let source = ((await getMeta("source")) as TrendingSource) || "cache";

  if (opts?.forceRefresh || existing.length === 0 || (await isStale())) {
    const result = await refreshTrending(Boolean(opts?.forceRefresh));
    source = result.source;
    warning = result.warning;
  } else {
    source = "cache";
  }

  let items = await readItems(opts?.categoryId);
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category_name.toLowerCase().includes(q),
    );
  }

  const lastUpdatedAt = await getMeta("last_updated_at");

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
    categories: (await listCategories()).map((c) => ({
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
    stale: await isStale(),
    warning,
  };
}

export async function updateCategoryEnabled(
  mlCategoryId: string,
  enabled: boolean,
) {
  await ensureTrendingCategories();
  await sqlRun(
    `UPDATE trending_categories SET enabled = ? WHERE ml_category_id = ?`,
    [enabled ? 1 : 0, mlCategoryId],
  );
}
