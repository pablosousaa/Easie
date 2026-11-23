/**
 * Dialect-aware SQL helpers (`?` placeholders).
 * Postgres (Neon) via neon SQL; local SQLite via node:sqlite.
 */
import { neon } from "@neondatabase/serverless";
import { getSqlite } from "./sqlite";
import { toPgParams, usePostgres } from "./dialect";

const globalForNeon = globalThis as unknown as {
  easieNeonSql?: ReturnType<typeof neon>;
  easieNeonUrl?: string;
};

function getNeonSql() {
  const url = process.env.DATABASE_URL!.trim();
  if (!globalForNeon.easieNeonSql || globalForNeon.easieNeonUrl !== url) {
    globalForNeon.easieNeonSql = neon(url);
    globalForNeon.easieNeonUrl = url;
  }
  return globalForNeon.easieNeonSql;
}

export async function sqlAll<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (usePostgres()) {
    const neonSql = getNeonSql();
    const rows = await neonSql.query(toPgParams(text), params);
    return rows as T[];
  }
  const stmt = getSqlite().prepare(text);
  return stmt.all(...(params as never[])) as T[];
}

export async function sqlGet<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await sqlAll<T>(text, params);
  return rows[0];
}

export async function sqlRun(
  text: string,
  params: unknown[] = [],
): Promise<void> {
  if (usePostgres()) {
    const neonSql = getNeonSql();
    await neonSql.query(toPgParams(text), params);
    return;
  }
  getSqlite().prepare(text).run(...(params as never[]));
}

export async function sqlExec(text: string): Promise<void> {
  if (usePostgres()) {
    const neonSql = getNeonSql();
    // neon.query can run one statement; split on semicolons carefully is fragile —
    // callers should use ensurePgSchema for DDL.
    await neonSql.query(text);
    return;
  }
  getSqlite().exec(text);
}
