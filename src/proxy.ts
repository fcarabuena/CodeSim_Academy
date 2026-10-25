import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { routeDecision } from "@/lib/route-access";

// Reads the signed session cookie only (no database), so it's cheap enough to
// run before every private page. Signed-out visitors go to /login and
// students go from teacher pages to /dashboard with a real redirect, before
// anything renders. Pages still re-check roles in the database.
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const decision = routeDecision(pathname, request.auth?.user);

  if (decision === "login") {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }
  if (decision === "forbidden") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/leaderboard/:path*", "/teacher/:path*"],
};
