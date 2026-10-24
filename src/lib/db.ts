import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client for the app runtime.
 *
 * Uses the pooled DATABASE_URL. Neon's free compute scales to zero, so the
 * first query after idle may need several seconds to wake it: we allow a
 * generous connect timeout and retry a failed connection exactly once.
 */

const TRANSIENT_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "timeout",
  "Connection terminated",
  "Can't reach database server",
  "P1001", // can't reach server
  "P1002", // server timed out
  "P1017", // server closed connection
];

export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: unknown; code?: unknown };
  const haystack = `${String(e.code ?? "")} ${String(e.message ?? "")}`;
  return TRANSIENT_PATTERNS.some((p) => haystack.includes(p));
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    // Small pool: one free instance, and Neon's pooler does the real pooling.
    max: 5,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!isTransientDbError(err)) throw err;
          await new Promise((r) => setTimeout(r, 1_000));
          return query(args);
        }
      },
    },
  });
}

export type Db = ReturnType<typeof createClient>;

/** The client passed to `db.$transaction(async (tx) => ...)` callbacks. */
export type DbTx = Omit<Db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
