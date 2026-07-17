"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@saasfly/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@saasfly/ui/card";
import * as Icons from "@saasfly/ui/icons";
import { Input } from "@saasfly/ui/input";
import { Label } from "@saasfly/ui/label";
import { toast } from "@saasfly/ui/use-toast";

import { trpc } from "~/trpc/client";

export function BusinessCreateForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rut, setRut] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Falta el nombre", description: "Ingresa el nombre de tu negocio.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await trpc.business.create.mutate({
        name: name.trim(),
        rut: rut.trim() || undefined,
        currency: "CLP",
        timezone: "America/Santiago",
      });
      toast({ title: "¡Negocio creado!", description: "Ya puedes cargar tu catálogo y empezar a vender." });
      router.push("/dashboard/catalog");
      router.refresh();
    } catch (err) {
      toast({
        title: "No se pudo crear el negocio",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>Crea tu negocio</CardTitle>
          <CardDescription>
            Con esto activas tu catálogo, el punto de venta y los reportes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input
              id="name"
              placeholder="Ej. Barbería El Corte Fino"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rut">RUT (opcional)</Label>
            <Input
              id="rut"
              placeholder="76.123.456-7"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Lo usaremos para la boleta electrónica más adelante.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            Crear negocio
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
