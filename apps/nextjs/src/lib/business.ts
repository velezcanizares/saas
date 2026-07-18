import "server-only";

import { cookies } from "next/headers";

import { trpc } from "~/trpc/server";
import type { RouterOutputs } from "~/trpc/server";

export type BusinessMembership = RouterOutputs["business"]["mine"][number];

/** Cookie que guarda el id del negocio activo (para cuentas con varios negocios). */
export const ACTIVE_BUSINESS_COOKIE = "activeBusinessId";

/** Todos los negocios del usuario actual (con su rol). */
export async function getBusinesses(): Promise<BusinessMembership[]> {
  return await trpc.business.mine.query();
}

/**
 * Negocio "activo" del usuario para las vistas del dashboard.
 *
 * Lee el id de la cookie `activeBusinessId` y lo valida contra los negocios del
 * usuario (una cookie manipulada simplemente cae al primero). Si no hay cookie,
 * usa el primero. Devuelve `null` si el usuario no tiene ningún negocio.
 */
export async function getActiveBusiness(): Promise<BusinessMembership | null> {
  const businesses = await getBusinesses();
  if (businesses.length === 0) return null;

  const selectedId = cookies().get(ACTIVE_BUSINESS_COOKIE)?.value;
  const selected = selectedId
    ? businesses.find((b) => b.id === selectedId)
    : undefined;
  return selected ?? businesses[0]!;
}
