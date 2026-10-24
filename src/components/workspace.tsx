"use client";

import type { OnMount } from "@monaco-editor/react";
import { useRef } from "react";
import type { ChallengeType, Language } from "@/lib/content/schema";
import { CodeEditor } from "./code-editor";

/**
 * Right-hand side of the lesson page: editor, toolbar and output area.
 * Running and grading are wired up in the next phases.
 */

const LANGUAGE_LABEL: Record<Language, string> = {
  html: "HTML",
  javascript: "JavaScript",
  python: "Python",
  sql: "SQL",
};

const OUTPUT_LABEL: Record<ChallengeType, string> = {
  page: "Preview",
  function: "Output",
  query: "Result",
};

// Drafts live in this browser only (a convenience, not a save).
const draftKey = (lessonKey: string) => `codesim:draft:${lessonKey}`;

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode etc.): drafts just aren't kept.
  }
}

export function Workspace({
  lessonKey,
  language,
  type,
  starter,
}: {
  lessonKey: string;
  language: Language;
  type: ChallengeType;
  starter: string;
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const codeRef = useRef(starter);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const key = draftKey(lessonKey);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    const draft = readDraft(key);
    if (draft !== null && draft !== starter) editor.setValue(draft);
  };

  function handleChange(value: string) {
    codeRef.current = value;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writeDraft(key, value === starter ? null : value), 500);
  }

  function reset() {
    if (!window.confirm("Reset the editor to the starter code? Your changes will be lost.")) return;
    editorRef.current?.setValue(starter);
    writeDraft(key, null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="rounded-md bg-border/60 px-2 py-1 font-mono text-xs font-medium">
          {LANGUAGE_LABEL[language]}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="btn-secondary px-3 py-1.5">
            Reset
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5" disabled title="Coming soon">
            ▶ Run
          </button>
          <button type="button" className="btn-primary px-3 py-1.5" disabled title="Coming soon">
            Submit
          </button>
        </div>
      </div>

      <div className="h-[55vh] min-h-64 lg:h-auto lg:flex-[3]">
        <CodeEditor language={language} defaultValue={starter} onChange={handleChange} onMount={handleMount} />
      </div>

      <section className="flex min-h-40 flex-col border-t border-border lg:flex-[2]" aria-label={OUTPUT_LABEL[type]}>
        <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {OUTPUT_LABEL[type]}
        </h2>
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted">
          Press Run to see your {OUTPUT_LABEL[type].toLowerCase()} here.
        </div>
      </section>
    </div>
  );
}
