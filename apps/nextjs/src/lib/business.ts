import "server-only";

import { trpc } from "~/trpc/server";
import type { RouterOutputs } from "~/trpc/server";

export type BusinessMembership = RouterOutputs["business"]["mine"][number];

/**
 * Negocio "activo" del usuario para las vistas del dashboard.
 *
 * MVP: se toma el primer negocio del que el usuario es miembro. Cuando exista un
 * selector multi-negocio, este helper leerá el id elegido (cookie) y validará
 * la membresía; por ahora devuelve el primero o `null` si no tiene ninguno.
 */
export async function getActiveBusiness(): Promise<BusinessMembership | null> {
  const businesses = await trpc.business.mine.query();
  return businesses[0] ?? null;
}
