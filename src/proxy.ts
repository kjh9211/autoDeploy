import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const uid = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (uid === null) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except /login itself, the dependency-free ping probe
    // (docs/PLANNING.md §9 — must respond without a session either way),
    // and static assets.
    "/((?!login|api/ping|_next/static|_next/image|favicon.ico).*)",
  ],
};
