"use client";

import { useState } from "react";
import { recordHintsRevealed } from "@/lib/hint-usage";

/** Reveals the lesson's hints one at a time. */
export function Hints({ hints, lessonKey }: { hints: string[]; lessonKey: string }) {
  const [shown, setShown] = useState(0);
  if (hints.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-amber-900 dark:text-amber-200">Stuck? Get a hint</h2>
        {shown < hints.length && (
          <button
            type="button"
            onClick={() => {
              const next = shown + 1;
              setShown(next);
              recordHintsRevealed(lessonKey, next);
            }}
            className="btn border border-amber-300 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
          >
            💡 {shown === 0 ? "Show a hint" : "Next hint"} ({shown}/{hints.length})
          </button>
        )}
      </div>
      {shown > 0 && (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-900 dark:text-amber-100" aria-live="polite">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
