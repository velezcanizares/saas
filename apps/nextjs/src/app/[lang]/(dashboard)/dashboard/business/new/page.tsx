import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";

import { BusinessCreateForm } from "~/components/business/business-create-form";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";

export const metadata = { title: "Crear negocio" };
// Página autenticada por usuario: nunca prerenderizar estáticamente.
export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  // Si ya tiene un negocio, no repetir onboarding.
  const active = await getActiveBusiness();
  if (active) redirect("/dashboard/reports");

  return (
    <DashboardShell
      title="Bienvenido 👋"
      description="Configura tu negocio para empezar. Toma menos de un minuto."
    >
      <BusinessCreateForm />
    </DashboardShell>
  );
}
