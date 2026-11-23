import { NextResponse } from "next/server";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/user-data";

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await deleteUserAccount(user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
