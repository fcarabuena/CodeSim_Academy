import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { routeDecision } from "@/lib/route-access";

// Reads the signed session cookie (and, at most once a minute per user,
// re-reads the role from the database; see auth.config.ts). Signed-out visitors go to /login and
// students go from teacher pages to /dashboard with a real redirect, before
// anything renders; the same goes for non-admins and /admin. Pages still
// re-check roles (and disabled accounts) in the database.
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

// Runs on every page (not just private ones) so the session's role is
// refreshed and the updated cookie saved wherever the user browses; only the
// private areas in route-access.ts are guarded. Static files, the API and the
// code-runner workers are skipped.
export const config = {
  matcher: ["/((?!api/|_next/|runners/|favicon.ico).*)"],
};
