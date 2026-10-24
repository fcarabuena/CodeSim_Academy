/**
 * The one place that defines how XP turns into levels.
 *
 * Reaching level n (n >= 2) takes 100 * (n - 1)^1.5 total XP:
 *   level 2 at 100 XP, 3 at 283, 4 at 520, 5 at 800, 10 at 2700 ...
 * Early levels come quickly and later ones take steadily longer.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * (level - 1) ** 1.5);
}

/** The level a student with `xp` total XP has reached. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export type LevelProgress = {
  level: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level spans (from this level to the next). */
  xpForNextLevel: number;
  /** 0-1, for progress bars. */
  fraction: number;
};

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const xpIntoLevel = xp - start;
  return { level, xpIntoLevel, xpForNextLevel: span, fraction: span > 0 ? xpIntoLevel / span : 0 };
}
