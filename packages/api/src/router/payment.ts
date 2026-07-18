import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "@saasfly/db";

import { env } from "../env.mjs";
import { createPreference, isMercadoPagoEnabled } from "../lib/mercadopago";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { money, requireMembership, SELLER_ROLES } from "./_shared";

const createCheckoutSchema = z.object({
  businessId: z.string().min(1),
  clientId: z.string().min(1).nullish(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: money.optional(),
      }),
    )
    .min(1),
});

export const paymentRouter = createTRPCRouter({
  /** True si el negocio puede cobrar con Mercado Pago (token configurado). */
  mercadoPagoEnabled: protectedProcedure.query(() => {
    return { enabled: isMercadoPagoEnabled() };
  }),

  /**
   * Crea una venta PENDIENTE (status DRAFT) y una preferencia de Mercado Pago,
   * devolviendo el link de pago (initPoint). El stock NO se descuenta acá: se
   * descuenta cuando el webhook confirma el pago (`/api/webhooks/mercadopago`).
   */
  createCheckout: protectedProcedure
    .input(createCheckoutSchema)
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, SELLER_ROLES);

      if (!isMercadoPagoEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Mercado Pago no está configurado en este entorno.",
        });
      }

      const sale = await db.transaction().execute(async (trx) => {
        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const products = await trx
          .selectFrom("Product")
          .select(["id", "name", "price", "cost", "active"])
          .where("businessId", "=", input.businessId)
          .where("id", "in", productIds)
          .execute();
        const byId = new Map(products.map((p) => [p.id, p]));

        const items = input.items.map((it) => {
          const p = byId.get(it.productId);
          if (!p) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Producto ${it.productId} no pertenece al negocio.`,
            });
          }
          if (!p.active) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `El producto "${p.name}" está archivado.`,
            });
          }
          const unitPrice = it.unitPrice ?? p.price;
          return {
            productId: p.id,
            productName: p.name,
            unitPrice,
            unitCost: p.cost ?? null,
            quantity: it.quantity,
            discount: 0,
            total: unitPrice * it.quantity,
          };
        });

        const subtotal = items.reduce((sum, it) => sum + it.total, 0);

        const last = await trx
          .selectFrom("Sale")
          .select(({ fn }) => fn.max("receiptNumber").as("maxNum"))
          .where("businessId", "=", input.businessId)
          .executeTakeFirst();
        const receiptNumber = (last?.maxNum ?? 0) + 1;

        const created = await trx
          .insertInto("Sale")
          .values({
            businessId: input.businessId,
            clientId: input.clientId ?? null,
            soldByUserId: ctx.userId,
            receiptNumber,
            subtotal,
            discount: 0,
            tax: 0,
            total: subtotal,
            paymentMethod: "MERCADO_PAGO",
            status: "DRAFT", // pendiente de pago hasta que confirme el webhook
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("SaleItem")
          .values(items.map((it) => ({ ...it, saleId: created.id })))
          .execute();

        return { ...created, items };
      });

      const base = env.NEXTAUTH_URL;
      const preference = await createPreference({
        externalReference: sale.id,
        items: sale.items.map((it) => ({
          title: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        notificationUrl: `${base}/api/webhooks/mercadopago`,
        backUrls: {
          success: `${base}/dashboard/sales`,
          failure: `${base}/dashboard/pos`,
          pending: `${base}/dashboard/sales`,
        },
      });

      return { saleId: sale.id, initPoint: preference.init_point };
    }),
});
