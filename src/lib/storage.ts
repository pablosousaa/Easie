"use client";

import type {
  EasieStore,
  FacebookGroup,
  Posting,
  Product,
  ProductDraft,
  TextTemplate,
  TextVariation,
  UserSettings,
} from "./types";
import { EMPTY_RESULTS, STORAGE_KEY, STORAGE_KEY_V1 } from "./types";
import { createDefaultTemplate } from "./templates";

const listeners = new Set<() => void>();
let memoryCache: EasieStore | null = null;

const SERVER_SNAPSHOT: EasieStore = {
  products: [],
  lastProduct: null,
  templates: [createDefaultTemplate()],
  variations: [],
  groups: [],
  postings: [],
  settings: { repostWindowDays: 7 },
  trendingTakenIds: [],
  trendingHiddenIds: [],
};

function defaultStore(): EasieStore {
  return {
    products: [],
    lastProduct: null,
    templates: [createDefaultTemplate()],
    variations: [],
    groups: [],
    postings: [],
    settings: { repostWindowDays: 7 },
    trendingTakenIds: [],
    trendingHiddenIds: [],
  };
}

function asDraft(value: unknown): ProductDraft | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<ProductDraft>;
  if (typeof p.affiliateLink !== "string" || typeof p.name !== "string") {
    return null;
  }
  return {
    affiliateLink: p.affiliateLink,
    name: p.name,
    price: typeof p.price === "string" ? p.price : "",
    freeShipping: Boolean(p.freeShipping),
    fastDelivery: Boolean(p.fastDelivery),
  };
}

function normalize(parsed: Partial<EasieStore>): EasieStore {
  const templates =
    parsed.templates && parsed.templates.length > 0
      ? parsed.templates
      : [createDefaultTemplate()];

  if (!templates.some((t) => t.isDefault)) {
    templates[0] = { ...templates[0], isDefault: true };
  }

  const settings: UserSettings = {
    repostWindowDays: Math.max(
      1,
      Number(parsed.settings?.repostWindowDays ?? 7) || 7,
    ),
  };

  const products = Array.isArray(parsed.products)
    ? (parsed.products as Product[]).map((p) => ({
        ...EMPTY_RESULTS,
        ...p,
        clicks: Number.isFinite(p.clicks) ? p.clicks : 0,
        sales: Number.isFinite(p.sales) ? p.sales : 0,
        commission: typeof p.commission === "string" ? p.commission : "",
      }))
    : [];

  return {
    products,
    lastProduct: asDraft(parsed.lastProduct) ?? null,
    templates,
    variations: Array.isArray(parsed.variations)
      ? (parsed.variations as TextVariation[])
      : [],
    groups: Array.isArray(parsed.groups) ? (parsed.groups as FacebookGroup[]) : [],
    postings: Array.isArray(parsed.postings) ? (parsed.postings as Posting[]) : [],
    settings,
    trendingTakenIds: Array.isArray(parsed.trendingTakenIds)
      ? (parsed.trendingTakenIds as string[])
      : [],
    trendingHiddenIds: Array.isArray(parsed.trendingHiddenIds)
      ? (parsed.trendingHiddenIds as string[])
      : [],
  };
}

function migrateFromV1(): Partial<EasieStore> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    const v1 = JSON.parse(raw) as {
      products?: ProductDraft[];
      lastProduct?: ProductDraft | null;
      templates?: TextTemplate[];
      variations?: TextVariation[];
    };
    return {
      lastProduct: v1.lastProduct ?? null,
      templates: v1.templates,
      variations: v1.variations ?? [],
      products: [],
      groups: [],
      postings: [],
    };
  } catch {
    return null;
  }
}

export function loadStore(): EasieStore {
  if (typeof window === "undefined") return defaultStore();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw) as Partial<EasieStore>);

    const fromV1 = migrateFromV1();
    if (fromV1) {
      const migrated = normalize(fromV1);
      saveStore(migrated);
      return migrated;
    }
    return defaultStore();
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: EasieStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoreSnapshot(): EasieStore {
  if (typeof window === "undefined") return defaultStore();
  if (!memoryCache) memoryCache = loadStore();
  return memoryCache;
}

export function getServerSnapshot(): EasieStore {
  return SERVER_SNAPSHOT;
}

export function replaceStore(next: EasieStore): void {
  memoryCache = next;
  saveStore(next);
  emit();
}

/** Replace in-memory + local copy without treating as "local edit" source of truth for cloud. */
export function hydrateStore(next: EasieStore): void {
  memoryCache = normalize(next);
  saveStore(memoryCache);
  emit();
}

export function getDefaultTemplate(templates: TextTemplate[]): TextTemplate {
  return templates.find((t) => t.isDefault) ?? templates[0] ?? createDefaultTemplate();
}

export function upsertLastProduct(
  store: EasieStore,
  product: ProductDraft,
): EasieStore {
  return { ...store, lastProduct: product };
}

export function setVariations(
  store: EasieStore,
  variations: TextVariation[],
): EasieStore {
  return { ...store, variations };
}

export function exportMigratePayload(store: EasieStore) {
  return {
    products: store.products,
    templates: store.templates,
    groups: store.groups,
    postings: store.postings,
    lastProduct: store.lastProduct,
    settings: store.settings,
    trendingTakenIds: store.trendingTakenIds,
    trendingHiddenIds: store.trendingHiddenIds,
  };
}
