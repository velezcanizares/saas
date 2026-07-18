import { redirect } from "next/navigation";

import { getCurrentUser } from "@saasfly/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@saasfly/ui/card";
import * as Icons from "@saasfly/ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saasfly/ui/table";

import { EmptyPlaceholder } from "~/components/empty-placeholder";
import { RangeSelector } from "~/components/finance/range-selector";
import { StatCard } from "~/components/finance/stat-card";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";
import {
  formatCLP,
  formatDateCL,
  formatPct,
  paymentMethodLabel,
} from "~/lib/format";
import { trpc } from "~/trpc/server";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

/** Convierte la clave de rango (query param) en un intervalo de fechas + etiqueta. */
function resolveRange(key: string): { from: Date; to: Date; label: string } {
  const to = new Date();
  const from = new Date(to);
  switch (key) {
    case "today":
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "hoy" };
    case "7d":
      from.setDate(from.getDate() - 7);
      return { from, to, label: "los últimos 7 días" };
    case "month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "este mes" };
    case "year":
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "este año" };
    case "30d":
    default:
      from.setDate(from.getDate() - 30);
      return { from, to, label: "los últimos 30 días" };
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const business = await getActiveBusiness();
  if (!business) redirect("/dashboard/business/new");

  const businessId = business.id;
  const rangeKey = searchParams?.range ?? "30d";
  const { from, to, label } = resolveRange(rangeKey);

  const [summary, byDay, topProducts, byCategory, byPayment, expensesByCat] =
    await Promise.all([
      trpc.report.summary.query({ businessId, from, to }),
      trpc.report.salesByDay.query({ businessId, from, to }),
      trpc.report.topProducts.query({ businessId, from, to, limit: 8 }),
      trpc.report.salesByCategory.query({ businessId, from, to }),
      trpc.report.salesByPaymentMethod.query({ businessId, from, to }),
      trpc.report.expensesByCategory.query({ businessId, from, to }),
    ]);

  const maxDay = Math.max(1, ...byDay.map((d) => d.revenue));
  const hasActivity = summary.salesCount > 0 || summary.totalExpenses > 0;

  return (
    <DashboardShell
      title={business.name}
      description={`Resumen financiero de ${label}.`}
      headerAction={<RangeSelector current={rangeKey} />}
    >
      {!hasActivity ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Title>Aún no hay movimientos</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Registra tu primera venta en el punto de venta o carga un egreso para
            ver aquí tus ingresos, márgenes y utilidad.
          </EmptyPlaceholder.Description>
        </EmptyPlaceholder>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Ingresos"
              value={formatCLP(summary.revenue)}
              hint={`${summary.salesCount} ventas`}
              icon={<Icons.Cart className="h-5 w-5" />}
              tone="positive"
            />
            <StatCard
              label="Egresos"
              value={formatCLP(summary.totalExpenses)}
              hint="Gastos del período"
              icon={<Icons.Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="Utilidad"
              value={formatCLP(summary.netProfit)}
              hint="Ingresos − costo − egresos"
              icon={<Icons.Chart className="h-5 w-5" />}
              tone={summary.netProfit >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Ticket promedio"
              value={formatCLP(summary.avgTicket)}
              hint={`Margen bruto ${formatPct(summary.grossMarginPct)}`}
              icon={<Icons.Receipt className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Ventas por día */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por día</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
                ) : (
                  byDay.map((d) => (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">
                        {formatDateCL(d.day)}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded bg-primary/80"
                          style={{ width: `${(d.revenue / maxDay) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums">
                        {formatCLP(d.revenue)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Productos más vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p) => (
                      <TableRow key={p.productId ?? p.productName}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(p.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCLP(p.margin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Ingresos por categoría */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ingresos por categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="tabular-nums">{formatCLP(c.revenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Métodos de pago + egresos por categoría */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métodos de pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {byPayment.map((p) => (
                  <div key={p.paymentMethod} className="flex items-center justify-between text-sm">
                    <span>
                      {paymentMethodLabel(p.paymentMethod)}{" "}
                      <span className="text-muted-foreground">({p.count})</span>
                    </span>
                    <span className="tabular-nums">{formatCLP(p.revenue)}</span>
                  </div>
                ))}
                {expensesByCat.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Egresos por categoría
                    </p>
                    {expensesByCat.map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-sm">
                        <span>{c.category}</span>
                        <span className="tabular-nums text-red-600 dark:text-red-400">
                          {formatCLP(c.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
