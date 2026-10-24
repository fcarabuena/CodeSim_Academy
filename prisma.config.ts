import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, studio, seed) connects directly, bypassing Neon's
// pooler, which does not support everything migrations need.
// The app itself uses the pooled DATABASE_URL (see src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` needs no database, so an unset URL is fine there.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
