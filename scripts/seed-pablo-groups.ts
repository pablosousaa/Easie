/**
 * Clone Facebook groups from user `pablosousa` onto every other account.
 * Idempotent: matches by normalized link; never removes custom groups.
 *
 * Usage:
 *   npm run groups:clone-pablo
 *
 * Env: DATABASE_URL (Postgres / Neon on Vercel) or local SQLite
 *      (DATABASE_PATH / default ./data/easie.db).
 * Do not pass secrets on argv; use the shell/Vercel env already configured.
 */

import {
  GROUP_SOURCE_USERNAME,
  cloneGroupsFromSourceForAllUsers,
} from "../src/lib/user-data";
import { ensureDbReady, usePostgres } from "../src/lib/db";

async function main() {
  await ensureDbReady();
  console.log(
    usePostgres()
      ? "DB: Postgres (DATABASE_URL)"
      : "DB: SQLite local (DATABASE_PATH / default ./data/easie.db)",
  );
  console.log(`Fonte: username "${GROUP_SOURCE_USERNAME}"`);

  const result = await cloneGroupsFromSourceForAllUsers();
  if (result.sourceMissing) {
    console.error(
      `Erro: usuário fonte "${GROUP_SOURCE_USERNAME}" não encontrado.`,
    );
    process.exit(1);
  }

  console.log(
    `Fonte tem ${result.sourceGroups} grupo(s). Alvos: ${result.targets} conta(s).`,
  );
  console.log(
    `Pronto: ${result.inserted} inserido(s), ${result.updated} atualizado(s), ${result.skipped} sem mudança.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
