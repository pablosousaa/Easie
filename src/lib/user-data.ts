import { getSqlite } from "./db";
import type {
  GroupRow,
  PostingRow,
  ProductRow,
  TemplateRow,
  UserRow,
} from "./db/types";
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

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    affiliateLink: row.affiliate_link,
    name: row.name,
    price: row.price,
    freeShipping: Boolean(row.free_shipping),
    fastDelivery: Boolean(row.fast_delivery),
    category: row.category ?? "",
    status: row.status,
    queueOrder: row.queue_order,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    clicks: row.clicks ?? 0,
    sales: row.sales ?? 0,
    commission: row.commission ?? "",
  };
}

function mapGroup(row: GroupRow): FacebookGroup {
  return {
    id: row.id,
    name: row.name,
    link: row.link,
    theme: row.theme,
    rules: row.rules,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

function mapTemplate(row: TemplateRow): TextTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
    category: row.category ?? "",
  };
}

function mapPosting(row: PostingRow): Posting {
  return {
    id: row.id,
    productId: row.product_id,
    groupId: row.group_id,
    status: row.status,
    variationText: row.variation_text,
    variationIndex: row.variation_index,
    postedAt: row.posted_at,
    createdAt: row.created_at,
  };
}

export function findUserById(id: string): UserRow | undefined {
  const db = getSqlite();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

export function findUserByEmail(email: string): UserRow | undefined {
  const db = getSqlite();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserRow
    | undefined;
}

export function insertUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  repostWindowDays?: number;
}) {
  const db = getSqlite();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, repost_window_days)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.name,
    input.email,
    input.passwordHash,
    input.repostWindowDays ?? 7,
  );
}

export function seedDefaultTemplate(userId: string) {
  const db = getSqlite();
  const existing = db
    .prepare("SELECT id FROM templates WHERE user_id = ? LIMIT 1")
    .get(userId);
  if (existing) return;
  const tpl = createDefaultTemplate(createId("tpl"));
  db.prepare(
    `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
  ).run(tpl.id, userId, tpl.name, tpl.content, nowIso(), tpl.category ?? "");
}

export function loadUserStore(userId: string): EasieStore {
  const db = getSqlite();
  const user = findUserById(userId);
  const productRows = db
    .prepare(
      `SELECT * FROM products WHERE user_id = ?
       ORDER BY queue_order ASC, created_at ASC`,
    )
    .all(userId) as ProductRow[];
  const templateRows = db
    .prepare("SELECT * FROM templates WHERE user_id = ?")
    .all(userId) as TemplateRow[];
  const groupRows = db
    .prepare(
      `SELECT * FROM groups WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .all(userId) as GroupRow[];
  const postingRows = db
    .prepare("SELECT * FROM postings WHERE user_id = ?")
    .all(userId) as PostingRow[];

  const mappedTemplates =
    templateRows.length > 0
      ? templateRows.map(mapTemplate)
      : [createDefaultTemplate()];

  const prefs = db
    .prepare("SELECT taken_ids, hidden_ids FROM user_trending_prefs WHERE user_id = ?")
    .get(userId) as { taken_ids: string; hidden_ids: string } | undefined;

  function parseIds(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }

  return {
    products: productRows.map(mapProduct),
    lastProduct: null,
    templates: mappedTemplates,
    variations: [],
    groups: groupRows.map(mapGroup),
    postings: postingRows.map(mapPosting),
    settings: {
      repostWindowDays: user?.repost_window_days ?? 7,
    },
    trendingTakenIds: parseIds(prefs?.taken_ids),
    trendingHiddenIds: parseIds(prefs?.hidden_ids),
  };
}

export function migrateLocalData(userId: string, payload: MigratePayload) {
  const db = getSqlite();

  if (payload.settings?.repostWindowDays) {
    db.prepare("UPDATE users SET repost_window_days = ? WHERE id = ?").run(
      Math.max(1, payload.settings.repostWindowDays),
      userId,
    );
  }

  const existingTemplates = db
    .prepare("SELECT id FROM templates WHERE user_id = ?")
    .all(userId) as Array<{ id: string }>;

  if (
    payload.templates &&
    payload.templates.length > 0 &&
    existingTemplates.length <= 1
  ) {
    db.prepare("DELETE FROM templates WHERE user_id = ?").run(userId);
    for (const tpl of payload.templates) {
      db.prepare(
        `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        tpl.id || createId("tpl"),
        userId,
        tpl.name,
        tpl.content,
        tpl.isDefault ? 1 : 0,
        tpl.updatedAt || nowIso(),
        tpl.category ?? "",
      );
    }
    const after = db
      .prepare("SELECT id, is_default FROM templates WHERE user_id = ?")
      .all(userId) as Array<{ id: string; is_default: number }>;
    if (after.length > 0 && !after.some((t) => t.is_default)) {
      db.prepare("UPDATE templates SET is_default = 1 WHERE id = ?").run(
        after[0].id,
      );
    }
  }

  if (payload.groups) {
    for (const g of payload.groups) {
      const id = g.id || createId("grp");
      const exists = db.prepare("SELECT id FROM groups WHERE id = ?").get(id);
      if (exists) continue;
      db.prepare(
        `INSERT INTO groups (id, user_id, name, link, theme, rules, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        userId,
        g.name,
        g.link,
        g.theme ?? "",
        g.rules ?? "",
        g.active !== false ? 1 : 0,
        g.createdAt || nowIso(),
      );
    }
  }

  if (payload.products) {
    for (const p of payload.products) {
      const id = p.id || createId("prd");
      const exists = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
      if (exists) continue;
      db.prepare(
        `INSERT INTO products (
           id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
           status, queue_order, created_at, completed_at, clicks, sales, commission, category
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        userId,
        p.affiliateLink,
        p.name,
        p.price,
        p.freeShipping ? 1 : 0,
        p.fastDelivery ? 1 : 0,
        p.status ?? "queued",
        p.queueOrder ?? 0,
        p.createdAt || nowIso(),
        p.completedAt ?? null,
        p.clicks ?? 0,
        p.sales ?? 0,
        p.commission ?? "",
        p.category ?? "",
      );
    }
  }

  if (payload.postings) {
    for (const post of payload.postings) {
      const id = post.id || createId("pst");
      const exists = db.prepare("SELECT id FROM postings WHERE id = ?").get(id);
      if (exists) continue;
      db.prepare(
        `INSERT INTO postings (
           id, user_id, product_id, group_id, status, variation_text,
           variation_index, posted_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        userId,
        post.productId,
        post.groupId,
        post.status,
        post.variationText ?? "",
        post.variationIndex ?? 0,
        post.postedAt,
        post.createdAt || nowIso(),
      );
    }
  }

  if (
    payload.lastProduct &&
    (!payload.products || payload.products.length === 0) &&
    payload.lastProduct.name.trim() &&
    payload.lastProduct.affiliateLink.trim()
  ) {
    const lp = payload.lastProduct;
    db.prepare(
      `INSERT INTO products (
         id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
         status, queue_order, created_at, completed_at, clicks, sales, commission, category
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, NULL, 0, 0, '', ?)`,
    ).run(
      createId("prd"),
      userId,
      lp.affiliateLink,
      lp.name,
      lp.price,
      lp.freeShipping ? 1 : 0,
      lp.fastDelivery ? 1 : 0,
      nowIso(),
      lp.category ?? "",
    );
  }
}

export function replaceUserStore(userId: string, store: EasieStore) {
  const db = getSqlite();

  db.prepare("UPDATE users SET repost_window_days = ? WHERE id = ?").run(
    Math.max(1, store.settings.repostWindowDays || 7),
    userId,
  );

  db.prepare(
    `INSERT INTO user_trending_prefs (user_id, taken_ids, hidden_ids)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       taken_ids = excluded.taken_ids,
       hidden_ids = excluded.hidden_ids`,
  ).run(
    userId,
    JSON.stringify(store.trendingTakenIds ?? []),
    JSON.stringify(store.trendingHiddenIds ?? []),
  );

  db.prepare("DELETE FROM postings WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM products WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM groups WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM templates WHERE user_id = ?").run(userId);

  for (const tpl of store.templates) {
    db.prepare(
      `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tpl.id,
      userId,
      tpl.name,
      tpl.content,
      tpl.isDefault ? 1 : 0,
      tpl.updatedAt || nowIso(),
      tpl.category ?? "",
    );
  }
  if (store.templates.length === 0) {
    seedDefaultTemplate(userId);
  }

  for (const g of store.groups) {
    db.prepare(
      `INSERT INTO groups (id, user_id, name, link, theme, rules, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      g.id,
      userId,
      g.name,
      g.link,
      g.theme,
      g.rules,
      g.active ? 1 : 0,
      g.createdAt || nowIso(),
    );
  }

  for (const p of store.products) {
    db.prepare(
      `INSERT INTO products (
         id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
         status, queue_order, created_at, completed_at, clicks, sales, commission, category
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      p.id,
      userId,
      p.affiliateLink,
      p.name,
      p.price,
      p.freeShipping ? 1 : 0,
      p.fastDelivery ? 1 : 0,
      p.status,
      p.queueOrder,
      p.createdAt || nowIso(),
      p.completedAt,
      p.clicks ?? 0,
      p.sales ?? 0,
      p.commission ?? "",
      p.category ?? "",
    );
  }

  for (const post of store.postings) {
    db.prepare(
      `INSERT INTO postings (
         id, user_id, product_id, group_id, status, variation_text,
         variation_index, posted_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      post.id,
      userId,
      post.productId,
      post.groupId,
      post.status,
      post.variationText,
      post.variationIndex,
      post.postedAt,
      post.createdAt || nowIso(),
    );
  }
}

/** Deletes the user row; FK CASCADE removes products, groups, templates, postings. */
export function deleteUserAccount(userId: string) {
  const db = getSqlite();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
