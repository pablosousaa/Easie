/**
 * Create an Easie user manually (no public signup).
 *
 * Usage:
 *   npm run user:create -- --name "Pablo" --username pablo --password 'senha-segura'
 *
 * Env:
 *   DATABASE_URL=postgres://…   (Neon / Vercel Postgres — production)
 *   or DATABASE_PATH / file:…   (local SQLite, default ./data/easie.db)
 */

import { createId } from "../src/lib/ids";
import { hashPassword } from "../src/lib/password";
import {
  GROUP_SOURCE_USERNAME,
  cloneGroupsFromUsername,
  findUserByUsername,
  insertUser,
  seedDefaultTemplate,
  seedSharedGroups,
} from "../src/lib/user-data";
import { isValidUsername, normalizeUsername } from "../src/lib/username";
import { ensureDbReady, usePostgres } from "../src/lib/db";

function usage(): never {
  console.error(`Usage:
  npm run user:create -- --name "Nome" --username pablo --password 'min-6-chars'

Options:
  --name, -n         Display name (min 2)
  --username, -u     Login username (unique, a-z 0-9 . _ -)
  --password, -p     Password (min 6)
`);
  process.exit(1);
}

function argValue(argv: string[], names: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (names.includes(a) && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      return argv[i + 1];
    }
    for (const name of names) {
      if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
    }
  }
  return undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) usage();

  const name = argValue(argv, ["--name", "-n"])?.trim();
  const usernameRaw = argValue(argv, ["--username", "-u"])?.trim();
  const password = argValue(argv, ["--password", "-p"]);

  if (!name || name.length < 2) {
    console.error("Erro: --name obrigatório (mín. 2 caracteres).");
    usage();
  }
  if (!usernameRaw) {
    console.error("Erro: --username obrigatório.");
    usage();
  }
  if (!password || password.length < 6) {
    console.error("Erro: --password obrigatório (mín. 6 caracteres).");
    usage();
  }

  const username = normalizeUsername(usernameRaw);
  if (!isValidUsername(username)) {
    console.error(
      "Erro: username inválido. Use 2–32 chars: letras, números, . _ - (começa com letra ou número).",
    );
    process.exit(1);
  }

  await ensureDbReady();
  console.log(
    usePostgres()
      ? "DB: Postgres (DATABASE_URL)"
      : "DB: SQLite local (DATABASE_PATH / default ./data/easie.db)",
  );

  const existing = await findUserByUsername(username);
  if (existing) {
    console.error(
      `Erro: já existe usuário com username "${username}" (id ${existing.id}).`,
    );
    process.exit(1);
  }

  const id = createId("usr");
  const passwordHash = await hashPassword(password);
  await insertUser({ id, name, username, passwordHash, repostWindowDays: 7 });
  await seedDefaultTemplate(id);
  await seedSharedGroups(id);
  await cloneGroupsFromUsername(GROUP_SOURCE_USERNAME, id);

  console.log("Usuário criado:");
  console.log(`  id:       ${id}`);
  console.log(`  name:     ${name}`);
  console.log(`  username: ${username}`);
  console.log("Entre em /conta com este usuário e senha.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
