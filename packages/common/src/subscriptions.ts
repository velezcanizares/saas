import { env } from "./env.mjs";

export interface SubscriptionPlan {
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: {
    monthly: number;
    yearly: number;
  };
  stripeIds: {
    monthly: string | null;
    yearly: string | null;
  };
}

// Planes de suscripción del SaaS (lo que se le cobra al dueño de la pyme).
// Precios en CLP (pesos chilenos, enteros). El plan anual incluye ~2 meses
// gratis respecto al mensual.
export const pricingData: SubscriptionPlan[] = [
  {
    title: "Gratis",
    description: "Para empezar",
    benefits: [
      "1 negocio",
      "Punto de venta (POS)",
      "Hasta 50 productos",
      "Reportes básicos de ventas",
      "1 usuario",
    ],
    limitations: [
      "Sin multiusuario ni roles",
      "Sin múltiples negocios",
      "Soporte por email",
    ],
    prices: {
      monthly: 0,
      yearly: 0,
    },
    stripeIds: {
      monthly: null,
      yearly: null,
    },
  },
  {
    title: "Pro",
    description: "Para tu negocio en marcha",
    benefits: [
      "Todo lo del plan Gratis",
      "Productos y ventas ilimitados",
      "Reportes completos (márgenes, top productos, egresos)",
      "Hasta 5 usuarios con roles",
      "Historial completo de ventas",
      "Soporte prioritario",
    ],
    limitations: ["Un solo negocio"],
    prices: {
      monthly: 14990,
      yearly: 149900,
    },
    stripeIds: {
      // @ts-ignore
      monthly: env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
      // @ts-ignore
      yearly: env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
    },
  },
  {
    title: "Business",
    description: "Para varias sucursales",
    benefits: [
      "Todo lo del plan Pro",
      "Múltiples negocios o sucursales",
      "Usuarios ilimitados",
      "Boleta electrónica SII (próximamente)",
      "Soporte prioritario dedicado",
    ],
    limitations: [],
    prices: {
      monthly: 29990,
      yearly: 299900,
    },
    stripeIds: {
      // @ts-ignore
      monthly: env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
      // @ts-ignore
      yearly: env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
    },
  },
];
