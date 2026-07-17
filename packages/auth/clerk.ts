import { auth } from '@clerk/nextjs/server'

import { env } from "./env.mjs";

// When Clerk is not configured (placeholder key or missing env), the middleware
// runs in unauthenticated mode. Server components calling `auth()` here would
// crash with "clerkMiddleware not detected", so we short-circuit to no user.
const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkConfigured =
  clerkPk.startsWith("pk_test_") || clerkPk.startsWith("pk_live_");

export async function getSessionUser() {
  if (!clerkConfigured) return undefined;
  const { sessionClaims } = await auth();
  if (env.ADMIN_EMAIL) {
    const adminEmails = env.ADMIN_EMAIL.split(",");
    if (sessionClaims?.user?.email) {
      sessionClaims.user.isAdmin = adminEmails.includes(sessionClaims?.user?.email);
    }
  }
  return sessionClaims?.user;
}
