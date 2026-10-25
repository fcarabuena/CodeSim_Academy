/**
 * Which signed-in users may enter which private pages, decided in proxy.ts
 * from the session cookie before anything renders. This is a fast first
 * check only: every teacher and admin page still checks the role (and that
 * the account isn't disabled) in the database, so a stale or forged cookie
 * can't get further.
 */

export type RouteDecision = "allow" | "login" | "forbidden";

const inArea = (pathname: string, area: string) => pathname === area || pathname.startsWith(`${area}/`);

/** Pages that need a signed-in user. Everything else is public. */
const PRIVATE_AREAS = ["/dashboard", "/profile", "/leaderboard", "/teacher", "/admin"];

export function routeDecision(pathname: string, user: { id?: string; role?: string } | null | undefined): RouteDecision {
  if (!PRIVATE_AREAS.some((area) => inArea(pathname, area))) return "allow";
  if (!user?.id) return "login";
  const role = user.role ?? "";
  if (inArea(pathname, "/admin") && role !== "ADMIN") return "forbidden";
  if (inArea(pathname, "/teacher") && role !== "TEACHER" && role !== "ADMIN") return "forbidden";
  return "allow";
}
