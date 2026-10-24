"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logInAction, signUpAction, type FormState } from "./actions";

type Mode = "login" | "signup";

export function AuthForm({ mode, callbackUrl }: { mode: Mode; callbackUrl?: string }) {
  const action = mode === "signup" ? signUpAction : logInAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  // Attach the browser timezone (used for daily streaks) at submit time.
  function submit(formData: FormData) {
    if (mode === "signup") formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    formAction(formData);
  }

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={submit} className="space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      {mode === "signup" && (
        <Field label="Your name" name="name" autoComplete="name" defaultValue={values.name} errors={errors.name} />
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={values.email}
        errors={errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
        errors={errors.password}
      />

      {mode === "login" && callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

      <button type="submit" className="btn-primary w-full py-2.5" disabled={pending}>
        {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Create a free account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  hint,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
  errors?: string[];
}) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        // Remount when the server echoes a new value, so it shows up after the form reset.
        key={defaultValue}
        defaultValue={defaultValue}
        required
        className="input"
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
      />
      {errors ? (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {errors[0]}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
