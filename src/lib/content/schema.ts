import { z } from "zod";

/**
 * Shapes of the files under /content. Everything is validated on load, so a
 * typo in a lesson fails the seed script and the content test loudly instead
 * of breaking a page for students.
 */

export const LANGUAGES = ["html", "javascript", "python", "sql"] as const;
export type Language = (typeof LANGUAGES)[number];

/** File extension of starter/solution files per language. */
export const EXTENSIONS: Record<Language, string> = {
  html: "html",
  javascript: "js",
  python: "py",
  sql: "sql",
};

/** The three MVP challenge types (see README). */
export const CHALLENGE_TYPES = ["page", "function", "query"] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase-kebab-case");

export const trackSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int(),
  /** Tailwind background class for the track accent, e.g. "bg-orange-500". */
  color: z.string().default("bg-indigo-500"),
});
export type TrackFile = z.infer<typeof trackSchema>;

export const lessonFrontmatterSchema = z.object({
  title: z.string().min(1),
  order: z.number().int(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  xp: z.number().int().positive(),
  type: z.enum(CHALLENGE_TYPES),
  language: z.enum(LANGUAGES),
  /** One line shown on the lesson map. */
  summary: z.string().min(1),
  /** Revealed one at a time by the hint button. */
  hints: z.array(z.string().min(1)).default([]),
});
export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

const testBase = {
  id: slug,
  /** Friendly description shown to the student, e.g. "Page has a main heading". */
  name: z.string().min(1),
  /** Shown when this test fails. */
  hint: z.string().optional(),
};

// --- "Build the page": DOM assertions run inside the preview iframe --------

const textMatch = z
  .object({
    equals: z.string().optional(),
    contains: z.string().optional(),
    /** Case-insensitive regular expression source. */
    matches: z.string().optional(),
  })
  .refine((m) => m.equals !== undefined || m.contains !== undefined || m.matches !== undefined, {
    message: "need one of equals, contains, matches",
  });

export const domCheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exists"), selector: z.string() }),
  z.object({
    kind: z.literal("count"),
    selector: z.string(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }),
  z.object({ kind: z.literal("text"), selector: z.string(), text: textMatch }),
  z.object({ kind: z.literal("attr"), selector: z.string(), name: z.string(), value: textMatch.optional() }),
  z.object({ kind: z.literal("hasClass"), selector: z.string(), className: z.string() }),
  /** Computed style, compared after the browser normalises it (colours become rgb()). */
  z.object({ kind: z.literal("style"), selector: z.string(), property: z.string(), equals: z.string() }),
]);
export type DomCheck = z.infer<typeof domCheckSchema>;

export const pageTestsSchema = z.object({
  tests: z.array(z.object({ ...testBase, check: domCheckSchema })).min(1),
});

// --- "Write the function": JavaScript and Python ----------------------------

const json: z.ZodType<unknown> = z.unknown();

export const functionTestSchema = z.discriminatedUnion("kind", [
  /** Call `functionName(...args)` and deep-compare the return value. */
  z.object({ ...testBase, kind: z.literal("returns"), args: z.array(json), expected: json }),
  /** Run the whole program and compare what it printed (trailing whitespace ignored). */
  z.object({ ...testBase, kind: z.literal("stdout"), expected: z.string() }),
]);
export type FunctionTest = z.infer<typeof functionTestSchema>;

export const functionTestsSchema = z
  .object({
    functionName: z.string().regex(/^[A-Za-z_$][\w$]*$/).optional(),
    tests: z.array(functionTestSchema).min(1),
  })
  .refine((t) => t.functionName || t.tests.every((x) => x.kind === "stdout"), {
    message: "functionName is required when any test has kind 'returns'",
  });

// --- "Query the data": SQL on a seeded SQLite database ----------------------

export const queryTestsSchema = z.object({
  /** File name (without .sql) in /content/datasets. */
  dataset: slug,
  /** Compare rows in order (true when the lesson asks for ORDER BY). */
  ordered: z.boolean().default(false),
  /**
   * The expected result is generated from solution.sql into expected.json
   * (npm run content:expected), so answers stay on the server.
   */
  tests: z
    .array(
      z.object({
        ...testBase,
        /** columns: same column names as the solution. rows: same rows (respecting `ordered`). */
        check: z.enum(["columns", "rows"]),
      }),
    )
    .min(1),
});

/** Result of running solution.sql, stored next to it as expected.json. */
export const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});
export type QueryResult = z.infer<typeof queryResultSchema>;

export const testsSchemaByType = {
  page: pageTestsSchema,
  function: functionTestsSchema,
  query: queryTestsSchema,
} as const;

export type PageTests = z.infer<typeof pageTestsSchema>;
export type FunctionTests = z.infer<typeof functionTestsSchema>;
export type QueryTests = z.infer<typeof queryTestsSchema>;
export type LessonTests = PageTests | FunctionTests | QueryTests;

/** Which challenge types each language supports. */
export const TYPES_BY_LANGUAGE: Record<Language, ChallengeType[]> = {
  html: ["page"],
  javascript: ["function"],
  python: ["function"],
  sql: ["query"],
};

// --- Badges (content/badges.json) ---------------------------------------------

export const badgeCriteriaSchema = z.discriminatedUnion("type", [
  /** Completed at least `count` lessons in total. */
  z.object({ type: z.literal("lessons_completed"), count: z.number().int().positive() }),
  /** Completed every lesson of one track. */
  z.object({ type: z.literal("track_completed"), track: slug }),
  /** Completed every lesson of any track. */
  z.object({ type: z.literal("any_track_completed") }),
  /** Daily streak of at least `days`. */
  z.object({ type: z.literal("streak"), days: z.number().int().positive() }),
  /** Reached at least `level`. */
  z.object({ type: z.literal("level"), level: z.number().int().positive() }),
  /** Completed a lesson for the first time without revealing its hints. */
  z.object({ type: z.literal("no_hints") }),
]);
export type BadgeCriteria = z.infer<typeof badgeCriteriaSchema>;

export const badgeDefinitionSchema = z.object({
  slug,
  title: z.string().min(1),
  description: z.string().min(1),
  /** An emoji. */
  icon: z.string().min(1).max(8),
  criteria: badgeCriteriaSchema,
});
export type BadgeDefinition = z.infer<typeof badgeDefinitionSchema>;

export const badgesFileSchema = z
  .array(badgeDefinitionSchema)
  .refine((b) => new Set(b.map((x) => x.slug)).size === b.length, { message: "badge slugs must be unique" });
