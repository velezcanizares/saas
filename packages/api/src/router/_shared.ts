import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "@saasfly/db";
import type { BusinessRole } from "@saasfly/db";

/**
 * Tenant-scoping compartido por los routers del dominio (business, product,
 * sale, expense, ...).
 *
 * Convención de identidad: el `userId` que llega en el contexto tRPC es el id
 * de Clerk, y lo usamos directamente como `User.id` / `BusinessMember.userId` /
 * `Business.ownerId`. Como `relationMode = "prisma"` no hay FKs a nivel de DB,
 * así que operamos sobre ids sin necesidad de una tabla puente. `business.create`
 * hace upsert de la fila `User` para que los joins de nombres resuelvan.
 */

/** Roles que pueden gestionar catálogo, reportes y egresos. */
export const MANAGER_ROLES: BusinessRole[] = ["OWNER", "ADMIN"];
/** Roles que pueden registrar ventas en el POS. */
export const SELLER_ROLES: BusinessRole[] = ["OWNER", "ADMIN", "STAFF", "CASHIER"];

/**
 * Verifica que `userId` es miembro activo de `businessId`. Si `allowed` se pasa,
 * además exige que su rol esté en esa lista. Devuelve la membresía.
 */
export async function requireMembership(
  userId: string,
  businessId: string,
  allowed?: BusinessRole[],
) {
  const membership = await db
    .selectFrom("BusinessMember")
    .selectAll()
    .where("businessId", "=", businessId)
    .where("userId", "=", userId)
    .where("active", "=", true)
    .executeTakeFirst();

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes acceso a este negocio.",
    });
  }

  if (allowed && !allowed.includes(membership.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu rol no permite esta acción.",
    });
  }

  return membership;
}

// Validadores reutilizables ------------------------------------------------

/** Id de fila (uuid). */
export const cuid = z.string().min(1);

/** Monto en la unidad más chica de la moneda (CLP: pesos, entero, sin decimales). */
export const money = z.number().int().nonnegative();
