/**
 * Drizzle schema (Postgres / Neon).
 * Local SQLite keeps a compatible table layout via src/lib/db/sqlite.ts.
 */
import {
  integer,
  pgTable,
  real,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    repostWindowDays: integer("repost_window_days").notNull().default(7),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_username_uidx").on(t.username)],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    affiliateLink: text("affiliate_link").notNull(),
    name: text("name").notNull(),
    price: text("price").notNull(),
    originalPrice: text("original_price").notNull().default(""),
    freeShipping: integer("free_shipping").notNull().default(0),
    fastDelivery: integer("fast_delivery").notNull().default(0),
    status: text("status").notNull().default("draft"),
    queueOrder: integer("queue_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
    clicks: integer("clicks").notNull().default(0),
    sales: integer("sales").notNull().default(0),
    commission: text("commission").notNull().default(""),
    category: text("category").notNull().default(""),
  },
  (t) => [index("products_user_idx").on(t.userId)],
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
    category: text("category").notNull().default(""),
  },
  (t) => [index("templates_user_idx").on(t.userId)],
);

export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    link: text("link").notNull(),
    theme: text("theme").notNull().default(""),
    rules: text("rules").notNull().default(""),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("groups_user_idx").on(t.userId)],
);

export const postings = pgTable(
  "postings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    variationText: text("variation_text").notNull().default(""),
    variationIndex: integer("variation_index").notNull().default(0),
    postedAt: text("posted_at"),
    /** JSON array of ISO timestamps — append-only Relatórios history. */
    postedHistory: text("posted_history").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("postings_user_idx").on(t.userId),
    index("postings_product_idx").on(t.productId),
    index("postings_group_idx").on(t.groupId),
  ],
);

export const trendingCategories = pgTable("trending_categories", {
  id: text("id").primaryKey(),
  mlCategoryId: text("ml_category_id").notNull().unique(),
  name: text("name").notNull(),
  enabled: integer("enabled").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const trendingItems = pgTable(
  "trending_items",
  {
    id: text("id").primaryKey(),
    mlItemId: text("ml_item_id").notNull(),
    name: text("name").notNull(),
    thumbnail: text("thumbnail").notNull().default(""),
    price: real("price").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    categoryId: text("category_id").notNull(),
    categoryName: text("category_name").notNull().default(""),
    rank: integer("rank").notNull().default(0),
    permalink: text("permalink").notNull().default(""),
    freeShipping: integer("free_shipping").notNull().default(0),
    weekKey: text("week_key").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("trending_items_week_idx").on(t.weekKey),
    index("trending_items_cat_idx").on(t.categoryId),
  ],
);

export const trendingMeta = pgTable("trending_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const userTrendingPrefs = pgTable("user_trending_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  takenIds: text("taken_ids").notNull().default("[]"),
  hiddenIds: text("hidden_ids").notNull().default("[]"),
});

export const schema = {
  users,
  products,
  templates,
  groups,
  postings,
  trendingCategories,
  trendingItems,
  trendingMeta,
  userTrendingPrefs,
};
