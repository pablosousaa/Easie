"use client";

import type { EasieStore, Product, TextTemplate, TextVariation } from "./types";
import { STORAGE_KEY } from "./types";
import { createDefaultTemplate } from "./templates";

const listeners = new Set<() => void>();
let memoryCache: EasieStore | null = null;

/** Cached once — required by useSyncExternalStore getServerSnapshot. */
const SERVER_SNAPSHOT: EasieStore = {
  products: [],
  lastProduct: null,
  templates: [createDefaultTemplate()],
  variations: [],
};

function defaultStore(): EasieStore {
  return {
    products: [],
    lastProduct: null,
    templates: [createDefaultTemplate()],
    variations: [],
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

  return {
    products: parsed.products ?? [],
    lastProduct: parsed.lastProduct ?? null,
    templates,
    variations: parsed.variations ?? [],
  };
}

export function loadStore(): EasieStore {
  if (typeof window === "undefined") return defaultStore();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    return normalize(JSON.parse(raw) as Partial<EasieStore>);
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

export function getDefaultTemplate(templates: TextTemplate[]): TextTemplate {
  return templates.find((t) => t.isDefault) ?? templates[0] ?? createDefaultTemplate();
}

export function upsertLastProduct(
  store: EasieStore,
  product: Product,
): EasieStore {
  return { ...store, lastProduct: product };
}

export function setVariations(
  store: EasieStore,
  variations: TextVariation[],
): EasieStore {
  return { ...store, variations };
}
