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

prisma.user
  .update({ where: { email: email.trim().toLowerCase() }, data: { role }, select: { email: true, role: true } })
  .then((u) => console.log(`✓ ${u.email} is now ${u.role}. Ask them to log out and back in.`))
  .catch((err: { code?: string }) => {
    console.error(err.code === "P2025" ? `No user with email ${email}. They need to sign up first.` : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
