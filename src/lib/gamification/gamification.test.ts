import { describe, expect, it } from "vitest";
import type { BadgeDefinition } from "@/lib/content/schema";
import { newBadges, type BadgeContext } from "./badges";
import { levelForXp, levelProgress, xpForLevel } from "./levels";
import { activeStreak, daysBetween, localDay, recordSolve, streakAtRisk, type StreakState } from "./streaks";
import { weekBounds } from "./week";

describe("levels", () => {
  it("uses 100 * (n - 1)^1.5 total XP per level", () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([0, 100, 283, 520, 800, 2700]);
  });

  it("maps XP to levels at the exact thresholds", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(282)).toBe(2);
    expect(levelForXp(283)).toBe(3);
    expect(levelForXp(2700)).toBe(10);
  });

  it("reports progress within the current level", () => {
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100, fraction: 0 });
    const p = levelProgress(150);
    expect(p).toMatchObject({ level: 2, xpIntoLevel: 50, xpForNextLevel: 183 });
    expect(p.fraction).toBeCloseTo(50 / 183);
  });
});

describe("streaks", () => {
  const empty: StreakState = { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  const at = (iso: string) => new Date(iso);

  it("computes calendar days in the student's timezone", () => {
    const d = at("2026-03-10T23:30:00Z");
    expect(localDay(d, "UTC")).toBe("2026-03-10");
    expect(localDay(d, "Asia/Manila")).toBe("2026-03-11"); // UTC+8
    expect(localDay(d, "America/New_York")).toBe("2026-03-10");
    expect(localDay(d, "Not/AZone")).toBe("2026-03-10"); // falls back to UTC
    expect(localDay(d, null)).toBe("2026-03-10");
  });

  it("counts days across month and year boundaries", () => {
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("starts, extends, keeps and resets a streak", () => {
    const day1 = recordSolve(empty, at("2026-03-10T09:00:00Z"));
    expect(day1).toMatchObject({ currentStreak: 1, longestStreak: 1, extended: true });

    const sameDay = recordSolve(day1, at("2026-03-10T20:00:00Z"));
    expect(sameDay).toMatchObject({ currentStreak: 1, extended: false });

    const day2 = recordSolve(sameDay, at("2026-03-11T08:00:00Z"));
    const day3 = recordSolve(day2, at("2026-03-12T08:00:00Z"));
    expect(day3).toMatchObject({ currentStreak: 3, longestStreak: 3, extended: true });

    const afterGap = recordSolve(day3, at("2026-03-14T08:00:00Z"));
    expect(afterGap).toMatchObject({ currentStreak: 1, longestStreak: 3, extended: true });
  });

  it("uses local midnight, not UTC midnight", () => {
    // 23:30 and 00:30 UTC are the same day in Manila (07:30 and 08:30)...
    const a = recordSolve(empty, at("2026-03-10T23:30:00Z"), "Asia/Manila");
    expect(recordSolve(a, at("2026-03-11T00:30:00Z"), "Asia/Manila").extended).toBe(false);
    // ...but different days in UTC.
    const b = recordSolve(empty, at("2026-03-10T23:30:00Z"), "UTC");
    expect(recordSolve(b, at("2026-03-11T00:30:00Z"), "UTC")).toMatchObject({ currentStreak: 2, extended: true });
  });

  it("handles daylight-saving changes", () => {
    // New York springs forward on 2026-03-08: 23-hour day.
    const s = recordSolve(empty, at("2026-03-08T03:30:00Z"), "America/New_York"); // Mar 7, 22:30 local
    expect(recordSolve(s, at("2026-03-09T03:30:00Z"), "America/New_York").currentStreak).toBe(2); // Mar 8, 23:30 local
  });

  it("shows a streak only while it is still alive", () => {
    const state: StreakState = { currentStreak: 5, longestStreak: 5, lastActiveDate: at("2026-03-10T12:00:00Z") };
    expect(activeStreak(state, at("2026-03-10T18:00:00Z"))).toBe(5);
    expect(activeStreak(state, at("2026-03-11T18:00:00Z"))).toBe(5);
    expect(streakAtRisk(state, at("2026-03-11T18:00:00Z"))).toBe(true);
    expect(activeStreak(state, at("2026-03-12T00:00:01Z"))).toBe(0);
    expect(activeStreak(empty, at("2026-03-12T00:00:00Z"))).toBe(0);
  });
});

describe("badges", () => {
  const defs: BadgeDefinition[] = [
    { slug: "first", title: "First", description: "d", icon: "👣", criteria: { type: "lessons_completed", count: 1 } },
    { slug: "web", title: "Web", description: "d", icon: "🧱", criteria: { type: "track_completed", track: "html-css" } },
    { slug: "any", title: "Any", description: "d", icon: "🏁", criteria: { type: "any_track_completed" } },
    { slug: "s3", title: "S3", description: "d", icon: "🔥", criteria: { type: "streak", days: 3 } },
    { slug: "l3", title: "L3", description: "d", icon: "🚀", criteria: { type: "level", level: 3 } },
    { slug: "nohints", title: "NH", description: "d", icon: "🧠", criteria: { type: "no_hints" } },
  ];
  const ctx: BadgeContext = {
    completedLessons: 1,
    tracks: { "html-css": { completed: 1, total: 4 }, sql: { completed: 0, total: 3 } },
    currentStreak: 1,
    level: 1,
    firstCompletionWithoutHints: false,
  };
  const slugs = (c: BadgeContext, owned: string[] = []) => newBadges(defs, c, new Set(owned)).map((b) => b.slug);

  it("awards the first-lesson badge once", () => {
    expect(slugs(ctx)).toEqual(["first"]);
    expect(slugs(ctx, ["first"])).toEqual([]);
  });

  it("awards track badges only when every lesson in the track is done", () => {
    expect(slugs({ ...ctx, completedLessons: 4, tracks: { "html-css": { completed: 4, total: 4 } } }, ["first"])).toEqual(["web", "any"]);
    expect(slugs({ ...ctx, tracks: { empty: { completed: 0, total: 0 } } }, ["first"])).toEqual([]);
  });

  it("awards streak, level and no-hints badges", () => {
    expect(slugs({ ...ctx, currentStreak: 3, level: 3, firstCompletionWithoutHints: true }, ["first"])).toEqual(["s3", "l3", "nohints"]);
  });
});

describe("weekBounds", () => {
  it("runs Monday 00:00 to Monday 00:00 UTC", () => {
    const { start, end } = weekBounds(new Date("2026-10-24T15:00:00Z")); // a Saturday
    expect(start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("treats Monday 00:00 as the start of a new week and Sunday night as the old one", () => {
    expect(weekBounds(new Date("2026-10-26T00:00:00Z")).start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekBounds(new Date("2026-10-25T23:59:59Z")).start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });
});
