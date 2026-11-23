import { NextResponse } from "next/server";
import { getSession, isUsingDevAuthSecret } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      user: null,
      authMode: isUsingDevAuthSecret() ? "dev" : "secure",
    });
  }

  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, session.sub)).get();
  if (!user) {
    return NextResponse.json({
      user: null,
      authMode: isUsingDevAuthSecret() ? "dev" : "secure",
    });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      repostWindowDays: user.repostWindowDays,
    },
    authMode: isUsingDevAuthSecret() ? "dev" : "secure",
  });
}
