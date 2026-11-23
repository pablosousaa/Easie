import { ensureDbReady, sqlAll, sqlGet, sqlRun } from "./db";
import type {
  GroupRow,
  PostingRow,
  ProductRow,
  TemplateRow,
  UserRow,
} from "./db/types";
import { createAdTemplates } from "./templates";
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

function mapUserRow(row: UserRow | undefined): UserRow | undefined {
  if (!row) return undefined;
  return {
    ...row,
    username: row.username || "",
    email: row.email ?? "",
  };
}

async function ready() {
  await ensureDbReady();
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  await ready();
  return mapUserRow(
    await sqlGet<UserRow>("SELECT * FROM users WHERE id = ?", [id]),
  );
}

export async function findUserByUsername(
  username: string,
): Promise<UserRow | undefined> {
  await ready();
  return mapUserRow(
    await sqlGet<UserRow>(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
      [username],
    ),
  );
}

/** @deprecated Prefer findUserByUsername. */
export async function findUserByEmail(
  email: string,
): Promise<UserRow | undefined> {
  await ready();
  return mapUserRow(
    await sqlGet<UserRow>("SELECT * FROM users WHERE email = ?", [email]),
  );
}

export async function insertUser(input: {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  email?: string;
  repostWindowDays?: number;
}): Promise<void> {
  await ready();
  const email = input.email?.trim() || `${input.username}@users.local`;
  await sqlRun(
    `INSERT INTO users (id, name, username, email, password_hash, repost_window_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.name,
      input.username,
      email,
      input.passwordHash,
      input.repostWindowDays ?? 7,
      nowIso(),
    ],
  );
}

export async function seedDefaultTemplate(userId: string): Promise<void> {
  await ready();
  const existing = await sqlGet<{ id: string }>(
    "SELECT id FROM templates WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (existing) return;

  const templates = createAdTemplates(() => createId("tpl"));
  for (const tpl of templates) {
    await sqlRun(
      `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tpl.id,
        userId,
        tpl.name,
        tpl.content,
        tpl.isDefault ? 1 : 0,
        nowIso(),
        tpl.category ?? "",
      ],
    );
  }
}

export async function loadUserStore(userId: string): Promise<EasieStore> {
  await ready();
  const user = await findUserById(userId);
  const productRows = await sqlAll<ProductRow>(
    `SELECT * FROM products WHERE user_id = ?
     ORDER BY queue_order ASC, created_at ASC`,
    [userId],
  );
  const templateRows = await sqlAll<TemplateRow>(
    "SELECT * FROM templates WHERE user_id = ?",
    [userId],
  );
  const groupRows = await sqlAll<GroupRow>(
    `SELECT * FROM groups WHERE user_id = ? ORDER BY created_at ASC`,
    [userId],
  );
  const postingRows = await sqlAll<PostingRow>(
    "SELECT * FROM postings WHERE user_id = ?",
    [userId],
  );

  const mappedTemplates =
    templateRows.length > 0
      ? templateRows.map(mapTemplate)
      : createAdTemplates();

  const prefs = await sqlGet<{ taken_ids: string; hidden_ids: string }>(
    "SELECT taken_ids, hidden_ids FROM user_trending_prefs WHERE user_id = ?",
    [userId],
  );

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

export async function migrateLocalData(
  userId: string,
  payload: MigratePayload,
): Promise<void> {
  await ready();

  if (payload.settings?.repostWindowDays) {
    await sqlRun("UPDATE users SET repost_window_days = ? WHERE id = ?", [
      Math.max(1, payload.settings.repostWindowDays),
      userId,
    ]);
  }

  const existingTemplates = await sqlAll<{ id: string }>(
    "SELECT id FROM templates WHERE user_id = ?",
    [userId],
  );

  if (
    payload.templates &&
    payload.templates.length > 0 &&
    existingTemplates.length <= 1
  ) {
    await sqlRun("DELETE FROM templates WHERE user_id = ?", [userId]);
    for (const tpl of payload.templates) {
      await sqlRun(
        `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tpl.id || createId("tpl"),
          userId,
          tpl.name,
          tpl.content,
          tpl.isDefault ? 1 : 0,
          tpl.updatedAt || nowIso(),
          tpl.category ?? "",
        ],
      );
    }
    const after = await sqlAll<{ id: string; is_default: number }>(
      "SELECT id, is_default FROM templates WHERE user_id = ?",
      [userId],
    );
    if (after.length > 0 && !after.some((t) => t.is_default)) {
      await sqlRun("UPDATE templates SET is_default = 1 WHERE id = ?", [
        after[0].id,
      ]);
    }
  }

  if (payload.groups) {
    for (const g of payload.groups) {
      const id = g.id || createId("grp");
      const exists = await sqlGet<{ id: string }>(
        "SELECT id FROM groups WHERE id = ?",
        [id],
      );
      if (exists) continue;
      await sqlRun(
        `INSERT INTO groups (id, user_id, name, link, theme, rules, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          g.name,
          g.link,
          g.theme ?? "",
          g.rules ?? "",
          g.active !== false ? 1 : 0,
          g.createdAt || nowIso(),
        ],
      );
    }
  }

  if (payload.products) {
    for (const p of payload.products) {
      const id = p.id || createId("prd");
      const exists = await sqlGet<{ id: string }>(
        "SELECT id FROM products WHERE id = ?",
        [id],
      );
      if (exists) continue;
      await sqlRun(
        `INSERT INTO products (
           id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
           status, queue_order, created_at, completed_at, clicks, sales, commission, category
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
    }
  }

  if (payload.postings) {
    for (const post of payload.postings) {
      const id = post.id || createId("pst");
      const exists = await sqlGet<{ id: string }>(
        "SELECT id FROM postings WHERE id = ?",
        [id],
      );
      if (exists) continue;
      await sqlRun(
        `INSERT INTO postings (
           id, user_id, product_id, group_id, status, variation_text,
           variation_index, posted_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          post.productId,
          post.groupId,
          post.status,
          post.variationText ?? "",
          post.variationIndex ?? 0,
          post.postedAt,
          post.createdAt || nowIso(),
        ],
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
    await sqlRun(
      `INSERT INTO products (
         id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
         status, queue_order, created_at, completed_at, clicks, sales, commission, category
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, NULL, 0, 0, '', ?)`,
      [
        createId("prd"),
        userId,
        lp.affiliateLink,
        lp.name,
        lp.price,
        lp.freeShipping ? 1 : 0,
        lp.fastDelivery ? 1 : 0,
        nowIso(),
        lp.category ?? "",
      ],
    );
  }
}

export async function replaceUserStore(
  userId: string,
  store: EasieStore,
): Promise<void> {
  await ready();

  await sqlRun("UPDATE users SET repost_window_days = ? WHERE id = ?", [
    Math.max(1, store.settings.repostWindowDays || 7),
    userId,
  ]);

  await sqlRun(
    `INSERT INTO user_trending_prefs (user_id, taken_ids, hidden_ids)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       taken_ids = excluded.taken_ids,
       hidden_ids = excluded.hidden_ids`,
    [
      userId,
      JSON.stringify(store.trendingTakenIds ?? []),
      JSON.stringify(store.trendingHiddenIds ?? []),
    ],
  );

  await sqlRun("DELETE FROM postings WHERE user_id = ?", [userId]);
  await sqlRun("DELETE FROM products WHERE user_id = ?", [userId]);
  await sqlRun("DELETE FROM groups WHERE user_id = ?", [userId]);
  await sqlRun("DELETE FROM templates WHERE user_id = ?", [userId]);

  for (const tpl of store.templates) {
    await sqlRun(
      `INSERT INTO templates (id, user_id, name, content, is_default, updated_at, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tpl.id,
        userId,
        tpl.name,
        tpl.content,
        tpl.isDefault ? 1 : 0,
        tpl.updatedAt || nowIso(),
        tpl.category ?? "",
      ],
    );
  }
  if (store.templates.length === 0) {
    await seedDefaultTemplate(userId);
  }

  for (const g of store.groups) {
    await sqlRun(
      `INSERT INTO groups (id, user_id, name, link, theme, rules, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.id,
        userId,
        g.name,
        g.link,
        g.theme,
        g.rules,
        g.active ? 1 : 0,
        g.createdAt || nowIso(),
      ],
    );
  }

  for (const p of store.products) {
    await sqlRun(
      `INSERT INTO products (
         id, user_id, affiliate_link, name, price, free_shipping, fast_delivery,
         status, queue_order, created_at, completed_at, clicks, sales, commission, category
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
  }

  for (const post of store.postings) {
    await sqlRun(
      `INSERT INTO postings (
         id, user_id, product_id, group_id, status, variation_text,
         variation_index, posted_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        post.id,
        userId,
        post.productId,
        post.groupId,
        post.status,
        post.variationText,
        post.variationIndex,
        post.postedAt,
        post.createdAt || nowIso(),
      ],
    );
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await ready();
  await sqlRun("DELETE FROM users WHERE id = ?", [userId]);
}
