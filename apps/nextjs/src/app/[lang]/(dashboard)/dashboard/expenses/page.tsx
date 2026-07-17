import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saasfly/ui/table";

import { EmptyPlaceholder } from "~/components/empty-placeholder";
import { ExpenseCreateDialog } from "~/components/expenses/expense-create-dialog";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";
import { formatCLP, formatDateCL, paymentMethodLabel } from "~/lib/format";
import { trpc } from "~/trpc/server";

export const metadata = { title: "Egresos" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const business = await getActiveBusiness();
  if (!business) redirect("/dashboard/business/new");

  const [{ items: expenses }, categories] = await Promise.all([
    trpc.expense.list.query({ businessId: business.id }),
    trpc.category.list.query({ businessId: business.id, kind: "EXPENSE" }),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <DashboardShell
      title="Egresos"
      description="Gastos y compras del negocio."
      headerAction={<ExpenseCreateDialog businessId={business.id} categories={categories} />}
    >
      {expenses.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Title>Sin egresos</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Registra arriendos, sueldos, insumos y otros gastos para calcular tu
            utilidad real.
          </EmptyPlaceholder.Description>
          <ExpenseCreateDialog businessId={business.id} categories={categories} />
        </EmptyPlaceholder>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateCL(e.occurredAt)}
                  </TableCell>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell>{e.categoryId ? catById.get(e.categoryId) ?? "—" : "—"}</TableCell>
                  <TableCell>{paymentMethodLabel(e.paymentMethod)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardShell>
  );
}
