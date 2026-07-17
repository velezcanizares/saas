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
  DialogTrigger,
} from "@saasfly/ui/dialog";
import * as Icons from "@saasfly/ui/icons";
import { Input } from "@saasfly/ui/input";
import { Label } from "@saasfly/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saasfly/ui/select";
import { toast } from "@saasfly/ui/use-toast";

import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "~/trpc/client";

type Category = RouterOutputs["category"]["list"][number];
type Product = RouterOutputs["product"]["list"][number];

/**
 * Diálogo de producto que sirve para crear y editar.
 * - Sin `product`: modo crear, renderiza su propio botón "Nuevo producto".
 * - Con `product`: modo editar, controlado por `open`/`onOpenChange` (el tipo y
 *   el stock no se editan aquí; el stock se ajusta con la acción "Ajustar stock").
 */
export function ProductFormDialog({
  businessId,
  categories,
  product,
  open,
  onOpenChange,
}: {
  businessId: string;
  categories: Category[];
  product?: Product;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = !!product;

  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [isLoading, setIsLoading] = React.useState(false);
  const [kind, setKind] = React.useState<"GOOD" | "SERVICE">(product?.kind ?? "GOOD");
  const [name, setName] = React.useState(product?.name ?? "");
  const [price, setPrice] = React.useState(product ? String(product.price) : "");
  const [cost, setCost] = React.useState(product?.cost != null ? String(product.cost) : "");
  const [stock, setStock] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>(product?.categoryId ?? "none");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = Math.round(Number(price));
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: "Datos incompletos", description: "Nombre y precio válido son obligatorios.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const costNum = cost.trim() ? Math.round(Number(cost)) : undefined;
      const categoryValue = categoryId === "none" ? undefined : categoryId;

      if (isEdit) {
        await trpc.product.update.mutate({
          id: product.id,
          businessId,
          name: name.trim(),
          price: priceNum,
          cost: costNum,
          categoryId: categoryValue,
        });
        toast({ title: "Producto actualizado", description: name.trim() });
      } else {
        const trackStock = kind === "GOOD" && stock.trim() !== "";
        await trpc.product.create.mutate({
          businessId,
          name: name.trim(),
          kind,
          price: priceNum,
          cost: costNum,
          categoryId: categoryValue,
          trackStock,
          stock: trackStock ? Math.round(Number(stock)) : undefined,
        });
        toast({ title: "Producto creado", description: name.trim() });
        setName("");
        setPrice("");
        setCost("");
        setStock("");
        setCategoryId("none");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const relevantCats = categories.filter((c) =>
    kind === "SERVICE" ? c.kind === "SERVICE" : c.kind === "PRODUCT",
  );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Icons.Add className="mr-2 h-4 w-4" /> Nuevo producto
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto o servicio"}</DialogTitle>
            <DialogDescription>
              Los precios se ingresan en pesos chilenos, sin decimales.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                {isEdit ? (
                  <Input value={kind === "SERVICE" ? "Servicio" : "Producto"} disabled />
                ) : (
                  <Select value={kind} onValueChange={(v) => setKind(v as "GOOD" | "SERVICE")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GOOD">Producto (con stock)</SelectItem>
                      <SelectItem value="SERVICE">Servicio</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {relevantCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-name">Nombre</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-price">Precio de venta</Label>
                <Input id="p-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cost">Costo (opcional)</Label>
                <Input id="p-cost" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>

            {!isEdit && kind === "GOOD" && (
              <div className="space-y-2">
                <Label htmlFor="p-stock">Stock inicial (opcional)</Label>
                <Input id="p-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío si no quieres controlar stock de este producto.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
