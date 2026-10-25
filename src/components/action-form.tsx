"use client";

import { useActionState, useRef } from "react";
import { toast } from "@/lib/toast";

export type ActionResult = { ok: boolean; message: string };
type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn bg-rose-600 text-white hover:bg-rose-500",
} as const;

/**
 * A small form that runs a server action and reports the result as a toast.
 * With `confirm`, the button first opens a dialog that explains what will
 * happen; the action only runs if the admin confirms.
 */
export function ActionForm({
  action,
  fields,
  label,
  variant = "secondary",
  confirm,
  children,
  className = "",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: keyof typeof VARIANTS;
  confirm?: { title: string; body: string; confirmLabel: string };
  children?: React.ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Report the result as soon as it arrives. This can't wait for an effect:
  // a successful delete or removal re-renders the page without this row, so
  // the component may already be gone by the time React would run one.
  const [, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    dialog.current?.close();
    toast({ kind: "info", icon: result.ok ? "✅" : "⚠️", title: result.message }, result.ok ? 4000 : 6000);
    return result;
  }, null);

  const button = `${VARIANTS[variant]} px-3 py-1.5 text-xs`;

  return (
    <form action={formAction} className={`flex items-center gap-2 ${className}`}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {confirm ? (
        <>
          <button type="button" className={button} disabled={pending} onClick={() => dialog.current?.showModal()}>
            {label}
          </button>
          <dialog
            ref={dialog}
            className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
          >
            <h2 className="text-lg font-bold">{confirm.title}</h2>
            <p className="mt-2 text-sm text-muted">{confirm.body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button type="submit" className={VARIANTS[variant === "secondary" ? "primary" : variant]} disabled={pending}>
                {pending ? "Working…" : confirm.confirmLabel}
              </button>
            </div>
          </dialog>
        </>
      ) : (
        <button type="submit" className={button} disabled={pending}>
          {pending ? "…" : label}
        </button>
      )}
    </form>
  );
}
