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
import { toast } from "@saasfly/ui/use-toast";

import { parseCLPInt, parseCsv } from "~/lib/csv";
import { formatCLP } from "~/lib/format";
import { trpc } from "~/trpc/client";

interface ImportRow {
  name: string;
  price: number;
  cost?: number;
  kind: "GOOD" | "SERVICE";
  categoryName?: string;
  sku?: string;
  stock?: number;
}

// Normaliza un encabezado: minúsculas y sin acentos.
function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  nombre: "name",
  name: "name",
  producto: "name",
  precio: "price",
  price: "price",
  costo: "cost",
  cost: "cost",
  tipo: "kind",
  kind: "kind",
  categoria: "categoryName",
  category: "categoryName",
  rubro: "categoryName",
  sku: "sku",
  codigo: "sku",
  stock: "stock",
  inventario: "stock",
};

const TEMPLATE =
  "nombre,precio,costo,tipo,categoria,sku,stock\n" +
  "Corte clásico,12000,0,servicio,Cortes,,\n" +
  "Cera moldeadora 100g,8500,4200,producto,Productos,CER-100,24\n";

export function ProductImportDialog({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [skipped, setSkipped] = React.useState(0);
  const [fileName, setFileName] = React.useState("");

  function reset() {
    setRows([]);
    setSkipped(0);
    setFileName("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const matrix = parseCsv(text);
    if (matrix.length < 2) {
      toast({ title: "Archivo vacío", description: "No se encontraron filas de datos.", variant: "destructive" });
      reset();
      return;
    }

    const headers = matrix[0]!.map((h) => HEADER_ALIASES[norm(h)]);
    const parsed: ImportRow[] = [];
    let skip = 0;

    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i]!;
      const rec: Record<string, string> = {};
      headers.forEach((key, idx) => {
        if (key) rec[key] = cells[idx] ?? "";
      });

      const name = rec.name?.trim();
      const price = parseCLPInt(rec.price);
      if (!name || price == null) {
        skip++;
        continue;
      }
      const kind = /serv/i.test(rec.kind ?? "") ? "SERVICE" : "GOOD";
      const cost = parseCLPInt(rec.cost);
      const stock = parseCLPInt(rec.stock);
      parsed.push({
        name,
        price,
        cost: cost ?? undefined,
        kind,
        categoryName: rec.categoryName?.trim() || undefined,
        sku: rec.sku?.trim() || undefined,
        stock: kind === "GOOD" && stock != null ? stock : undefined,
      });
    }

    setRows(parsed);
    setSkipped(skip);
    if (parsed.length === 0) {
      toast({
        title: "Sin filas válidas",
        description: "Revisa que existan las columnas 'nombre' y 'precio'.",
        variant: "destructive",
      });
    }
  }

  async function onImport() {
    if (rows.length === 0) return;
    setIsLoading(true);
    try {
      const res = await trpc.product.bulkImport.mutate({ businessId, rows });
      if (res.errors.length > 0) {
        toast({
          title: `Importados ${res.created}, con ${res.errors.length} errores`,
          description: res.errors
            .slice(0, 3)
            .map((er) => `Fila ${er.row} (${er.name}): ${er.message}`)
            .join(" · "),
          variant: res.created > 0 ? "default" : "destructive",
        });
      } else {
        toast({ title: `${res.created} productos importados` });
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "No se pudo importar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Icons.Package className="mr-2 h-4 w-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar productos desde CSV</DialogTitle>
          <DialogDescription>
            Columnas: nombre, precio, costo, tipo (producto/servicio), categoría,
            sku, stock. Solo nombre y precio son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={downloadTemplate}>
            <Icons.ArrowRight className="mr-2 h-4 w-4" /> Descargar plantilla
          </Button>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
          />

          {rows.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">
                {fileName}: {rows.length} productos listos para importar
                {skipped > 0 && (
                  <span className="text-muted-foreground"> · {skipped} filas omitidas</span>
                )}
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {rows.slice(0, 4).map((r, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>
                      {r.name}{" "}
                      <span className="text-xs">
                        ({r.kind === "SERVICE" ? "servicio" : "producto"})
                      </span>
                    </span>
                    <span className="tabular-nums">{formatCLP(r.price)}</span>
                  </li>
                ))}
                {rows.length > 4 && <li className="text-xs">…y {rows.length - 4} más</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onImport} disabled={isLoading || rows.length === 0}>
            {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            Importar {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
