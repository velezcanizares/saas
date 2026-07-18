import { z } from "zod";

import { db } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MANAGER_ROLES, requireMembership } from "./_shared";

const categoryKind = z.enum(["PRODUCT", "SERVICE", "EXPENSE"]);

export const categoryRouter = createTRPCRouter({
  /** Categorías del negocio, opcionalmente filtradas por tipo. */
  list: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        kind: categoryKind.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      let query = db
        .selectFrom("Category")
        .selectAll()
        .where("businessId", "=", input.businessId);
      if (input.kind) {
        query = query.where("kind", "=", input.kind);
      }
      return await query.orderBy("name", "asc").execute();
    }),

  create: protectedProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        name: z.string().min(1),
        kind: categoryKind,
        color: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      return await db
        .insertInto("Category")
        .values({
          businessId: input.businessId,
          name: input.name,
          kind: input.kind,
          color: input.color ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        businessId: z.string().min(1),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      if (Object.keys(patch).length === 0) return { success: true };

      await db
        .updateTable("Category")
        .set(patch)
        .where("id", "=", input.id)
        .where("businessId", "=", input.businessId)
        .execute();
      return { success: true };
    }),

  /** Borra la categoría; productos/egresos quedan con categoryId = null. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      await db.transaction().execute(async (trx) => {
        // Emular onDelete: SetNull (no hay FK real con relationMode = "prisma").
        await trx
          .updateTable("Product")
          .set({ categoryId: null })
          .where("categoryId", "=", input.id)
          .execute();
        await trx
          .updateTable("Expense")
          .set({ categoryId: null })
          .where("categoryId", "=", input.id)
          .execute();
        await trx
          .deleteFrom("Category")
          .where("id", "=", input.id)
          .where("businessId", "=", input.businessId)
          .execute();
      });
      return { success: true };
    }),
});
