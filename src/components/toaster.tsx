"use client";

import { useSyncExternalStore } from "react";
import { dismissToast, getServerToasts, getToasts, subscribeToasts, type ToastKind } from "@/lib/toast";

const STYLE: Record<ToastKind, string> = {
  xp: "border-indigo-300 bg-indigo-600 text-white",
  level: "border-amber-300 bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950",
  badge: "border-violet-300 bg-violet-600 text-white",
  streak: "border-orange-300 bg-orange-500 text-white",
  info: "border-border bg-surface text-foreground",
};

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`toast-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-lg ${STYLE[t.kind]}`}
        >
          <span className={`text-2xl ${t.kind === "level" || t.kind === "badge" ? "toast-bounce" : ""}`} aria-hidden>
            {t.icon}
          </span>
          <span>
            <span className="block font-bold leading-tight">{t.title}</span>
            {t.body && <span className="block text-sm opacity-90">{t.body}</span>}
          </span>
          <span className="sr-only">Dismiss</span>
        </button>
      ))}
    </div>
  );
}
