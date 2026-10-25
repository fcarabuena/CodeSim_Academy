/**
 * Which signed-in users may enter which private pages, decided in proxy.ts
 * from the session cookie before anything renders. This is a fast first
 * check only: every teacher page still checks the role in the database
 * (requireRole), so a stale or forged cookie can't get further.
 */

export type RouteDecision = "allow" | "login" | "forbidden";

const STAFF_ROLES = new Set(["TEACHER", "ADMIN"]);

export function routeDecision(pathname: string, user: { id?: string; role?: string } | null | undefined): RouteDecision {
  if (!user?.id) return "login";
  const teacherArea = pathname === "/teacher" || pathname.startsWith("/teacher/");
  if (teacherArea && !STAFF_ROLES.has(user.role ?? "")) return "forbidden";
  return "allow";
}
