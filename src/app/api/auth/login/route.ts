import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { findUserByUsername } from "@/lib/user-data";
import { isValidUsername, normalizeUsername } from "@/lib/username";

const bodySchema = z.object({
  username: z.string().trim().min(2).max(32),
  password: z.string().min(1),
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
      { error: "Usuário ou senha inválidos." },
      { status: 400 },
    );
  }

  const username = normalizeUsername(parsed.data.username);
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Usuário ou senha inválidos." },
      { status: 400 },
    );
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return NextResponse.json(
      { error: "Usuário ou senha incorretos." },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "Usuário ou senha incorretos." },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    username: user.username,
    name: user.name,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      repostWindowDays: user.repost_window_days,
    },
  });
}
