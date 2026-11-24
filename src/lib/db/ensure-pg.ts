import { neon } from "@neondatabase/serverless";
import { usePostgres } from "./dialect";
import { getSqlite } from "./sqlite";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  repost_window_days INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT ''
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx ON users(username)`,
  `CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_link TEXT NOT NULL,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  free_shipping INTEGER NOT NULL DEFAULT 0,
  fast_delivery INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  queue_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  commission TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  original_price TEXT NOT NULL DEFAULT ''
)`,
  `CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id)`,
  // Additive migrate for existing Neon DBs created before original_price
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price TEXT NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT ''
)`,
  `CREATE INDEX IF NOT EXISTS templates_user_idx ON templates(user_id)`,
  `CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  link TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT ''
)`,
  `CREATE INDEX IF NOT EXISTS groups_user_idx ON groups(user_id)`,
  `CREATE TABLE IF NOT EXISTS postings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  variation_text TEXT NOT NULL DEFAULT '',
  variation_index INTEGER NOT NULL DEFAULT 0,
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT ''
)`,
  `CREATE INDEX IF NOT EXISTS postings_user_idx ON postings(user_id)`,
  `CREATE INDEX IF NOT EXISTS postings_product_idx ON postings(product_id)`,
  `CREATE INDEX IF NOT EXISTS postings_group_idx ON postings(group_id)`,
  `CREATE TABLE IF NOT EXISTS trending_categories (
  id TEXT PRIMARY KEY NOT NULL,
  ml_category_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS trending_items (
  id TEXT PRIMARY KEY NOT NULL,
  ml_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  thumbnail TEXT NOT NULL DEFAULT '',
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT '',
  rank INTEGER NOT NULL DEFAULT 0,
  permalink TEXT NOT NULL DEFAULT '',
  free_shipping INTEGER NOT NULL DEFAULT 0,
  week_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS trending_items_week_idx ON trending_items(week_key)`,
  `CREATE INDEX IF NOT EXISTS trending_items_cat_idx ON trending_items(category_id)`,
  `CREATE TABLE IF NOT EXISTS trending_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS user_trending_prefs (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_ids TEXT NOT NULL DEFAULT '[]',
  hidden_ids TEXT NOT NULL DEFAULT '[]'
)`,
];

/** Idempotent DDL for Postgres (Neon). Safe to call on every cold start. */
export async function ensurePgSchema(): Promise<void> {
  if (!usePostgres()) return;
  const sql = neon(process.env.DATABASE_URL!.trim());
  for (const stmt of STATEMENTS) {
    await sql.query(stmt);
  }
}

let pgReady: Promise<void> | null = null;

/** Ensure Postgres schema once per process (no-op for SQLite). */
export function ensureDbReady(): Promise<void> {
  if (!usePostgres()) {
    getSqlite();
    return Promise.resolve();
  }
  if (!pgReady) pgReady = ensurePgSchema();
  return pgReady;
}
