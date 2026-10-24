/** Minimal toast store: call toast() anywhere in the browser; <Toaster /> renders them. */

export type ToastKind = "xp" | "level" | "badge" | "streak" | "info";

export type Toast = {
  id: number;
  kind: ToastKind;
  icon: string;
  title: string;
  body?: string;
};

type Listener = (toasts: Toast[]) => void;

/** At most this many toasts are on screen; the rest wait their turn. */
const MAX_VISIBLE = 3;

let toasts: Toast[] = [];
const queue: { toast: Toast; durationMs: number }[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

function show(t: Toast, durationMs: number) {
  toasts = [...toasts, t];
  emit();
  setTimeout(() => dismissToast(t.id), durationMs);
}

export function toast(t: Omit<Toast, "id">, durationMs = 5000) {
  const item = { ...t, id: nextId++ };
  if (toasts.length < MAX_VISIBLE) show(item, durationMs);
  else queue.push({ toast: item, durationMs });
}

export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
  const next = queue.shift();
  if (next) show(next.toast, next.durationMs);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}

const EMPTY: Toast[] = [];
export function getServerToasts(): Toast[] {
  return EMPTY;
}
