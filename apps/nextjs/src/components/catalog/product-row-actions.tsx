"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@saasfly/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@saasfly/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@saasfly/ui/dropdown-menu";
import * as Icons from "@saasfly/ui/icons";
import { Input } from "@saasfly/ui/input";
import { Label } from "@saasfly/ui/label";
import { toast } from "@saasfly/ui/use-toast";

import { ProductFormDialog } from "~/components/catalog/product-form-dialog";
import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "~/trpc/client";

type Category = RouterOutputs["category"]["list"][number];
type Product = RouterOutputs["product"]["list"][number];

export function ProductRowActions({
  businessId,
  product,
  categories,
}: {
  businessId: string;
  product: Product;
  categories: Category[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [stockOpen, setStockOpen] = React.useState(false);
  const [newStock, setNewStock] = React.useState(String(product.stock ?? 0));
  const [busy, setBusy] = React.useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      if (product.active) {
        await trpc.product.archive.mutate({ id: product.id, businessId });
        toast({ title: "Producto archivado", description: product.name });
      } else {
        await trpc.product.update.mutate({ id: product.id, businessId, active: true });
        toast({ title: "Producto reactivado", description: product.name });
      }
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo actualizar", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function saveStock(e: React.FormEvent) {
    e.preventDefault();
    const target = Math.round(Number(newStock));
    if (!Number.isFinite(target) || target < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const delta = target - (product.stock ?? 0);
    if (delta === 0) {
      setStockOpen(false);
      return;
    }
    setBusy(true);
    try {
      await trpc.product.adjustStock.mutate({ id: product.id, businessId, delta });
      toast({ title: "Stock actualizado", description: `${product.name}: ${target}` });
      setStockOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: "No se pudo ajustar", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Icons.Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Editar</DropdownMenuItem>
          {product.trackStock && (
            <DropdownMenuItem
              onSelect={() => {
                setNewStock(String(product.stock ?? 0));
                setStockOpen(true);
              }}
            >
              Ajustar stock
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void toggleArchive()} disabled={busy}>
            {product.active ? "Archivar" : "Reactivar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductFormDialog
        businessId={businessId}
        categories={categories}
        product={product}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <form onSubmit={saveStock}>
            <DialogHeader>
              <DialogTitle>Ajustar stock</DialogTitle>
              <DialogDescription>
                {product.name} · stock actual {product.stock ?? 0}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="new-stock">Nuevo stock</Label>
              <Input
                id="new-stock"
                type="number"
                min="0"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
