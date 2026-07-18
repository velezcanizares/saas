import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";

import { EmptyPlaceholder } from "~/components/empty-placeholder";
import { SalesHistory } from "~/components/sales/sales-history";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";
import { trpc } from "~/trpc/server";

export const metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const business = await getActiveBusiness();
  if (!business) redirect("/dashboard/business/new");

  const page = await trpc.sale.list.query({ businessId: business.id, limit: 50 });

  return (
    <DashboardShell
      title="Ventas"
      description="Historial de ventas del negocio."
    >
      {page.items.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Title>Sin ventas todavía</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Registra tu primera venta desde el punto de venta y aparecerá aquí.
          </EmptyPlaceholder.Description>
        </EmptyPlaceholder>
      ) : (
        <SalesHistory
          businessId={business.id}
          initialItems={page.items}
          initialCursor={page.nextCursor}
        />
      )}
    </DashboardShell>
  );
}
