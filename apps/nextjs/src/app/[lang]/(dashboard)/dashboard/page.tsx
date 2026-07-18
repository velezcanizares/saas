import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";

import { trpc } from "~/trpc/server";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * `/dashboard` es solo un punto de entrada: asegura que exista el `Customer`
 * (para la facturación) y redirige a la vista principal del producto.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const customer = await trpc.customer.queryCustomer.query({ userId: user.id });
  if (!customer) {
    await trpc.customer.insertCustomer.mutate({ userId: user.id });
  }

  redirect("/dashboard/reports");
}
