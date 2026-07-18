/**
 * Formateo para el mercado chileno. Los montos vienen como enteros en la unidad
 * más chica de la moneda del negocio; para CLP eso es el peso (sin decimales).
 */

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const clpCompact = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formatea un monto entero como CLP, ej. 12000 → "$12.000". */
export function formatCLP(amount: number): string {
  return clp.format(amount ?? 0);
}

/** Versión compacta para tarjetas, ej. 1230000 → "$1,2 M". */
export function formatCLPCompact(amount: number): string {
  return clpCompact.format(amount ?? 0);
}

/** Formatea un porcentaje (0–1) como "42%". */
export function formatPct(ratio: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio ?? 0);
}

/** Formatea una fecha corta en español chileno, ej. "17 jul 2026". */
export function formatDateCL(input: Date | string | number): string {
  return new Date(input).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  WEBPAY: "Webpay",
  OTHER: "Otro",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}
