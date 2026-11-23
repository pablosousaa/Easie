/**
 * Seed the shared FC Facebook group catalog into every account.
 * Idempotent: matches by normalized link; never removes custom groups.
 *
 * Usage:
 *   npm run groups:seed
 *
 * Env: DATABASE_URL (Postgres) or local SQLite (DATABASE_PATH / default).
 */

import { fcGroupCount } from "../src/lib/fc-groups";
import { seedSharedGroupsForAllUsers } from "../src/lib/user-data";
import { ensureDbReady, usePostgres } from "../src/lib/db";

async function main() {
  await ensureDbReady();
  console.log(
    usePostgres()
      ? "DB: Postgres (DATABASE_URL)"
      : "DB: SQLite local (DATABASE_PATH / default ./data/easie.db)",
  );
  console.log(`Catálogo FC: ${fcGroupCount()} grupos`);

  const result = await seedSharedGroupsForAllUsers();
  console.log(
    `Pronto: ${result.users} conta(s), ${result.inserted} inserido(s), ${result.skipped} já existia(m).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
