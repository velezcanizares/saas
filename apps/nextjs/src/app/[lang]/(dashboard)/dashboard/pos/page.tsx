import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";
import { buttonVariants } from "@saasfly/ui/button";

import { EmptyPlaceholder } from "~/components/empty-placeholder";
import { PosTerminal } from "~/components/pos/pos-terminal";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";
import { trpc } from "~/trpc/server";

export const metadata = { title: "Punto de venta" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const business = await getActiveBusiness();
  if (!business) redirect("/dashboard/business/new");

  const [products, categories, mp] = await Promise.all([
    trpc.product.list.query({ businessId: business.id }),
    trpc.category.list.query({ businessId: business.id }),
    trpc.payment.mercadoPagoEnabled.query(),
  ]);

  return (
    <DashboardShell
      title="Punto de venta"
      description="Arma la venta y cobra en segundos."
    >
      {products.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Title>No tienes productos aún</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Carga tu catálogo para poder vender desde el punto de venta.
          </EmptyPlaceholder.Description>
          <Link href="/dashboard/catalog" className={buttonVariants({ variant: "outline" })}>
            Ir al catálogo
          </Link>
        </EmptyPlaceholder>
      ) : (
        <PosTerminal
          businessId={business.id}
          products={products}
          categories={categories.filter((c) => c.kind !== "EXPENSE")}
          mpEnabled={mp.enabled}
        />
      )}
    </DashboardShell>
  );
}
