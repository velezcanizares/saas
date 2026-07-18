import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db, jsonArrayFrom } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { money, requireMembership, SELLER_ROLES } from "./_shared";

const paymentMethod = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "MERCADO_PAGO",
  "WEBPAY",
  "OTHER",
]);

const createSaleSchema = z.object({
  businessId: z.string().min(1),
  clientId: z.string().min(1).nullish(),
  paymentMethod,
  discount: money.default(0), // descuento a nivel de venta
  notes: z.string().optional(),
  soldAt: z.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        // Override de precio unitario (ej. precio pactado). Si no viene, se usa
        // el precio actual del producto.
        unitPrice: money.optional(),
        discount: money.default(0), // descuento a nivel de línea
      }),
    )
    .min(1, "La venta debe tener al menos un item"),
});

export const saleRouter = createTRPCRouter({
  /**
   * Registra una venta (POS). En una transacción: valida los productos del
   * negocio, congela precio/costo como snapshot, calcula totales, asigna
   * correlativo interno y descuenta stock de los bienes con control de stock.
   */
  create: protectedProcedure
    .input(createSaleSchema)
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, SELLER_ROLES);

      return await db.transaction().execute(async (trx) => {
        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const products = await trx
          .selectFrom("Product")
          .select([
            "id",
            "name",
            "price",
            "cost",
            "kind",
            "trackStock",
            "stock",
            "active",
          ])
          .where("businessId", "=", input.businessId)
          .where("id", "in", productIds)
          .execute();

        const byId = new Map(products.map((p) => [p.id, p]));

        // Validar existencia y estado de cada producto.
        for (const pid of productIds) {
          const p = byId.get(pid);
          if (!p) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Producto ${pid} no pertenece al negocio.`,
            });
          }
          if (!p.active) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `El producto "${p.name}" está archivado y no se puede vender.`,
            });
          }
        }

        // Acumular cantidad total por producto (por si un producto viene en
        // más de una línea) para validar stock de una vez.
        const qtyByProduct = new Map<string, number>();
        for (const it of input.items) {
          qtyByProduct.set(
            it.productId,
            (qtyByProduct.get(it.productId) ?? 0) + it.quantity,
          );
        }
        for (const [pid, qty] of qtyByProduct) {
          const p = byId.get(pid)!;
          if (p.trackStock && (p.stock ?? 0) < qty) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Stock insuficiente de "${p.name}" (disponible ${p.stock ?? 0}, requerido ${qty}).`,
            });
          }
        }

        // Construir líneas con snapshot y totales.
        const items = input.items.map((it) => {
          const p = byId.get(it.productId)!;
          const unitPrice = it.unitPrice ?? p.price;
          const lineDiscount = it.discount ?? 0;
          const total = unitPrice * it.quantity - lineDiscount;
          if (total < 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `El descuento de línea de "${p.name}" supera su total.`,
            });
          }
          return {
            productId: it.productId,
            productName: p.name,
            unitPrice,
            unitCost: p.cost ?? null,
            quantity: it.quantity,
            discount: lineDiscount,
            total,
          };
        });

        const subtotal = items.reduce((sum, it) => sum + it.total, 0);
        const saleDiscount = input.discount ?? 0;
        const total = subtotal - saleDiscount;
        if (total < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El descuento de la venta supera el subtotal.",
          });
        }

        // Correlativo interno por negocio.
        const last = await trx
          .selectFrom("Sale")
          .select(({ fn }) => fn.max("receiptNumber").as("maxNum"))
          .where("businessId", "=", input.businessId)
          .executeTakeFirst();
        const receiptNumber = (last?.maxNum ?? 0) + 1;

        const sale = await trx
          .insertInto("Sale")
          .values({
            businessId: input.businessId,
            clientId: input.clientId ?? null,
            soldByUserId: ctx.userId,
            receiptNumber,
            subtotal,
            discount: saleDiscount,
            tax: 0, // IVA se agrega cuando se integre boleta electrónica
            total,
            paymentMethod: input.paymentMethod,
            status: "COMPLETED",
            notes: input.notes ?? null,
            soldAt: input.soldAt ?? new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("SaleItem")
          .values(items.map((it) => ({ ...it, saleId: sale.id })))
          .execute();

        // Descontar stock de los bienes con control de stock.
        for (const [pid, qty] of qtyByProduct) {
          const p = byId.get(pid)!;
          if (p.trackStock) {
            await trx
              .updateTable("Product")
              .set({ stock: (p.stock ?? 0) - qty, updatedAt: new Date() })
              .where("id", "=", pid)
              .execute();
          }
        }

        return { ...sale, items };
      });
    }),

  /** Historial de ventas del negocio con filtros y paginación por cursor. */
  list: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        status: z
          .enum(["DRAFT", "COMPLETED", "REFUNDED", "CANCELLED"])
          .optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.date().optional(), // soldAt del último item de la página previa
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);

      let query = db
        .selectFrom("Sale")
        .selectAll("Sale")
        .where("businessId", "=", input.businessId);

      if (input.status) query = query.where("status", "=", input.status);
      if (input.from) query = query.where("soldAt", ">=", input.from);
      if (input.to) query = query.where("soldAt", "<=", input.to);
      if (input.cursor) query = query.where("soldAt", "<", input.cursor);

      const rows = await query
        .orderBy("soldAt", "desc")
        .limit(input.limit + 1)
        .execute();

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.soldAt : undefined;

      return { items, nextCursor };
    }),

  /** Detalle de una venta con sus líneas. */
  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      return await db
        .selectFrom("Sale")
        .selectAll("Sale")
        .select((eb) => [
          jsonArrayFrom(
            eb
              .selectFrom("SaleItem")
              .selectAll("SaleItem")
              .whereRef("SaleItem.saleId", "=", "Sale.id"),
          ).as("items"),
        ])
        .where("Sale.id", "=", input.id)
        .where("Sale.businessId", "=", input.businessId)
        .executeTakeFirst();
    }),

  /**
   * Cambia el estado de una venta a REFUNDED o CANCELLED (solo OWNER/ADMIN).
   * Al salir de COMPLETED se repone el stock de los bienes con control de stock.
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        businessId: z.string().min(1),
        status: z.enum(["REFUNDED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, ["OWNER", "ADMIN"]);

      return await db.transaction().execute(async (trx) => {
        const sale = await trx
          .selectFrom("Sale")
          .select(["id", "status"])
          .where("id", "=", input.id)
          .where("businessId", "=", input.businessId)
          .executeTakeFirst();

        if (!sale) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Venta no encontrada." });
        }
        if (sale.status === input.status) {
          return { success: true };
        }
        if (sale.status !== "COMPLETED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Solo se puede anular o devolver una venta completada.",
          });
        }

        // Reponer stock de las líneas cuyos productos siguen existiendo y
        // llevan control de stock. Se agrega por producto para no pisar el
        // update cuando un producto aparece en más de una línea.
        const lines = await trx
          .selectFrom("SaleItem as si")
          .innerJoin("Product as p", "p.id", "si.productId")
          .select(["si.productId", "si.quantity", "p.trackStock", "p.stock"])
          .where("si.saleId", "=", input.id)
          .where("p.trackStock", "=", true)
          .execute();

        const restock = new Map<string, { stock: number; qty: number }>();
        for (const line of lines) {
          if (!line.productId) continue;
          const acc = restock.get(line.productId) ?? {
            stock: line.stock ?? 0,
            qty: 0,
          };
          acc.qty += line.quantity;
          restock.set(line.productId, acc);
        }
        for (const [pid, { stock, qty }] of restock) {
          await trx
            .updateTable("Product")
            .set({ stock: stock + qty, updatedAt: new Date() })
            .where("id", "=", pid)
            .execute();
        }

        await trx
          .updateTable("Sale")
          .set({ status: input.status, updatedAt: new Date() })
          .where("id", "=", input.id)
          .execute();

        return { success: true };
      });
    }),
});
