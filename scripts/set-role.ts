/**
 * Change a user's role. The user signs up normally first, then:
 *
 *   npm run set-role -- teacher@school.org TEACHER
 *   npm run set-role -- me@example.com ADMIN
 *   npm run set-role -- someone@example.com STUDENT
 *
 * Uses DIRECT_URL (or DATABASE_URL) from .env, so it works against Neon from
 * your own computer. The user should log out and back in to see the
 * Teacher link in the header (teacher pages check the role on every visit).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

const [email, roleArg] = process.argv.slice(2);
const role = roleArg?.toUpperCase() as Role | undefined;

if (!email || !role || !ROLES.includes(role)) {
  console.error("Usage: npm run set-role -- <email> <STUDENT|TEACHER|ADMIN>");
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_URL (or DATABASE_URL) in .env first.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 30_000 }) });

const maskEmail = (e: string) => {
  const at = e.lastIndexOf("@");
  const local = e.slice(0, at);
  return local.length <= 2 ? `${local[0]}***${e.slice(at)}` : `${local[0]}***${local.at(-1)}${e.slice(at)}`;
};

class StopError extends Error {}

prisma
  .$transaction(async (tx) => {
    // Lock the admins so this can't race with an admin action in the app.
    const admins = await tx.$queryRaw<{ id: string; disabledAt: Date | null }[]>`
      SELECT "id", "disabledAt" FROM "User" WHERE "role" = 'ADMIN' FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true, email: true, role: true, disabledAt: true } });
    if (!user) throw new StopError(`No user with email ${email}. They need to sign up first.`);
    if (user.role === role) throw new StopError(`${user.email} is already ${role}.`);
    const activeAdmins = admins.filter((a) => a.disabledAt === null).length;
    if (user.role === "ADMIN" && !user.disabledAt && activeAdmins <= 1) {
      throw new StopError("That's the last active admin. Make someone else an ADMIN first.");
    }
    await tx.user.update({ where: { id: user.id }, data: { role } });
    const label = user.name ? `${user.name} (${maskEmail(user.email)})` : maskEmail(user.email);
    await tx.auditLog.create({
      data: { actorLabel: "set-role script", action: "user.role_changed", targetType: "user", targetId: user.id, targetLabel: label, details: { from: user.role, to: role } },
    });
    return user.email;
  })
  .then((e) => console.log(`✓ ${e} is now ${role}. Ask them to log out and back in.`))
  .catch((err) => {
    console.error(err instanceof StopError ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
