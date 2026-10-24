"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useSyncExternalStore } from "react";
import type { Language } from "@/lib/content/schema";

/**
 * Monaco editor. Monaco itself (~4 MB) is fetched by the browser from the
 * jsDelivr CDN on first use, so it never weighs on the server or the bundle.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

export function CodeEditor({
  language,
  defaultValue,
  onChange,
  onMount,
}: {
  language: Language;
  defaultValue: string;
  onChange: (value: string) => void;
  onMount?: OnMount;
}) {
  const dark = usePrefersDark();

  return (
    <Editor
      height="100%"
      language={language}
      defaultValue={defaultValue}
      theme={dark ? "vs-dark" : "light"}
      onChange={(v) => onChange(v ?? "")}
      onMount={onMount}
      loading={<EditorSkeleton />}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: language === "python" ? 4 : 2,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-4" role="status">
      {[60, 80, 45, 70, 30].map((w, i) => (
        <span key={i} className="h-3 animate-pulse rounded bg-border" style={{ width: `${w}%` }} />
      ))}
      <span className="sr-only">Loading editor…</span>
    </div>
  );
}
