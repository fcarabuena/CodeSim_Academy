import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { githubEnabled } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { AuthCard } from "../auth-card";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthCard
      title="Create your free account"
      subtitle="Start your first coding challenge in under a minute."
      showGitHub={githubEnabled}
    >
      <AuthForm mode="signup" />
    </AuthCard>
  );
}
