import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema";
import { usePostgres } from "./dialect";

export type PgDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForPg = globalThis as unknown as {
  easiePg?: PgDb;
  easiePgUrl?: string;
};

/** Drizzle client for Postgres / Neon. Throws if DATABASE_URL is not postgres. */
export function getPgDb(): PgDb {
  if (!usePostgres()) {
    throw new Error(
      "getPgDb() requires DATABASE_URL=postgres://… (or postgresql://…)",
    );
  }
  const url = process.env.DATABASE_URL!.trim();
  if (!globalForPg.easiePg || globalForPg.easiePgUrl !== url) {
    const sql = neon(url);
    globalForPg.easiePg = drizzle(sql, { schema });
    globalForPg.easiePgUrl = url;
  }
  return globalForPg.easiePg;
}
