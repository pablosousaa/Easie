/**
 * Create an Easie user manually (no public signup).
 *
 * Usage:
 *   npm run user:create -- --name "Pablo" --email pablo@example.com --password 'senha-segura'
 *
 * Env:
 *   DATABASE_PATH / DATABASE_URL — same as the app (default ./data/easie.db)
 */

import { createId } from "../src/lib/ids";
import { hashPassword } from "../src/lib/password";
import {
  findUserByEmail,
  insertUser,
  seedDefaultTemplate,
} from "../src/lib/user-data";

function usage(): never {
  console.error(`Usage:
  npm run user:create -- --name "Nome" --email user@example.com --password 'min-6-chars'

Options:
  --name, -n       Display name (min 2)
  --email, -e      E-mail (unique)
  --password, -p   Password (min 6)
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
  const emailRaw = argValue(argv, ["--email", "-e"])?.trim();
  const password = argValue(argv, ["--password", "-p"]);

  if (!name || name.length < 2) {
    console.error("Erro: --name obrigatório (mín. 2 caracteres).");
    usage();
  }
  if (!emailRaw || !emailRaw.includes("@")) {
    console.error("Erro: --email obrigatório e válido.");
    usage();
  }
  if (!password || password.length < 6) {
    console.error("Erro: --password obrigatório (mín. 6 caracteres).");
    usage();
  }

  const email = emailRaw.toLowerCase();
  const existing = findUserByEmail(email);
  if (existing) {
    console.error(`Erro: já existe usuário com e-mail ${email} (id ${existing.id}).`);
    process.exit(1);
  }

  const id = createId("usr");
  const passwordHash = await hashPassword(password);
  insertUser({ id, name, email, passwordHash, repostWindowDays: 7 });
  seedDefaultTemplate(id);

  console.log("Usuário criado:");
  console.log(`  id:    ${id}`);
  console.log(`  name:  ${name}`);
  console.log(`  email: ${email}`);
  console.log("Entre em /conta com este e-mail e senha.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
