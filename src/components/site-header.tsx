import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
import { auth } from "@/auth";
import { Logo } from "./logo";

export async function SiteHeader() {
  // Session cookie only, no database hit: keeps every page fast and working
  // even while the database wakes up. Pages re-check roles server-side.
  const user = (await auth())?.user;
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "TEACHER" || isAdmin;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav className="flex items-center gap-0.5 text-sm sm:gap-3">
          <NavLink href="/tracks">Tracks</NavLink>
          {user ? (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <span className="hidden sm:inline">
                <NavLink href="/leaderboard">Leaderboard</NavLink>
              </span>
              {/* Staff links on wider screens; on phones they're on the profile page. */}
              {isStaff && (
                <span className="hidden md:inline">
                  <NavLink href="/teacher">Teacher</NavLink>
                </span>
              )}
              {isAdmin && (
                <span className="hidden md:inline">
                  <NavLink href="/admin">Admin</NavLink>
                </span>
              )}
              <Link
                href="/profile"
                title={`Your profile (${user.name ?? user.email ?? ""})`}
                className="ml-1 grid size-8 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500"
              >
                <span aria-hidden>{(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}</span>
                <span className="sr-only">Your profile</span>
              </Link>
              {/* On phones, log out from the profile page to keep the header on one line. */}
              <form action={logOutAction} className="hidden sm:block">
                <button type="submit" className="btn-secondary px-3 py-1.5">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <NavLink href="/login">Log in</NavLink>
              <Link href="/signup" className="btn-primary px-3 py-1.5">
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-1.5 py-1.5 font-medium text-muted hover:text-foreground sm:px-2"
    >
      {children}
    </Link>
  );
}
