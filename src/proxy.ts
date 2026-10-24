import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors with no session cookie to /login
// before rendering anything. Pages still verify the session (and role) on the
// server with requireUser()/requireRole(), so a forged cookie gets nowhere.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/leaderboard/:path*", "/teacher/:path*"],
};
