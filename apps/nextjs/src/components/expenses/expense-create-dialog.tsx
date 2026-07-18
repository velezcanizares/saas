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

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "WEBPAY", label: "Webpay" },
] as const;

export function ExpenseCreateDialog({
  businessId,
  categories,
}: {
  businessId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [payment, setPayment] = React.useState("CASH");
  const [categoryId, setCategoryId] = React.useState("none");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Math.round(Number(amount));
    if (!description.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "Datos incompletos", description: "Descripción y monto válido son obligatorios.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await trpc.expense.create.mutate({
        businessId,
        description: description.trim(),
        amount: amountNum,
        paymentMethod: payment as (typeof PAYMENT_OPTIONS)[number]["value"],
        categoryId: categoryId === "none" ? undefined : categoryId,
      });
      toast({ title: "Egreso registrado", description: description.trim() });
      setDescription("");
      setAmount("");
      setPayment("CASH");
      setCategoryId("none");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "No se pudo registrar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.Add className="mr-2 h-4 w-4" /> Nuevo egreso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo egreso</DialogTitle>
            <DialogDescription>
              Registra un gasto del negocio en pesos chilenos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="e-desc">Descripción</Label>
              <Input id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="e-amount">Monto</Label>
                <Input id="e-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
