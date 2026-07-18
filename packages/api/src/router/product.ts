import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MANAGER_ROLES, money, requireMembership } from "./_shared";

const productKind = z.enum(["GOOD", "SERVICE"]);

const createProductSchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  kind: productKind.default("GOOD"),
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: money,
  cost: money.optional(),
  trackStock: z.boolean().default(false),
  stock: z.number().int().optional(),
  stockAlertAt: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export const productRouter = createTRPCRouter({
  /** Catálogo del negocio con filtros. Cualquier miembro puede leerlo. */
  list: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        kind: productKind.optional(),
        categoryId: z.string().min(1).optional(),
        search: z.string().optional(),
        includeInactive: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      let query = db
        .selectFrom("Product")
        .selectAll()
        .where("businessId", "=", input.businessId);

      if (!input.includeInactive) query = query.where("active", "=", true);
      if (input.kind) query = query.where("kind", "=", input.kind);
      if (input.categoryId)
        query = query.where("categoryId", "=", input.categoryId);
      if (input.search) query = query.where("name", "ilike", `%${input.search}%`);

      return await query.orderBy("name", "asc").execute();
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      return await db
        .selectFrom("Product")
        .selectAll()
        .where("id", "=", input.id)
        .where("businessId", "=", input.businessId)
        .executeTakeFirst();
    }),

  /** Productos con stock en o bajo su umbral de alerta. */
  lowStock: protectedProcedure
    .input(z.object({ businessId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      return await db
        .selectFrom("Product")
        .selectAll()
        .where("businessId", "=", input.businessId)
        .where("active", "=", true)
        .where("trackStock", "=", true)
        .whereRef("stock", "<=", "stockAlertAt")
        .orderBy("stock", "asc")
        .execute();
    }),

  create: protectedProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);

      // Servicios no llevan stock.
      const isService = input.kind === "SERVICE";
      const trackStock = isService ? false : input.trackStock;

      return await db
        .insertInto("Product")
        .values({
          businessId: input.businessId,
          categoryId: input.categoryId ?? null,
          kind: input.kind,
          name: input.name,
          description: input.description ?? null,
          sku: input.sku ?? null,
          imageUrl: input.imageUrl ?? null,
          price: input.price,
          cost: input.cost ?? null,
          trackStock,
          stock: trackStock ? input.stock ?? 0 : null,
          stockAlertAt: trackStock ? input.stockAlertAt ?? null : null,
          durationMinutes: input.durationMinutes ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  update: protectedProcedure
    .input(
      createProductSchema.partial().extend({
        id: z.string().min(1),
        businessId: z.string().min(1),
        active: z.boolean().optional(), // permite archivar/reactivar
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { id, businessId, ...rest } = input;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(patch).length === 0) return { success: true };

      await db
        .updateTable("Product")
        .set({ ...patch, updatedAt: new Date() })
        .where("id", "=", id)
        .where("businessId", "=", businessId)
        .execute();
      return { success: true };
    }),

  /**
   * Ajuste manual de stock (recepción de mercadería, merma, corrección).
   * `delta` positivo suma, negativo resta. No permite dejar stock negativo.
   */
  adjustStock: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        businessId: z.string().min(1),
        delta: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);

      return await db.transaction().execute(async (trx) => {
        const product = await trx
          .selectFrom("Product")
          .select(["id", "trackStock", "stock"])
          .where("id", "=", input.id)
          .where("businessId", "=", input.businessId)
          .executeTakeFirst();

        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado." });
        }
        if (!product.trackStock) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Este producto no lleva control de stock.",
          });
        }
        const newStock = (product.stock ?? 0) + input.delta;
        if (newStock < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El ajuste dejaría el stock en negativo.",
          });
        }
        await trx
          .updateTable("Product")
          .set({ stock: newStock, updatedAt: new Date() })
          .where("id", "=", input.id)
          .execute();
        return { stock: newStock };
      });
    }),

  /**
   * Importación masiva desde CSV. Crea categorías por nombre si no existen.
   * No usa una transacción global: importa fila por fila y reporta las que
   * fallan (ej. SKU duplicado), para no perder todo el lote por un error.
   */
  bulkImport: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        rows: z
          .array(
            z.object({
              name: z.string().min(1),
              price: money,
              cost: money.optional(),
              kind: productKind.default("GOOD"),
              categoryName: z.string().optional(),
              sku: z.string().optional(),
              stock: z.number().int().optional(),
            }),
          )
          .min(1)
          .max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);

      // Cache de categorías existentes por "KIND|nombre-en-minúscula".
      const existing = await db
        .selectFrom("Category")
        .select(["id", "name", "kind"])
        .where("businessId", "=", input.businessId)
        .execute();
      const catCache = new Map<string, string>();
      for (const c of existing) {
        catCache.set(`${c.kind}|${c.name.toLowerCase()}`, c.id);
      }

      let created = 0;
      const errors: { row: number; name: string; message: string }[] = [];

      for (let i = 0; i < input.rows.length; i++) {
        const r = input.rows[i]!;
        try {
          let categoryId: string | null = null;
          const catName = r.categoryName?.trim();
          if (catName) {
            const catKind = r.kind === "SERVICE" ? "SERVICE" : "PRODUCT";
            const key = `${catKind}|${catName.toLowerCase()}`;
            let id = catCache.get(key);
            if (!id) {
              const nc = await db
                .insertInto("Category")
                .values({ businessId: input.businessId, name: catName, kind: catKind })
                .returning("id")
                .executeTakeFirst();
              id = nc?.id;
              if (id) catCache.set(key, id);
            }
            categoryId = id ?? null;
          }

          const trackStock = r.kind === "GOOD" && r.stock != null;
          await db
            .insertInto("Product")
            .values({
              businessId: input.businessId,
              name: r.name.trim(),
              kind: r.kind,
              price: r.price,
              cost: r.cost ?? null,
              sku: r.sku?.trim() || null,
              categoryId,
              trackStock,
              stock: trackStock ? r.stock! : null,
            })
            .execute();
          created++;
        } catch (e) {
          errors.push({
            row: i + 1,
            name: r.name,
            message: e instanceof Error ? e.message : "Error desconocido",
          });
        }
      }

      return { created, errors };
    }),

  /** Archiva (soft-delete) el producto: no aparece en el POS, se preserva histórico. */
  archive: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      await db
        .updateTable("Product")
        .set({ active: false, updatedAt: new Date() })
        .where("id", "=", input.id)
        .where("businessId", "=", input.businessId)
        .execute();
      return { success: true };
    }),
});
