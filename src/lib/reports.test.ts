import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markPostingStatus } from "./checklist";
import { countPosted, postsPerDay } from "./reports";
import { checkRepostWindow } from "./repost";
import type { EasieStore, Posting, Product } from "./types";

function product(id = "p1"): Product {
  return {
    id,
    name: "Creatina",
    price: "89.90",
    originalPrice: "",
    affiliateLink: "https://mercadolivre.com.br/x",
    freeShipping: true,
    fastDelivery: false,
    status: "active",
    queueOrder: 0,
    createdAt: "2026-03-01T10:00:00.000Z",
    completedAt: null,
    clicks: 0,
    sales: 0,
    commission: "",
    category: "",
  };
}

function posting(partial: Partial<Posting> & Pick<Posting, "id">): Posting {
  return {
    productId: "p1",
    groupId: "g1",
    status: "pending",
    variationText: "",
    variationIndex: 0,
    postedAt: null,
    postedHistory: [],
    createdAt: "2026-03-01T10:00:00.000Z",
    ...partial,
  };
}

function storeWith(postings: Posting[]): EasieStore {
  return {
    products: [product()],
    lastProduct: null,
    templates: [],
    variations: [],
    groups: [
      {
        id: "g1",
        name: "Grupo 1",
        link: "https://facebook.com/groups/1",
        theme: "Geral",
        rules: "",
        active: true,
        createdAt: "2026-03-01T10:00:00.000Z",
      },
    ],
    postings,
    settings: { repostWindowDays: 1 },
    trendingTakenIds: [],
    trendingHiddenIds: [],
  };
}

describe("Relatórios post history persistence", () => {
  it("keeps total after Não postado (re-post prep) clears live status", () => {
    const postedAt = "2026-03-10T15:00:00.000Z";
    let store = storeWith([
      posting({
        id: "pst1",
        status: "posted",
        postedAt,
        postedHistory: [postedAt],
      }),
    ]);

    assert.equal(countPosted(store, new Date("2026-03-10T18:00:00.000Z")).total, 1);

    store = markPostingStatus(store, "pst1", "pending");
    const row = store.postings[0];
    assert.equal(row.status, "pending");
    assert.equal(row.postedAt, null);
    assert.deepEqual(row.postedHistory, [postedAt]);
    assert.equal(countPosted(store, new Date("2026-03-11T12:00:00.000Z")).total, 1);
  });

  it("counts each re-post after the cooldown window without dropping the first", () => {
    const first = "2026-03-10T12:00:00.000Z";
    let store = storeWith([
      posting({
        id: "pst1",
        status: "posted",
        postedAt: first,
        postedHistory: [first],
      }),
    ]);

    // Window expired → reset for re-post, then mark posted again.
    store = markPostingStatus(store, "pst1", "pending");
    const guard = checkRepostWindow(
      store.postings,
      "p1",
      "g1",
      1,
      "2026-03-11T13:00:00.000Z",
    );
    assert.equal(guard.blocked, false);

    store = markPostingStatus(store, "pst1", "posted");
    assert.equal(store.postings[0].postedHistory.length, 2);
    assert.equal(countPosted(store, new Date("2026-03-11T14:00:00.000Z")).total, 2);
  });

  it("seeds legacy rows (status posted, empty history) into counts", () => {
    const store = storeWith([
      posting({
        id: "pst-legacy",
        status: "posted",
        postedAt: "2026-03-09T08:00:00.000Z",
        postedHistory: [],
      }),
    ]);
    assert.equal(countPosted(store, new Date("2026-03-10T00:00:00.000Z")).total, 1);
    const days = postsPerDay(store, 7, new Date("2026-03-10T12:00:00.000Z"));
    const hit = days.find((d) => d.count > 0);
    assert.ok(hit);
  });
});
