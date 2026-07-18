import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getCurrentUser } from "@saasfly/auth";
import { db } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MANAGER_ROLES, requireMembership } from "./_shared";

const createBusinessSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  legalName: z.string().optional(),
  rut: z.string().optional(),
  currency: z.string().default("CLP"),
  timezone: z.string().default("America/Santiago"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const updateBusinessSchema = createBusinessSchema.partial().extend({
  businessId: z.string().min(1),
});

export const businessRouter = createTRPCRouter({
  /** Negocios a los que pertenece el usuario actual, con su rol. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;
    return await db
      .selectFrom("BusinessMember as m")
      .innerJoin("Business as b", "b.id", "m.businessId")
      .select([
        "b.id",
        "b.name",
        "b.legalName",
        "b.rut",
        "b.currency",
        "b.timezone",
        "b.logoUrl",
        "m.role",
        "b.createdAt",
      ])
      .where("m.userId", "=", userId)
      .where("m.active", "=", true)
      .orderBy("b.createdAt", "asc")
      .execute();
  }),

  /** Detalle de un negocio (requiere ser miembro). */
  byId: protectedProcedure
    .input(z.object({ businessId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId);
      return await db
        .selectFrom("Business")
        .selectAll()
        .where("id", "=", input.businessId)
        .executeTakeFirst();
    }),

  /**
   * Crea un negocio y deja al usuario actual como OWNER. Hace upsert de la fila
   * `User` (id = Clerk userId) para que los joins de nombres resuelvan.
   */
  create: protectedProcedure
    .input(createBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const user = await getCurrentUser();

      return await db.transaction().execute(async (trx) => {
        // Upsert del User dueño (no hay FK a nivel DB, pero lo necesitamos
        // para joins de nombre en ventas/reportes).
        await trx
          .insertInto("User")
          .values({
            id: userId,
            name: user?.name ?? null,
            email: user?.email ?? null,
          })
          .onConflict((oc) => oc.column("id").doNothing())
          .execute();

        const business = await trx
          .insertInto("Business")
          .values({
            name: input.name,
            legalName: input.legalName ?? null,
            rut: input.rut ?? null,
            currency: input.currency,
            timezone: input.timezone,
            address: input.address ?? null,
            phone: input.phone ?? null,
            ownerId: userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("BusinessMember")
          .values({
            businessId: business.id,
            userId,
            role: "OWNER",
            active: true,
          })
          .execute();

        return business;
      });
    }),

  /** Actualiza datos del negocio (solo OWNER/ADMIN). */
  update: protectedProcedure
    .input(updateBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);

      const { businessId, ...rest } = input;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(patch).length === 0) {
        return { success: true };
      }

      await db
        .updateTable("Business")
        .set({ ...patch, updatedAt: new Date() })
        .where("id", "=", businessId)
        .execute();
      return { success: true };
    }),

  /**
   * Elimina el negocio y todo su dominio (solo OWNER).
   *
   * `relationMode = "prisma"` no crea FKs reales en la DB, así que el
   * `onDelete: Cascade` del schema NO aplica a queries Kysely. Borramos los
   * hijos manualmente y en orden dentro de una transacción.
   */
  delete: protectedProcedure
    .input(z.object({ businessId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { businessId } = input;
      const membership = await requireMembership(
        ctx.userId,
        businessId,
        MANAGER_ROLES,
      );
      if (membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el dueño puede eliminar el negocio.",
        });
      }

      await db.transaction().execute(async (trx) => {
        await trx
          .deleteFrom("SaleItem")
          .where("saleId", "in", (qb) =>
            qb
              .selectFrom("Sale")
              .select("id")
              .where("businessId", "=", businessId),
          )
          .execute();
        await trx.deleteFrom("Sale").where("businessId", "=", businessId).execute();
        await trx
          .deleteFrom("Expense")
          .where("businessId", "=", businessId)
          .execute();
        await trx
          .deleteFrom("Product")
          .where("businessId", "=", businessId)
          .execute();
        await trx
          .deleteFrom("Category")
          .where("businessId", "=", businessId)
          .execute();
        await trx
          .deleteFrom("Client")
          .where("businessId", "=", businessId)
          .execute();
        await trx
          .deleteFrom("BusinessMember")
          .where("businessId", "=", businessId)
          .execute();
        await trx.deleteFrom("Business").where("id", "=", businessId).execute();
      });
      return { success: true };
    }),
});
