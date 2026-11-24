import type {
  EasieStore,
  FacebookGroup,
  Posting,
  Product,
  TextVariation,
} from "./types";
import { createId, nowIso } from "./ids";

export function activeGroups(store: EasieStore): FacebookGroup[] {
  return store.groups.filter((g) => g.active);
}

export function ensureChecklist(
  store: EasieStore,
  product: Product,
  variations: TextVariation[],
): EasieStore {
  const groups = activeGroups(store);
  const existing = store.postings.filter((p) => p.productId === product.id);
  const byGroup = new Map(existing.map((p) => [p.groupId, p]));
  const nextPostings: Posting[] = [...store.postings.filter((p) => p.productId !== product.id)];

  groups.forEach((group, index) => {
    const current = byGroup.get(group.id);
    const fallbackIndex = variations.length
      ? index % variations.length
      : 0;
    if (current) {
      // variationIndex 0 is valid — never use `||` (treats 0 as missing).
      const variationIndex = Number.isFinite(current.variationIndex)
        ? current.variationIndex
        : fallbackIndex;
      const selected =
        variations.length > 0
          ? variations[
              ((variationIndex % variations.length) + variations.length) %
                variations.length
            ]
          : null;
      nextPostings.push({
        ...current,
        variationText: current.variationText || selected?.text || "",
        variationIndex,
      });
    } else {
      const variation =
        variations.length > 0 ? variations[fallbackIndex] : null;
      nextPostings.push({
        id: createId("pst"),
        productId: product.id,
        groupId: group.id,
        status: "pending",
        variationText: variation?.text ?? "",
        variationIndex: fallbackIndex,
        postedAt: null,
        createdAt: nowIso(),
      });
    }
  });

  return { ...store, postings: nextPostings };
}

export function progressForProduct(store: EasieStore, productId: string) {
  const groups = activeGroups(store);
  const relevant = store.postings.filter(
    (p) =>
      p.productId === productId && groups.some((g) => g.id === p.groupId),
  );
  const done = relevant.filter(
    (p) => p.status === "posted" || p.status === "ignored",
  ).length;
  const total = groups.length;
  return { done, total, pending: Math.max(0, total - done) };
}

export function markPostingStatus(
  store: EasieStore,
  postingId: string,
  status: Posting["status"],
): EasieStore {
  const postings = store.postings.map((p) => {
    if (p.id !== postingId) return p;
    return {
      ...p,
      status,
      postedAt: status === "posted" ? nowIso() : null,
    };
  });
  return { ...store, postings };
}

export function maybeCompleteProduct(
  store: EasieStore,
  productId: string,
): EasieStore {
  const { done, total } = progressForProduct(store, productId);
  if (total === 0 || done < total) return store;
  return {
    ...store,
    products: store.products.map((p) =>
      p.id === productId
        ? { ...p, status: "done", completedAt: p.completedAt ?? nowIso() }
        : p,
    ),
  };
}

/**
 * If a posting was reverted to pending and the product was already "done",
 * put it back in the queue as active so the checklist stays usable.
 */
export function maybeReopenProduct(
  store: EasieStore,
  productId: string,
): EasieStore {
  const { done, total } = progressForProduct(store, productId);
  if (total === 0 || done >= total) return store;
  const product = store.products.find((p) => p.id === productId);
  if (!product || product.status !== "done") return store;
  return {
    ...store,
    products: store.products.map((p) =>
      p.id === productId
        ? { ...p, status: "active", completedAt: null }
        : p,
    ),
  };
}
