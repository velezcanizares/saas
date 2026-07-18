import { env } from "../env.mjs";

/**
 * Cliente mínimo de Mercado Pago vía REST (sin SDK, para no sumar dependencias).
 * Se usa para el pago del cliente final en el POS (Checkout Pro / redirect).
 *
 * Requiere `MERCADO_PAGO_ACCESS_TOKEN`. Sin él, `isMercadoPagoEnabled()` es false
 * y las llamadas lanzan un error claro.
 */

const MP_API = "https://api.mercadopago.com";

export function isMercadoPagoEnabled(): boolean {
  return !!env.MERCADO_PAGO_ACCESS_TOKEN;
}

function accessToken(): string {
  const token = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN no está configurado.");
  }
  return token;
}

export interface PreferenceItem {
  title: string;
  quantity: number;
  unitPrice: number; // CLP entero
}

export interface CreatePreferenceInput {
  items: PreferenceItem[];
  externalReference: string; // id de la venta
  notificationUrl: string;
  backUrls: { success: string; failure: string; pending: string };
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

/** Crea una preferencia de Checkout Pro y devuelve el link de pago (init_point). */
export async function createPreference(
  input: CreatePreferenceInput,
): Promise<MercadoPagoPreference> {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items.map((it) => ({
        title: it.title,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        currency_id: "CLP",
      })),
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: input.backUrls,
      auto_return: "approved",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mercado Pago: error al crear la preferencia (${res.status}): ${detail}`);
  }
  return (await res.json()) as MercadoPagoPreference;
}

export interface MercadoPagoPayment {
  id: number;
  status: string; // "approved" | "pending" | "rejected" | ...
  external_reference: string | null;
}

/** Consulta un pago por id (para confirmar desde el webhook). */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) {
    throw new Error(`Mercado Pago: error al consultar el pago ${paymentId} (${res.status}).`);
  }
  return (await res.json()) as MercadoPagoPayment;
}
