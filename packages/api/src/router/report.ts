import { z } from "zod";

import { db, sql } from "@saasfly/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MANAGER_ROLES, requireMembership } from "./_shared";

/**
 * Reportes para el dueño (OWNER/ADMIN). Todas las cifras consideran solo ventas
 * COMPLETED (excluye DRAFT/REFUNDED/CANCELLED). Los montos son enteros en la
 * unidad más chica de la moneda del negocio (CLP: pesos).
 *
 * Postgres devuelve SUM/COUNT como bigint (string en el driver pg), por eso
 * cada agregado se normaliza con `n()`.
 */
const n = (v: unknown): number => Number(v ?? 0);

const rangeInput = z.object({
  businessId: z.string().min(1),
  from: z.date().optional(),
  to: z.date().optional(),
});

export const reportRouter = createTRPCRouter({
  /** Resumen financiero del período: ingresos, costo, márgenes, egresos, utilidad. */
  summary: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to } = input;

      const sales = await db
        .selectFrom("Sale")
        .select([
          sql<string>`COALESCE(SUM("total"), 0)`.as("revenue"),
          sql<string>`COUNT(*)`.as("count"),
        ])
        .where("businessId", "=", businessId)
        .where("status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("soldAt", "<=", to!))
        .executeTakeFirst();

      const cogs = await db
        .selectFrom("SaleItem as si")
        .innerJoin("Sale as s", "s.id", "si.saleId")
        .select(sql<string>`COALESCE(SUM(si."unitCost" * si."quantity"), 0)`.as("cogs"))
        .where("s.businessId", "=", businessId)
        .where("s.status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("s.soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("s.soldAt", "<=", to!))
        .executeTakeFirst();

      const expenses = await db
        .selectFrom("Expense")
        .select(sql<string>`COALESCE(SUM("amount"), 0)`.as("total"))
        .where("businessId", "=", businessId)
        .$if(!!from, (qb) => qb.where("occurredAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("occurredAt", "<=", to!))
        .executeTakeFirst();

      const revenue = n(sales?.revenue);
      const salesCount = n(sales?.count);
      const costOfGoods = n(cogs?.cogs);
      const totalExpenses = n(expenses?.total);
      const grossProfit = revenue - costOfGoods; // margen bruto (ventas - costo mercadería)
      const netProfit = grossProfit - totalExpenses; // utilidad (bruto - egresos)

      return {
        revenue,
        costOfGoods,
        grossProfit,
        grossMarginPct: revenue > 0 ? grossProfit / revenue : 0,
        totalExpenses,
        netProfit,
        salesCount,
        avgTicket: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
      };
    }),

  /** Serie diaria de ventas (para gráficos), en la zona horaria del negocio. */
  salesByDay: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to } = input;

      const biz = await db
        .selectFrom("Business")
        .select("timezone")
        .where("id", "=", businessId)
        .executeTakeFirst();
      const tz = biz?.timezone ?? "America/Santiago";
      const dayExpr = sql<string>`to_char(("soldAt" AT TIME ZONE ${tz}), 'YYYY-MM-DD')`;

      const rows = await db
        .selectFrom("Sale")
        .select([
          dayExpr.as("day"),
          sql<string>`COALESCE(SUM("total"), 0)`.as("revenue"),
          sql<string>`COUNT(*)`.as("count"),
        ])
        .where("businessId", "=", businessId)
        .where("status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("soldAt", "<=", to!))
        // Agrupar/ordenar por posición ordinal: repetir `dayExpr` generaría un
        // placeholder distinto para el parámetro tz y Postgres no lo trataría
        // como la misma expresión que en el SELECT ("must appear in GROUP BY").
        .groupBy(sql`1`)
        .orderBy(sql`1`)
        .execute();

      return rows.map((r) => ({
        day: r.day,
        revenue: n(r.revenue),
        count: n(r.count),
      }));
    }),

  /** Ranking de productos/servicios por ingresos, con cantidad y margen. */
  topProducts: protectedProcedure
    .input(rangeInput.extend({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to, limit } = input;

      const rows = await db
        .selectFrom("SaleItem as si")
        .innerJoin("Sale as s", "s.id", "si.saleId")
        .select([
          "si.productId",
          sql<string>`MAX(si."productName")`.as("productName"),
          sql<string>`SUM(si."quantity")`.as("quantity"),
          sql<string>`SUM(si."total")`.as("revenue"),
          sql<string>`COALESCE(SUM(si."unitCost" * si."quantity"), 0)`.as("cost"),
        ])
        .where("s.businessId", "=", businessId)
        .where("s.status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("s.soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("s.soldAt", "<=", to!))
        .groupBy("si.productId")
        .orderBy(sql`SUM(si."total")`, "desc")
        .limit(limit)
        .execute();

      return rows.map((r) => {
        const revenue = n(r.revenue);
        const cost = n(r.cost);
        return {
          productId: r.productId,
          productName: r.productName,
          quantity: n(r.quantity),
          revenue,
          cost,
          margin: revenue - cost,
        };
      });
    }),

  /** Ingresos agrupados por categoría de producto/servicio. */
  salesByCategory: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to } = input;
      const catExpr = sql<string>`COALESCE(c."name", 'Sin categoría')`;

      const rows = await db
        .selectFrom("SaleItem as si")
        .innerJoin("Sale as s", "s.id", "si.saleId")
        .leftJoin("Product as p", "p.id", "si.productId")
        .leftJoin("Category as c", "c.id", "p.categoryId")
        .select([
          catExpr.as("category"),
          sql<string>`SUM(si."total")`.as("revenue"),
        ])
        .where("s.businessId", "=", businessId)
        .where("s.status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("s.soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("s.soldAt", "<=", to!))
        .groupBy(catExpr)
        .orderBy(sql`SUM(si."total")`, "desc")
        .execute();

      return rows.map((r) => ({ category: r.category, revenue: n(r.revenue) }));
    }),

  /** Ventas por método de pago (conteo e ingresos). */
  salesByPaymentMethod: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to } = input;

      const rows = await db
        .selectFrom("Sale")
        .select([
          "paymentMethod",
          sql<string>`COALESCE(SUM("total"), 0)`.as("revenue"),
          sql<string>`COUNT(*)`.as("count"),
        ])
        .where("businessId", "=", businessId)
        .where("status", "=", "COMPLETED")
        .$if(!!from, (qb) => qb.where("soldAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("soldAt", "<=", to!))
        .groupBy("paymentMethod")
        .orderBy(sql`SUM("total")`, "desc")
        .execute();

      return rows.map((r) => ({
        paymentMethod: r.paymentMethod,
        revenue: n(r.revenue),
        count: n(r.count),
      }));
    }),

  /** Egresos agrupados por categoría. */
  expensesByCategory: protectedProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      await requireMembership(ctx.userId, input.businessId, MANAGER_ROLES);
      const { businessId, from, to } = input;
      const catExpr = sql<string>`COALESCE(c."name", 'Sin categoría')`;

      const rows = await db
        .selectFrom("Expense as e")
        .leftJoin("Category as c", "c.id", "e.categoryId")
        .select([
          catExpr.as("category"),
          sql<string>`COALESCE(SUM(e."amount"), 0)`.as("total"),
        ])
        .where("e.businessId", "=", businessId)
        .$if(!!from, (qb) => qb.where("e.occurredAt", ">=", from!))
        .$if(!!to, (qb) => qb.where("e.occurredAt", "<=", to!))
        .groupBy(catExpr)
        .orderBy(sql`SUM(e."amount")`, "desc")
        .execute();

      return rows.map((r) => ({ category: r.category, total: n(r.total) }));
    }),
});
