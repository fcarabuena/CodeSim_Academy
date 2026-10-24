/**
 * Syncs tracks, lessons and badges from /content into the database.
 *
 * Safe to run any number of times: rows are matched by slug and updated in
 * place, so student progress is kept. Lessons deleted from /content are only
 * reported, never deleted, because that would delete students' submissions.
 *
 *   npm run db:seed                       (uses DIRECT_URL from .env)
 *   DIRECT_URL="postgres://..." npm run db:seed   (e.g. against Neon)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getBadgeDefinitions, listTracks } from "../src/lib/content/loader";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_URL (or DATABASE_URL) in .env first.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 30_000 }),
});

async function main() {
  const tracks = await listTracks();
  const seen = new Set<string>();

  for (const t of tracks) {
    const track = await prisma.track.upsert({
      where: { slug: t.slug },
      update: { title: t.title, description: t.description, order: t.order },
      create: { slug: t.slug, title: t.title, description: t.description, order: t.order },
    });

    for (const l of t.lessons) {
      const data = { title: l.title, order: l.order, difficulty: l.difficulty, xpReward: l.xp };
      const lesson = await prisma.lesson.upsert({
        where: { trackId_slug: { trackId: track.id, slug: l.slug } },
        update: data,
        create: { ...data, slug: l.slug, trackId: track.id },
      });
      seen.add(lesson.id);
    }
    console.log(`✓ ${t.title}: ${t.lessons.length} lesson(s)`);
  }

  const badges = await getBadgeDefinitions();
  for (const b of badges) {
    const data = { title: b.title, description: b.description, icon: b.icon, criteriaJson: b.criteria };
    await prisma.badge.upsert({ where: { slug: b.slug }, update: data, create: { ...data, slug: b.slug } });
  }
  console.log(`✓ Badges: ${badges.length}`);

  const orphans = await prisma.lesson.findMany({
    where: { id: { notIn: [...seen] } },
    include: { track: { select: { slug: true } } },
  });
  for (const o of orphans) {
    console.warn(`! ${o.track.slug}/${o.slug} is in the database but no longer in /content (kept).`);
  }
}

main()
  .then(() => console.log("Seed complete."))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
