import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
import { auth } from "@/auth";
import { Logo } from "./logo";

export async function SiteHeader() {
  // Session cookie only, no database hit: keeps every page fast and working
  // even while the database wakes up. Pages re-check roles server-side.
  const user = (await auth())?.user;
  const isStaff = user?.role === "TEACHER" || user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav className="flex items-center gap-0.5 text-sm sm:gap-3">
          <NavLink href="/tracks">Tracks</NavLink>
          {user ? (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              {isStaff && <NavLink href="/teacher">Teacher</NavLink>}
              <span className="hidden text-muted md:inline" title={user.email ?? undefined}>
                {user.name ?? user.email}
              </span>
              <form action={logOutAction}>
                <button type="submit" className="btn-secondary px-2.5 py-1.5 sm:px-3">
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
