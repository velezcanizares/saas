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

import { CategoryCreateDialog } from "~/components/catalog/category-create-dialog";
import { ProductFormDialog } from "~/components/catalog/product-form-dialog";
import { ProductImportDialog } from "~/components/catalog/product-import-dialog";
import { ProductRowActions } from "~/components/catalog/product-row-actions";
import { EmptyPlaceholder } from "~/components/empty-placeholder";
import { DashboardShell } from "~/components/shell";
import { getActiveBusiness } from "~/lib/business";
import { formatCLP } from "~/lib/format";
import { trpc } from "~/trpc/server";

export const metadata = { title: "Catálogo" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login-clerk");

  const business = await getActiveBusiness();
  if (!business) redirect("/dashboard/business/new");

  const [products, categories] = await Promise.all([
    trpc.product.list.query({ businessId: business.id, includeInactive: true }),
    trpc.category.list.query({ businessId: business.id }),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <DashboardShell
      title="Catálogo"
      description="Tus productos y servicios."
      headerAction={
        <div className="flex gap-2">
          <CategoryCreateDialog businessId={business.id} />
          <ProductImportDialog businessId={business.id} />
          <ProductFormDialog businessId={business.id} categories={categories} />
        </div>
      }
    >
      {products.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Title>Catálogo vacío</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Crea tu primer producto o servicio para empezar a vender.
          </EmptyPlaceholder.Description>
          <ProductFormDialog businessId={business.id} categories={categories} />
        </EmptyPlaceholder>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.kind === "SERVICE" ? "Servicio" : "Producto"}</TableCell>
                  <TableCell>{p.categoryId ? catById.get(p.categoryId) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(p.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.trackStock ? p.stock ?? 0 : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        p.active
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {p.active ? "Activo" : "Archivado"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProductRowActions
                      businessId={business.id}
                      product={p}
                      categories={categories}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardShell>
  );
}
