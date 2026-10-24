"use client";

import type { OnMount } from "@monaco-editor/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Rewards } from "@/lib/gamification/award";
import type { ChallengeType, Language } from "@/lib/content/schema";
import type { GradeResult } from "@/lib/grading/grade";
import { hintsRevealed } from "@/lib/hint-usage";
import { getRunner, warmUp } from "@/lib/runners/browser/runners";
import type { RunResult, RunSpec } from "@/lib/runners/types";
import { toast } from "@/lib/toast";
import { CodeEditor } from "./code-editor";
import { TestResults } from "./test-results";

/**
 * Right-hand side of the lesson page: editor, Run/Submit and the output area.
 * Code runs in the browser (see lib/runners); Submit sends what the runner
 * observed to the server, which grades it and saves progress.
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

type Busy = null | "running" | "grading";
type Tab = "output" | "tests";
type Submission = GradeResult & { firstCompletion: boolean; rewards?: Rewards };

/** Celebrate what the server awarded, biggest news last so it stays on screen longest. */
function showRewardToasts(r: Rewards) {
  if (r.xpGained > 0) toast({ kind: "xp", icon: "✨", title: `+${r.xpGained} XP`, body: `${r.totalXp} XP in total` });
  if (r.streak.extended) {
    toast({
      kind: "streak",
      icon: "🔥",
      title: r.streak.current === 1 ? "Streak started!" : `${r.streak.current}-day streak!`,
      body: r.streak.current === 1 ? "Solve a challenge tomorrow to keep it going." : "Keep it up tomorrow.",
    });
  }
  if (r.level.level > r.previousLevel) {
    toast({ kind: "level", icon: "⬆️", title: `Level up! You're level ${r.level.level}`, body: "Great progress." }, 7000);
  }
  for (const b of r.badges) {
    toast({ kind: "badge", icon: b.icon, title: `Badge unlocked: ${b.title}`, body: b.description }, 7000);
  }
}

export function Workspace({
  trackSlug,
  lessonSlug,
  language,
  type,
  starter,
  spec,
  loggedIn,
  completed: initiallyCompleted,
  nextHref,
}: {
  trackSlug: string;
  lessonSlug: string;
  language: Language;
  type: ChallengeType;
  starter: string;
  spec: RunSpec;
  loggedIn: boolean;
  completed: boolean;
  nextHref?: string;
}) {
  const router = useRouter();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const codeRef = useRef(starter);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warmedUp = useRef(false);
  const runRef = useRef<() => void>(() => {});
  const key = draftKey(`${trackSlug}/${lessonSlug}`);

  const [busy, setBusy] = useState<Busy>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("output");
  const [completed, setCompleted] = useState(initiallyCompleted);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const draft = readDraft(key);
    if (draft !== null && draft !== starter) editor.setValue(draft);
    codeRef.current = editor.getValue();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  function handleChange(value: string) {
    codeRef.current = value;
    // Start downloading Python / SQL as soon as the student starts typing.
    if (!warmedUp.current && language !== "html") {
      warmedUp.current = true;
      warmUp(language === "sql" ? "sql" : language);
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writeDraft(key, value === starter ? null : value), 500);
  }

  function reset() {
    if (!window.confirm("Reset the editor to the starter code? Your changes will be lost.")) return;
    editorRef.current?.setValue(starter);
    writeDraft(key, null);
  }

  async function execute(): Promise<RunResult> {
    setBusy("running");
    setLoadingMessage(null);
    try {
      const runner = getRunner(spec, () => frameRef.current);
      const result = await runner.run(codeRef.current, spec, { onLoading: setLoadingMessage });
      setRun(result);
      return result;
    } finally {
      setLoadingMessage(null);
    }
  }

  async function handleRun() {
    if (busy) return;
    setTab("output");
    try {
      await execute();
    } finally {
      setBusy(null);
    }
  }
  // Keep the Ctrl+Enter shortcut pointing at the latest handleRun.
  useEffect(() => {
    runRef.current = handleRun;
  });

  async function handleSubmit() {
    if (busy || !loggedIn) return;
    setSubmitError(null);
    try {
      const result = await execute();
      setBusy("grading");
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackSlug,
          lessonSlug,
          code: codeRef.current,
          observations: result.observations,
          hintsUsed: hintsRevealed(`${trackSlug}/${lessonSlug}`),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(body.error ?? "We couldn't check your answer. Please try again.");
        setTab("output");
        return;
      }
      const submission = body as Submission;
      setSubmission(submission);
      setTab("tests");
      if (submission.passed) setCompleted(true);
      if (submission.rewards) {
        showRewardToasts(submission.rewards);
        router.refresh(); // update server-rendered progress (track map, header) in the background
      }
    } catch {
      setSubmitError("We couldn't reach the server. If the site was asleep, wait a few seconds and try again.");
    } finally {
      setBusy(null);
    }
  }

  const statusText =
    busy === "grading" ? "Checking your answer…" : busy === "running" ? (loadingMessage ?? "Running…") : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-border/60 px-2 py-1 font-mono text-xs font-medium">{LANGUAGE_LABEL[language]}</span>
          {completed && (
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ Completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="btn-secondary px-3 py-1.5" disabled={busy !== null}>
            Reset
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="btn-secondary px-3 py-1.5"
            disabled={busy !== null}
            title="Run (Ctrl+Enter)"
          >
            ▶ Run
          </button>
          {loggedIn ? (
            <button type="button" onClick={handleSubmit} className="btn-primary px-3 py-1.5" disabled={busy !== null}>
              Submit
            </button>
          ) : (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/tracks/${trackSlug}/${lessonSlug}`)}`}
              className="btn-primary px-3 py-1.5"
            >
              Log in to submit
            </Link>
          )}
        </div>
      </div>

      <div className="h-[55vh] min-h-64 lg:h-auto lg:flex-[3]">
        <CodeEditor language={language} defaultValue={starter} onChange={handleChange} onMount={handleMount} />
      </div>

      <section className="flex min-h-56 flex-col border-t border-border lg:min-h-0 lg:flex-[2]" aria-label="Results">
        <div className="flex items-center justify-between gap-2 border-b border-border px-2" role="tablist">
          <div className="flex">
            <TabButton active={tab === "output"} onClick={() => setTab("output")}>
              {OUTPUT_LABEL[type]}
            </TabButton>
            <TabButton active={tab === "tests"} onClick={() => setTab("tests")}>
              Tests
              {submission && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 text-[10px] ${
                    submission.passed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                  }`}
                >
                  {submission.results.filter((r) => r.passed).length}/{submission.results.length}
                </span>
              )}
            </TabButton>
          </div>
          {statusText && (
            <span className="flex items-center gap-2 pr-2 text-xs text-muted" role="status">
              <span className="size-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden />
              {statusText}
            </span>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto">
          {submitError && (
            <p role="alert" className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {submitError}
            </p>
          )}

          {/* The preview iframe stays mounted so Submit can inspect it. */}
          {type === "page" && (
            <div className={tab === "output" ? "h-full min-h-48" : "hidden"}>
              <iframe
                ref={frameRef}
                title="Preview of your page"
                sandbox="allow-scripts"
                className="h-full min-h-48 w-full bg-white"
                srcDoc={PREVIEW_PLACEHOLDER}
              />
            </div>
          )}

          {tab === "output" && type !== "page" && <RunOutput run={run} type={type} />}
          {tab === "output" && type === "page" && run?.status !== "ok" && run?.error && (
            <p className="absolute inset-x-3 top-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {run.error}
            </p>
          )}
          {tab === "output" && run?.warning && (
            <p role="alert" className="absolute inset-x-3 bottom-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow dark:bg-amber-950 dark:text-amber-100">
              {run.warning}
            </p>
          )}

          {tab === "tests" && (
            <div className="p-3">
              {submission ? (
                <TestResults grade={submission} firstCompletion={submission.firstCompletion} nextHref={nextHref} />
              ) : (
                <p className="py-6 text-center text-sm text-muted">
                  {loggedIn ? "Press Submit to check your answer against the tests." : "Log in, then press Submit to check your answer."}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const PREVIEW_PLACEHOLDER =
  "<p style='font-family:system-ui,sans-serif;color:#64748b;padding:1rem'>Press <b>Run</b> to see your page here.</p>";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
        active ? "border-indigo-600 text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RunOutput({ run, type }: { run: RunResult | null; type: ChallengeType }) {
  if (!run) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Press <b>Run</b> (or Ctrl+Enter) to see your {OUTPUT_LABEL[type].toLowerCase()} here.
      </p>
    );
  }
  return (
    <div className="space-y-3 p-3">
      {run.error && (
        <pre
          role="alert"
          className="whitespace-pre-wrap rounded-lg bg-rose-50 px-3 py-2 font-mono text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
        >
          {run.error}
        </pre>
      )}
      {type === "function" &&
        (run.output ? (
          <pre className="whitespace-pre-wrap font-mono text-sm">{run.output}</pre>
        ) : (
          !run.error && <p className="text-sm text-muted">Your program ran but didn&apos;t print anything.</p>
        ))}
      {type === "query" && run.table && <ResultTable table={run.table} />}
      <p className="text-xs text-muted">Finished in {run.durationMs} ms</p>
    </div>
  );
}

const MAX_DISPLAY_ROWS = 200;

function ResultTable({ table }: { table: NonNullable<RunResult["table"]> }) {
  if (table.columns.length === 0) {
    return <p className="text-sm text-muted">Your query ran, but didn&apos;t return any rows.</p>;
  }
  const rows = table.rows.slice(0, MAX_DISPLAY_ROWS);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-border/40">
            <tr>
              {table.columns.map((c, i) => (
                <th key={i} className="px-3 py-1.5 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((v, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-1.5">
                    {v === null ? <span className="text-muted">NULL</span> : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        {table.rows.length} row{table.rows.length === 1 ? "" : "s"}
        {table.rows.length > MAX_DISPLAY_ROWS && ` (showing the first ${MAX_DISPLAY_ROWS})`}
        {table.truncated && ", results were cut off at 1000 rows"}
      </p>
    </div>
  );
}
