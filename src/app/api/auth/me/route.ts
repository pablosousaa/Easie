import { NextResponse } from "next/server";
import { getSession, isUsingDevAuthSecret } from "@/lib/auth";
import { findUserById } from "@/lib/user-data";

export async function GET() {
  const authMode = isUsingDevAuthSecret() ? "dev" : "secure";
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null, authMode });
  }

  const user = findUserById(session.sub);
  if (!user) {
    return NextResponse.json({ user: null, authMode });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      repostWindowDays: user.repost_window_days,
    },
    authMode,
  });
}
