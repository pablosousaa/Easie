import { mockBestsellers } from "./mock";
import type { ResolvedMlItem, TrendingSource } from "./types";

const ML_API = "https://api.mercadolibre.com";
const SITE = process.env.ML_SITE_ID?.trim() || "MLB";

type HighlightEntry = { id: string; position: number; type: string };

function accessToken(): string | null {
  return (
    process.env.ML_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim() ||
    null
  );
}

function authHeaders(): HeadersInit {
  const token = accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function mlGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ML_API}${path}`, {
      headers: { Accept: "application/json", ...authHeaders() },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function resolveHighlight(
  entry: HighlightEntry,
  categoryId: string,
  categoryName: string,
): Promise<ResolvedMlItem | null> {
  const { id, position, type } = entry;

  if (type === "ITEM" || id.match(/^MLB\d+$/)) {
    const item = await mlGet<{
      id: string;
      title: string;
      thumbnail: string;
      price: number;
      currency_id: string;
      permalink: string;
      shipping?: { free_shipping?: boolean };
    }>(`/items/${id}`);
    if (!item) return null;
    return {
      mlItemId: item.id,
      name: item.title,
      thumbnail: item.thumbnail?.replace("http://", "https://") ?? "",
      price: item.price,
      currency: item.currency_id || "BRL",
      categoryId,
      categoryName,
      rank: position,
      permalink: item.permalink,
      freeShipping: Boolean(item.shipping?.free_shipping),
    };
  }

  if (type === "PRODUCT") {
    const product = await mlGet<{
      id: string;
      name: string;
      pictures?: Array<{ url: string }>;
      buy_box_winner?: { item_id?: string; price?: number; currency_id?: string };
      permalink?: string;
    }>(`/products/${id}`);
    if (!product) return null;
    const winnerId = product.buy_box_winner?.item_id;
    if (winnerId) {
      const item = await resolveHighlight(
        { id: winnerId, position, type: "ITEM" },
        categoryId,
        categoryName,
      );
      if (item) return { ...item, name: product.name || item.name };
    }
    return {
      mlItemId: product.id,
      name: product.name,
      thumbnail: product.pictures?.[0]?.url?.replace("http://", "https://") ?? "",
      price: product.buy_box_winner?.price ?? 0,
      currency: product.buy_box_winner?.currency_id || "BRL",
      categoryId,
      categoryName,
      rank: position,
      permalink:
        product.permalink ||
        `https://www.mercadolivre.com.br/p/${product.id}`,
      freeShipping: false,
    };
  }

  // USER_PRODUCT and unknowns: try items endpoint, then search
  const asItem = await resolveHighlight(
    { id, position, type: "ITEM" },
    categoryId,
    categoryName,
  );
  if (asItem) return asItem;

  const search = await mlGet<{
    results: Array<{
      id: string;
      title: string;
      thumbnail: string;
      price: number;
      currency_id: string;
      permalink: string;
      shipping?: { free_shipping?: boolean };
    }>;
  }>(`/sites/${SITE}/search?q=${encodeURIComponent(id)}&limit=1`);
  const hit = search?.results?.[0];
  if (!hit) return null;
  return {
    mlItemId: hit.id,
    name: hit.title,
    thumbnail: hit.thumbnail?.replace("http://", "https://") ?? "",
    price: hit.price,
    currency: hit.currency_id || "BRL",
    categoryId,
    categoryName,
    rank: position,
    permalink: hit.permalink,
    freeShipping: Boolean(hit.shipping?.free_shipping),
  };
}

async function fetchHighlights(
  categoryId: string,
  categoryName: string,
): Promise<ResolvedMlItem[] | null> {
  if (!accessToken()) return null;
  const data = await mlGet<{ content: HighlightEntry[] }>(
    `/highlights/${SITE}/category/${categoryId}`,
  );
  if (!data?.content?.length) return null;

  const resolved: ResolvedMlItem[] = [];
  for (const entry of data.content.slice(0, 12)) {
    const item = await resolveHighlight(entry, categoryId, categoryName);
    if (item) resolved.push(item);
  }
  return resolved.length ? resolved : null;
}

/** Public search sorted by sold quantity — works without token for many categories. */
async function fetchSearchBestsellers(
  categoryId: string,
  categoryName: string,
): Promise<ResolvedMlItem[] | null> {
  const data = await mlGet<{
    results: Array<{
      id: string;
      title: string;
      thumbnail: string;
      price: number;
      currency_id: string;
      permalink: string;
      shipping?: { free_shipping?: boolean };
    }>;
  }>(
    `/sites/${SITE}/search?category=${encodeURIComponent(categoryId)}&sort=sold_quantity_desc&limit=12`,
  );
  if (!data?.results?.length) return null;
  return data.results.map((hit, i) => ({
    mlItemId: hit.id,
    name: hit.title,
    thumbnail: hit.thumbnail?.replace("http://", "https://") ?? "",
    price: hit.price,
    currency: hit.currency_id || "BRL",
    categoryId,
    categoryName,
    rank: i + 1,
    permalink: hit.permalink,
    freeShipping: Boolean(hit.shipping?.free_shipping),
  }));
}

export async function fetchCategoryBestsellers(
  categoryId: string,
  categoryName: string,
): Promise<{ items: ResolvedMlItem[]; source: TrendingSource }> {
  const highlights = await fetchHighlights(categoryId, categoryName);
  if (highlights?.length) return { items: highlights, source: "highlights" };

  const search = await fetchSearchBestsellers(categoryId, categoryName);
  if (search?.length) return { items: search, source: "search" };

  return {
    items: mockBestsellers(categoryId, categoryName),
    source: "mock",
  };
}

export function hasMlCredentials(): boolean {
  return Boolean(
    accessToken() ||
      process.env.ML_APP_ID?.trim() ||
      process.env.ML_CLIENT_ID?.trim(),
  );
}
