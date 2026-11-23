import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createId } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { migrateLocalData, seedDefaultTemplate } from "@/lib/user-data";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(120),
  migrate: z
    .object({
      products: z.array(z.any()).optional(),
      templates: z.array(z.any()).optional(),
      groups: z.array(z.any()).optional(),
      postings: z.array(z.any()).optional(),
      lastProduct: z.any().nullable().optional(),
      settings: z
        .object({ repostWindowDays: z.number().int().positive().optional() })
        .optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos. Confira nome, e-mail e senha (mín. 6)." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail." },
      { status: 409 },
    );
  }

  const id = createId("usr");
  const passwordHash = await hashPassword(parsed.data.password);
  db.insert(users)
    .values({
      id,
      name: parsed.data.name,
      email,
      passwordHash,
      repostWindowDays: parsed.data.migrate?.settings?.repostWindowDays ?? 7,
    })
    .run();

  seedDefaultTemplate(id);
  if (parsed.data.migrate) {
    migrateLocalData(id, {
      ...parsed.data.migrate,
      settings: parsed.data.migrate.settings?.repostWindowDays
        ? { repostWindowDays: parsed.data.migrate.settings.repostWindowDays }
        : undefined,
    });
  }

  const token = await createSessionToken({
    sub: id,
    email,
    name: parsed.data.name,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id,
      name: parsed.data.name,
      email,
      repostWindowDays: parsed.data.migrate?.settings?.repostWindowDays ?? 7,
    },
  });
}
