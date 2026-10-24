/**
 * Remembers how many lesson hints a student revealed, so Submit can report it
 * (for the "No Hints Needed" badge). Kept in this browser only; like all
 * browser-reported data it's an honour system, which is fine for a badge.
 */

const memory = new Map<string, number>();
const storageKey = (lessonKey: string) => `codesim:hints:${lessonKey}`;

export function recordHintsRevealed(lessonKey: string, count: number) {
  const next = Math.max(count, hintsRevealed(lessonKey));
  memory.set(lessonKey, next);
  try {
    localStorage.setItem(storageKey(lessonKey), String(next));
  } catch {
    // Storage blocked: the in-memory count still works for this visit.
  }
}

export function hintsRevealed(lessonKey: string): number {
  let stored = 0;
  try {
    stored = Number(localStorage.getItem(storageKey(lessonKey))) || 0;
  } catch {
    // ignore
  }
  return Math.max(memory.get(lessonKey) ?? 0, stored);
}
