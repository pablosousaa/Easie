import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for Postgres / Neon.
 * Set DATABASE_URL=postgres://… then: npm run db:push
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
