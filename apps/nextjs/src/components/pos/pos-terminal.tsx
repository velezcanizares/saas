"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@saasfly/ui";
import { Button } from "@saasfly/ui/button";
import { Card, CardContent } from "@saasfly/ui/card";
import * as Icons from "@saasfly/ui/icons";
import { Input } from "@saasfly/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saasfly/ui/select";
import { toast } from "@saasfly/ui/use-toast";

import { formatCLP } from "~/lib/format";
import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "~/trpc/client";

type Product = RouterOutputs["product"]["list"][number];
type Category = RouterOutputs["category"]["list"][number];

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "WEBPAY", label: "Webpay" },
] as const;

export function PosTerminal({
  businessId,
  products,
  categories,
  mpEnabled = false,
}: {
  businessId: string;
  products: Product[];
  categories: Category[];
  mpEnabled?: boolean;
}) {
  const router = useRouter();
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [payment, setPayment] = React.useState<string>("CASH");
  const [isCharging, setIsCharging] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const filtered = products.filter((p) => {
    if (categoryId && p.categoryId !== categoryId) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addToCart(p: Product) {
    setCart((prev) => {
      const current = prev[p.id] ?? 0;
      if (p.trackStock && current + 1 > (p.stock ?? 0)) {
        toast({
          title: "Sin stock",
          description: `No queda stock de "${p.name}".`,
          variant: "destructive",
        });
        return prev;
      }
      return { ...prev, [p.id]: current + 1 };
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      const p = byId.get(id);
      if (p?.trackStock && qty > (p.stock ?? 0)) {
        toast({ title: "Sin stock", description: `Solo quedan ${p.stock ?? 0}.`, variant: "destructive" });
        return { ...prev, [id]: p.stock ?? 0 };
      }
      return { ...prev, [id]: qty };
    });
  }

  const lines = Object.entries(cart)
    .map(([id, qty]) => {
      const p = byId.get(id);
      return p ? { product: p, qty } : null;
    })
    .filter((l): l is { product: Product; qty: number } => l !== null);

  const total = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);

  async function checkout() {
    if (lines.length === 0) return;
    setIsCharging(true);
    try {
      const sale = await trpc.sale.create.mutate({
        businessId,
        paymentMethod: payment as (typeof PAYMENT_OPTIONS)[number]["value"],
        discount: 0,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      });
      toast({
        title: `Venta #${sale.receiptNumber} registrada`,
        description: `Total ${formatCLP(sale.total)} · ${itemCount} ítems`,
      });
      setCart({});
      router.refresh(); // refresca stock del catálogo
    } catch (err) {
      toast({
        title: "No se pudo cobrar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCharging(false);
    }
  }

  async function payWithMercadoPago() {
    if (lines.length === 0) return;
    setIsRedirecting(true);
    try {
      const { initPoint } = await trpc.payment.createCheckout.mutate({
        businessId,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
      });
      // Redirige al checkout de Mercado Pago; el webhook confirma y descuenta stock.
      window.location.href = initPoint;
    } catch (err) {
      toast({
        title: "No se pudo iniciar el pago",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Catálogo */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={categoryId === null ? "default" : "outline"}
              onClick={() => setCategoryId(null)}
            >
              Todos
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={categoryId === c.id ? "default" : "outline"}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const outOfStock = p.trackStock && (p.stock ?? 0) <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={outOfStock}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent",
                  outOfStock && "cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent",
                )}
              >
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="mt-1 text-sm font-semibold">{formatCLP(p.price)}</span>
                {p.trackStock && (
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {outOfStock ? "Sin stock" : `Stock: ${p.stock}`}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No hay productos que coincidan.
            </p>
          )}
        </div>
      </div>

      {/* Carrito */}
      <Card className="sticky top-20 h-fit">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Icons.Cart className="h-5 w-5" /> Venta actual
          </div>

          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Toca un producto para agregarlo.
            </p>
          ) : (
            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCLP(l.product.price)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setQty(l.product.id, l.qty - 1)}
                    >
                      <Icons.Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setQty(l.product.id, l.qty + 1)}
                    >
                      <Icons.Add className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                    {formatCLP(l.product.price * l.qty)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCLP(total)}</span>
            </div>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger>
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              size="lg"
              disabled={lines.length === 0 || isCharging || isRedirecting}
              onClick={checkout}
            >
              {isCharging && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Cobrar {total > 0 ? formatCLP(total) : ""}
            </Button>
            {mpEnabled && (
              <Button
                variant="outline"
                className="w-full"
                disabled={lines.length === 0 || isCharging || isRedirecting}
                onClick={payWithMercadoPago}
              >
                {isRedirecting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Pagar con Mercado Pago
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
