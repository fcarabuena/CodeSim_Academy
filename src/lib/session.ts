import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

/**
 * The signed-in user, read fresh from the database (so a role change takes
 * effect without logging out), or null when signed out.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Use in pages and actions that require login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in teacher/admin pages and route handlers. Never rely on hiding links. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
