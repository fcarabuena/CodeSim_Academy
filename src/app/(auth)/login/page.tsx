import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { githubEnabled } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { AuthCard } from "../auth-card";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  github_no_email: "Your GitHub account has no public email. Add one on GitHub or sign up with email.",
  OAuthAccountNotLinked: "That email is already used by another sign-in method.",
  account_disabled: "This account has been disabled. Please contact your school's admin.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { callbackUrl, error } = await searchParams;

  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue your streak." showGitHub={githubEnabled}>
      {typeof error === "string" && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {ERRORS[error] ?? "Something went wrong while logging in. Please try again."}
        </p>
      )}
      <AuthForm mode="login" callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
    </AuthCard>
  );
}
