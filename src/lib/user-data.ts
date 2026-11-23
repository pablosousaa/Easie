import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { groups, postings, products, templates, users } from "./db/schema";
import { createDefaultTemplate } from "./templates";
import { createId, nowIso } from "./ids";
import type {
  EasieStore,
  FacebookGroup,
  MigratePayload,
  Posting,
  Product,
  TextTemplate,
} from "./types";

function mapProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    affiliateLink: row.affiliateLink,
    name: row.name,
    price: row.price,
    freeShipping: row.freeShipping,
    fastDelivery: row.fastDelivery,
    status: row.status,
    queueOrder: row.queueOrder,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function mapGroup(row: typeof groups.$inferSelect): FacebookGroup {
  return {
    id: row.id,
    name: row.name,
    link: row.link,
    theme: row.theme,
    rules: row.rules,
    active: row.active,
    createdAt: row.createdAt,
  };
}

function mapTemplate(row: typeof templates.$inferSelect): TextTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    isDefault: row.isDefault,
    updatedAt: row.updatedAt,
  };
}

function mapPosting(row: typeof postings.$inferSelect): Posting {
  return {
    id: row.id,
    productId: row.productId,
    groupId: row.groupId,
    status: row.status,
    variationText: row.variationText,
    variationIndex: row.variationIndex,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
  };
}

export function seedDefaultTemplate(userId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .all();
  if (existing.length > 0) return;
  const tpl = createDefaultTemplate(createId("tpl"));
  db.insert(templates)
    .values({
      id: tpl.id,
      userId,
      name: tpl.name,
      content: tpl.content,
      isDefault: true,
      updatedAt: nowIso(),
    })
    .run();
}

export function loadUserStore(userId: string): EasieStore {
  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  const productRows = db
    .select()
    .from(products)
    .where(eq(products.userId, userId))
    .orderBy(asc(products.queueOrder), asc(products.createdAt))
    .all();
  const templateRows = db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .all();
  const groupRows = db
    .select()
    .from(groups)
    .where(eq(groups.userId, userId))
    .orderBy(asc(groups.createdAt))
    .all();
  const postingRows = db
    .select()
    .from(postings)
    .where(eq(postings.userId, userId))
    .all();

  const mappedTemplates =
    templateRows.length > 0
      ? templateRows.map(mapTemplate)
      : [createDefaultTemplate()];

  return {
    products: productRows.map(mapProduct),
    lastProduct: null,
    templates: mappedTemplates,
    variations: [],
    groups: groupRows.map(mapGroup),
    postings: postingRows.map(mapPosting),
    settings: {
      repostWindowDays: user?.repostWindowDays ?? 7,
    },
  };
}

export function migrateLocalData(userId: string, payload: MigratePayload) {
  const db = getDb();

  if (payload.settings?.repostWindowDays) {
    db.update(users)
      .set({
        repostWindowDays: Math.max(1, payload.settings.repostWindowDays),
      })
      .where(eq(users.id, userId))
      .run();
  }

  const existingTemplates = db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .all();

  if (payload.templates && payload.templates.length > 0 && existingTemplates.length <= 1) {
    // Replace seeded default with migrated templates
    db.delete(templates).where(eq(templates.userId, userId)).run();
    for (const tpl of payload.templates) {
      db.insert(templates)
        .values({
          id: tpl.id || createId("tpl"),
          userId,
          name: tpl.name,
          content: tpl.content,
          isDefault: Boolean(tpl.isDefault),
          updatedAt: tpl.updatedAt || nowIso(),
        })
        .run();
    }
    const after = db
      .select()
      .from(templates)
      .where(eq(templates.userId, userId))
      .all();
    if (after.length > 0 && !after.some((t) => t.isDefault)) {
      db.update(templates)
        .set({ isDefault: true })
        .where(and(eq(templates.userId, userId), eq(templates.id, after[0].id)))
        .run();
    }
  }

  if (payload.groups) {
    for (const g of payload.groups) {
      const id = g.id || createId("grp");
      const exists = db.select().from(groups).where(eq(groups.id, id)).get();
      if (exists) continue;
      db.insert(groups)
        .values({
          id,
          userId,
          name: g.name,
          link: g.link,
          theme: g.theme ?? "",
          rules: g.rules ?? "",
          active: g.active !== false,
          createdAt: g.createdAt || nowIso(),
        })
        .run();
    }
  }

  if (payload.products) {
    for (const p of payload.products) {
      const id = p.id || createId("prd");
      const exists = db.select().from(products).where(eq(products.id, id)).get();
      if (exists) continue;
      db.insert(products)
        .values({
          id,
          userId,
          affiliateLink: p.affiliateLink,
          name: p.name,
          price: p.price,
          freeShipping: Boolean(p.freeShipping),
          fastDelivery: Boolean(p.fastDelivery),
          status: p.status ?? "queued",
          queueOrder: p.queueOrder ?? 0,
          createdAt: p.createdAt || nowIso(),
          completedAt: p.completedAt ?? null,
        })
        .run();
    }
  }

  if (payload.postings) {
    for (const post of payload.postings) {
      const id = post.id || createId("pst");
      const exists = db.select().from(postings).where(eq(postings.id, id)).get();
      if (exists) continue;
      db.insert(postings)
        .values({
          id,
          userId,
          productId: post.productId,
          groupId: post.groupId,
          status: post.status,
          variationText: post.variationText ?? "",
          variationIndex: post.variationIndex ?? 0,
          postedAt: post.postedAt,
          createdAt: post.createdAt || nowIso(),
        })
        .run();
    }
  }

  // If guest only had lastProduct + templates (Fase 1), create a queued product
  if (
    payload.lastProduct &&
    (!payload.products || payload.products.length === 0) &&
    payload.lastProduct.name.trim() &&
    payload.lastProduct.affiliateLink.trim()
  ) {
    const lp = payload.lastProduct;
    db.insert(products)
      .values({
        id: createId("prd"),
        userId,
        affiliateLink: lp.affiliateLink,
        name: lp.name,
        price: lp.price,
        freeShipping: Boolean(lp.freeShipping),
        fastDelivery: Boolean(lp.fastDelivery),
        status: "draft",
        queueOrder: 0,
        createdAt: nowIso(),
        completedAt: null,
      })
      .run();
  }
}

export function replaceUserStore(userId: string, store: EasieStore) {
  const db = getDb();

  db.update(users)
    .set({
      repostWindowDays: Math.max(1, store.settings.repostWindowDays || 7),
    })
    .where(eq(users.id, userId))
    .run();

  db.delete(postings).where(eq(postings.userId, userId)).run();
  db.delete(products).where(eq(products.userId, userId)).run();
  db.delete(groups).where(eq(groups.userId, userId)).run();
  db.delete(templates).where(eq(templates.userId, userId)).run();

  for (const tpl of store.templates) {
    db.insert(templates)
      .values({
        id: tpl.id,
        userId,
        name: tpl.name,
        content: tpl.content,
        isDefault: tpl.isDefault,
        updatedAt: tpl.updatedAt || nowIso(),
      })
      .run();
  }
  if (store.templates.length === 0) {
    seedDefaultTemplate(userId);
  }

  for (const g of store.groups) {
    db.insert(groups)
      .values({
        id: g.id,
        userId,
        name: g.name,
        link: g.link,
        theme: g.theme,
        rules: g.rules,
        active: g.active,
        createdAt: g.createdAt || nowIso(),
      })
      .run();
  }

  for (const p of store.products) {
    db.insert(products)
      .values({
        id: p.id,
        userId,
        affiliateLink: p.affiliateLink,
        name: p.name,
        price: p.price,
        freeShipping: p.freeShipping,
        fastDelivery: p.fastDelivery,
        status: p.status,
        queueOrder: p.queueOrder,
        createdAt: p.createdAt || nowIso(),
        completedAt: p.completedAt,
      })
      .run();
  }

  for (const post of store.postings) {
    db.insert(postings)
      .values({
        id: post.id,
        userId,
        productId: post.productId,
        groupId: post.groupId,
        status: post.status,
        variationText: post.variationText,
        variationIndex: post.variationIndex,
        postedAt: post.postedAt,
        createdAt: post.createdAt || nowIso(),
      })
      .run();
  }
}
