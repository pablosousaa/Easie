import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

/** Public: login / conta page. `/` redirects. Workspace needs a session cookie. */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/conta" || pathname.startsWith("/conta/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  // APIs enforce auth in handlers (401). Do not redirect them to Conta.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Root: logged-in → workspace; logged-out → login
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session ? "/gerar" : "/conta";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/conta";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css)$).*)",
  ],
};
