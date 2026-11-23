import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  repostWindowDays: integer("repost_window_days").notNull().default(7),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    affiliateLink: text("affiliate_link").notNull(),
    name: text("name").notNull(),
    price: text("price").notNull(),
    freeShipping: integer("free_shipping", { mode: "boolean" })
      .notNull()
      .default(false),
    fastDelivery: integer("fast_delivery", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", {
      enum: ["draft", "queued", "active", "done", "archived"],
    })
      .notNull()
      .default("draft"),
    queueOrder: integer("queue_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (t) => [index("products_user_idx").on(t.userId)],
);

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("templates_user_idx").on(t.userId)],
);

export const groups = sqliteTable(
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
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("groups_user_idx").on(t.userId)],
);

export const postings = sqliteTable(
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
    status: text("status", {
      enum: ["pending", "posted", "ignored"],
    })
      .notNull()
      .default("pending"),
    variationText: text("variation_text").notNull().default(""),
    variationIndex: integer("variation_index").notNull().default(0),
    postedAt: text("posted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("postings_user_idx").on(t.userId),
    index("postings_product_idx").on(t.productId),
    index("postings_group_idx").on(t.groupId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  templates: many(templates),
  groups: many(groups),
  postings: many(postings),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  postings: many(postings),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  user: one(users, { fields: [groups.userId], references: [users.id] }),
  postings: many(postings),
}));

export const postingsRelations = relations(postings, ({ one }) => ({
  user: one(users, { fields: [postings.userId], references: [users.id] }),
  product: one(products, {
    fields: [postings.productId],
    references: [products.id],
  }),
  group: one(groups, { fields: [postings.groupId], references: [groups.id] }),
}));
