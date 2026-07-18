"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@saasfly/ui";
import { Button } from "@saasfly/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@saasfly/ui/dialog";
import * as Icons from "@saasfly/ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saasfly/ui/table";
import { toast } from "@saasfly/ui/use-toast";

import { formatCLP, formatDateCL, paymentMethodLabel } from "~/lib/format";
import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "~/trpc/client";

type Sale = RouterOutputs["sale"]["list"]["items"][number];
type SaleDetail = NonNullable<RouterOutputs["sale"]["byId"]>;

const STATUS: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: "Completada", className: "text-emerald-600 dark:text-emerald-400" },
  REFUNDED: { label: "Devuelta", className: "text-amber-600 dark:text-amber-400" },
  CANCELLED: { label: "Anulada", className: "text-red-600 dark:text-red-400" },
  DRAFT: { label: "Borrador", className: "text-muted-foreground" },
};

export function SalesHistory({
  businessId,
  initialItems,
  initialCursor,
}: {
  businessId: string;
  initialItems: Sale[];
  initialCursor?: Date;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<Sale[]>(initialItems);
  const [cursor, setCursor] = React.useState<Date | undefined>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [detail, setDetail] = React.useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await trpc.sale.list.query({ businessId, cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast({ title: "Error al cargar", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const sale = await trpc.sale.byId.query({ id, businessId });
      if (sale) setDetail(sale);
    } catch (err) {
      toast({ title: "No se pudo abrir la venta", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(status: "REFUNDED" | "CANCELLED") {
    if (!detail) return;
    setActing(true);
    try {
      await trpc.sale.updateStatus.mutate({ id: detail.id, businessId, status });
      toast({
        title: status === "REFUNDED" ? "Venta devuelta" : "Venta anulada",
        description: "Se repuso el stock de los productos.",
      });
      setItems((prev) => prev.map((s) => (s.id === detail.id ? { ...s, status } : s)));
      setDetail((d) => (d ? { ...d, status } : d));
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo actualizar", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => {
              const st = STATUS[s.status] ?? STATUS.DRAFT!;
              return (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(s.id)}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateCL(s.soldAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">{s.receiptNumber ?? "—"}</TableCell>
                  <TableCell>{paymentMethodLabel(s.paymentMethod)}</TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-medium", st.className)}>{st.label}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCLP(s.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Icons.ChevronRight className="h-4 w-4" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            Cargar más
          </Button>
        </div>
      )}

      <Dialog open={!!detail || detailLoading} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>Venta #{detail.receiptNumber ?? "—"}</DialogTitle>
                <DialogDescription>
                  {formatDateCL(detail.soldAt)} · {paymentMethodLabel(detail.paymentMethod)} ·{" "}
                  <span className={STATUS[detail.status]?.className}>
                    {STATUS[detail.status]?.label}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-2">
                {detail.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm">
                    <span>
                      {it.quantity}× {it.productName}
                    </span>
                    <span className="tabular-nums">{formatCLP(it.total)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCLP(detail.subtotal)}</span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Descuento</span>
                    <span className="tabular-nums">−{formatCLP(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCLP(detail.total)}</span>
                </div>
              </div>

              {detail.status === "COMPLETED" && (
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting}
                    onClick={() => changeStatus("REFUNDED")}
                  >
                    Devolver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting}
                    onClick={() => changeStatus("CANCELLED")}
                  >
                    Anular
                  </Button>
                  <span className="flex-1 text-right text-xs text-muted-foreground self-center">
                    Repone el stock
                  </span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
