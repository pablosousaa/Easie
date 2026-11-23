import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE } from "./auth-constants";
import { findUserById } from "./user-data";

export { SESSION_COOKIE };

type SessionPayload = {
  sub: string;
  username: string;
  name: string;
};

function getSecret(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.EASIE_AUTH_SECRET ||
    "easie-dev-only-secret-change-me";
  return new TextEncoder().encode(raw);
}

export function isUsingDevAuthSecret(): boolean {
  return !process.env.AUTH_SECRET && !process.env.EASIE_AUTH_SECRET;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    const username =
      typeof payload.username === "string"
        ? payload.username
        : typeof payload.email === "string"
          ? payload.email
          : "";
    if (!username) return null;
    return {
      sub: payload.sub,
      username,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await findUserById(session.sub);
  return user ?? null;
}
