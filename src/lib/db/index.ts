import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as {
  easieSqlite?: DatabaseSync;
};

function resolveDbPath(): string {
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    return process.env.DATABASE_URL.replace(/^file:/, "");
  }
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  return path.join(process.cwd(), "data", "easie.db");
}

function ensureSchema(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      repost_window_days INTEGER NOT NULL DEFAULT 7,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      affiliate_link TEXT NOT NULL,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      free_shipping INTEGER NOT NULL DEFAULT 0,
      fast_delivery INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      queue_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      clicks INTEGER NOT NULL DEFAULT 0,
      sales INTEGER NOT NULL DEFAULT 0,
      commission TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS templates_user_idx ON templates(user_id);

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      link TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT '',
      rules TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS groups_user_idx ON groups(user_id);

    CREATE TABLE IF NOT EXISTS postings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      variation_text TEXT NOT NULL DEFAULT '',
      variation_index INTEGER NOT NULL DEFAULT 0,
      posted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS postings_user_idx ON postings(user_id);
    CREATE INDEX IF NOT EXISTS postings_product_idx ON postings(product_id);
    CREATE INDEX IF NOT EXISTS postings_group_idx ON postings(group_id);

    CREATE TABLE IF NOT EXISTS trending_categories (
      id TEXT PRIMARY KEY NOT NULL,
      ml_category_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trending_items (
      id TEXT PRIMARY KEY NOT NULL,
      ml_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      thumbnail TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL DEFAULT '',
      rank INTEGER NOT NULL DEFAULT 0,
      permalink TEXT NOT NULL DEFAULT '',
      free_shipping INTEGER NOT NULL DEFAULT 0,
      week_key TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS trending_items_week_idx ON trending_items(week_key);
    CREATE INDEX IF NOT EXISTS trending_items_cat_idx ON trending_items(category_id);

    CREATE TABLE IF NOT EXISTS trending_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_trending_prefs (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      taken_ids TEXT NOT NULL DEFAULT '[]',
      hidden_ids TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

function migrateSchema(sqlite: DatabaseSync) {
  const cols = sqlite
    .prepare("PRAGMA table_info(products)")
    .all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("clicks")) {
    sqlite.exec("ALTER TABLE products ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.has("sales")) {
    sqlite.exec("ALTER TABLE products ADD COLUMN sales INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.has("commission")) {
    sqlite.exec("ALTER TABLE products ADD COLUMN commission TEXT NOT NULL DEFAULT ''");
  }
}

export function getSqlite(): DatabaseSync {
  if (!globalForDb.easieSqlite) {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new DatabaseSync(dbPath);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    sqlite.exec("PRAGMA foreign_keys = ON;");
    ensureSchema(sqlite);
    migrateSchema(sqlite);
    globalForDb.easieSqlite = sqlite;
  }
  return globalForDb.easieSqlite;
}

/** @deprecated Prefer getSqlite(); kept for call-site clarity. */
export function getDb(): DatabaseSync {
  return getSqlite();
}
