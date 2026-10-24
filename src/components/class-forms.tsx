"use client";

import { useActionState, useState } from "react";
import { joinClassAction, type JoinClassState } from "@/app/dashboard/actions";
import { createClassAction, type CreateClassState } from "@/app/teacher/actions";

export function JoinClassForm() {
  const [state, action, pending] = useActionState<JoinClassState, FormData>(joinClassAction, {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="class-code" className="block text-sm font-medium">
        Class code
      </label>
      <div className="flex gap-2">
        <input
          id="class-code"
          name="code"
          required
          maxLength={12}
          autoComplete="off"
          placeholder="e.g. K7Q4MZ"
          className="input font-mono uppercase tracking-widest"
          aria-describedby="class-code-status"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={pending}>
          {pending ? "Joining…" : "Join"}
        </button>
      </div>
      <p id="class-code-status" role="status" className="min-h-5 text-sm">
        {state.error && <span className="text-rose-700 dark:text-rose-300">{state.error}</span>}
        {state.success && <span className="text-emerald-700 dark:text-emerald-300">{state.success}</span>}
      </p>
    </form>
  );
}

export function CreateClassForm() {
  const [state, action, pending] = useActionState<CreateClassState, FormData>(createClassAction, {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="class-name" className="block text-sm font-medium">
        New class name
      </label>
      <div className="flex gap-2">
        <input id="class-name" name="name" required maxLength={80} placeholder="e.g. Year 9 Coding Club" className="input" />
        <button type="submit" className="btn-primary shrink-0" disabled={pending}>
          {pending ? "Creating…" : "Create class"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary px-3 py-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the code is still visible to copy by hand.
        }
      }}
    >
      {copied ? "Copied!" : "Copy code"}
    </button>
  );
}
