import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureChecklist } from "./checklist";
import { generateVariations } from "./generate";
import type { EasieStore, Product } from "./types";

function baseStore(product: Product, groupCount: number): EasieStore {
  const createdAt = product.createdAt;
  return {
    products: [product],
    lastProduct: null,
    templates: [],
    variations: [],
    groups: Array.from({ length: groupCount }, (_, i) => ({
      id: `g${i}`,
      name: `Grupo ${i}`,
      link: `https://facebook.com/groups/${i}`,
      theme: "Geral",
      rules: "",
      active: true,
      createdAt,
    })),
    postings: [],
    settings: { repostWindowDays: 7 },
    trendingTakenIds: [],
    trendingHiddenIds: [],
  };
}

describe("ensureChecklist variation switch", () => {
  const product: Product = {
    id: "p1",
    name: "Creatina 300g Smoke",
    price: "89.90",
    originalPrice: "149.90",
    affiliateLink: "https://mercadolivre.com.br/x",
    freeShipping: true,
    fastDelivery: false,
    status: "active",
    queueOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    clicks: 0,
    sales: 0,
    commission: "",
    category: "",
  };

  it("keeps variationIndex 0 after selecting variation 1 on a non-first group", () => {
    const variations = generateVariations(product);
    let store = ensureChecklist(baseStore(product, 3), product, variations);
    const group1 = store.postings.find((p) => p.groupId === "g1");
    assert.ok(group1);
    assert.equal(group1.variationIndex, 1);

    store = {
      ...store,
      postings: store.postings.map((p) =>
        p.id === group1.id
          ? {
              ...p,
              variationIndex: 0,
              variationText: variations[0].text,
            }
          : p,
      ),
    };

    store = ensureChecklist(store, product, variations);
    const again = store.postings.find((p) => p.id === group1.id);
    assert.ok(again);
    assert.equal(again.variationIndex, 0);
    assert.equal(again.variationText, variations[0].text);
  });

  it("preserves an explicit switch to variation 5 through ensureChecklist", () => {
    const variations = generateVariations(product);
    let store = ensureChecklist(baseStore(product, 2), product, variations);
    const group0 = store.postings.find((p) => p.groupId === "g0");
    assert.ok(group0);

    store = {
      ...store,
      postings: store.postings.map((p) =>
        p.id === group0.id
          ? {
              ...p,
              variationIndex: 4,
              variationText: variations[4].text,
            }
          : p,
      ),
    };

    store = ensureChecklist(store, product, variations);
    const again = store.postings.find((p) => p.id === group0.id);
    assert.ok(again);
    assert.equal(again.variationIndex, 4);
    assert.equal(again.variationText, variations[4].text);
    assert.notEqual(again.variationText, variations[0].text);
  });
});
