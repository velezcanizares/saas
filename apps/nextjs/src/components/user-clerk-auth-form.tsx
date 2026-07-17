"use client";

import * as React from "react";
import { redirect } from "next/navigation";
import { SignIn, useUser } from "@clerk/nextjs";

import { cn } from "@saasfly/ui";

type Dictionary = Record<string, string>;

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  lang: string;
  dict?: Dictionary;
  disabled?: boolean;
}

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkConfigured =
  clerkPk.startsWith("pk_test_") || clerkPk.startsWith("pk_live_");

export function UserClerkAuthForm({
  className,
  lang,
  ...props
}: UserAuthFormProps) {
  if (!clerkConfigured) {
    return (
      <div className={cn("grid gap-6 text-sm text-muted-foreground", className)} {...props}>
        Clerk is not configured. Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
        <code>CLERK_SECRET_KEY</code> in <code>.env.local</code> to enable sign-in.
      </div>
    );
  }
  return <ClerkForm className={className} lang={lang} {...props} />;
}

function ClerkForm({ className, lang, ...props }: UserAuthFormProps) {
  const { user } = useUser();
  if (user) {
    redirect(`/${lang}/dashboard`);
  }
  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <SignIn withSignUp={false} fallbackRedirectUrl={`/${lang}/dashboard`} />
    </div>
  );
}
