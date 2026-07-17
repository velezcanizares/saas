import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MANAGER_ROLES, money, requireMembership } from "./_shared";

const paymentMethod = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "MERCADO_PAGO",
  "WEBPAY",
  "OTHER",
]);

const createExpenseSchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().min(1).nullish(),
  description: z.string().min(1),
  amount: money,
  paymentMethod: paymentMethod.default("CASH"),
  occurredAt: z.date().optional(),
});

/**
 * Egresos = información financiera del negocio: solo OWNER/ADMIN. STAFF/CASHIER
 * no ven ni cargan egresos (ver convención de roles en [[_shared]]).
 */
export const expenseRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        categoryId: z.string().min(1).optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.date().optional(), // occurredAt del último item de la página previa
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);

      let query = db
        .selectFrom("Expense")
        .selectAll()
        .where("businessId", "=", input.businessId);

      if (input.categoryId) query = query.where("categoryId", "=", input.categoryId);
      if (input.from) query = query.where("occurredAt", ">=", input.from);
      if (input.to) query = query.where("occurredAt", "<=", input.to);
      if (input.cursor) query = query.where("occurredAt", "<", input.cursor);

      const rows = await query
        .orderBy("occurredAt", "desc")
        .limit(input.limit + 1)
        .execute();

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.occurredAt : undefined;

      return { items, nextCursor };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      return await db
        .selectFrom("Expense")
        .selectAll()
        .where("id", "=", input.id)
        .where("businessId", "=", input.businessId)
        .executeTakeFirst();
    }),

  create: protectedProcedure
    .input(createExpenseSchema)
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      return await db
        .insertInto("Expense")
        .values({
          businessId: input.businessId,
          categoryId: input.categoryId ?? null,
          createdByUserId: ctx.userId,
          description: input.description,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  update: protectedProcedure
    .input(
      createExpenseSchema
        .partial()
        .extend({ id: z.string().min(1), businessId: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { id, businessId, ...rest } = input;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(patch).length === 0) return { success: true };

      await db
        .updateTable("Expense")
        .set({ ...patch, updatedAt: new Date() })
        .where("id", "=", id)
        .where("businessId", "=", businessId)
        .execute();
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const res = await db
        .deleteFrom("Expense")
        .where("id", "=", input.id)
        .where("businessId", "=", input.businessId)
        .executeTakeFirst();
      if (!res.numDeletedRows) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Egreso no encontrado." });
      }
      return { success: true };
    }),
});
