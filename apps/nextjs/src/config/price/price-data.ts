import { env } from "~/env.mjs";

interface SubscriptionPlanTranslation {
  id: string;
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

// Planes de la página de precios. Montos en CLP (pesos, enteros). Los locales no
// presentes caen a `en` en el componente de precios (pricing-cards). El copy en
// español es el primario (producto Chile-first).
export const priceDataMap: Record<string, SubscriptionPlanTranslation[]> = {
  es: [
    {
      id: "starter",
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
      id: "pro",
      title: "Pro",
      description: "Para tu negocio en marcha",
      benefits: [
        "Todo lo del plan Gratis",
        "Productos y ventas ilimitados",
        "Reportes completos: márgenes, top productos y egresos",
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
        monthly: env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
        yearly: env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
      },
    },
    {
      id: "business",
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
        monthly: env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
        yearly: env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
      },
    },
  ],
  en: [
    {
      id: "starter",
      title: "Free",
      description: "To get started",
      benefits: [
        "1 business",
        "Point of sale (POS)",
        "Up to 50 products",
        "Basic sales reports",
        "1 user",
      ],
      limitations: [
        "No multi-user or roles",
        "No multiple businesses",
        "Email support",
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
      id: "pro",
      title: "Pro",
      description: "For your growing business",
      benefits: [
        "Everything in Free",
        "Unlimited products and sales",
        "Full reports: margins, top products and expenses",
        "Up to 5 users with roles",
        "Complete sales history",
        "Priority support",
      ],
      limitations: ["Single business"],
      prices: {
        monthly: 14990,
        yearly: 149900,
      },
      stripeIds: {
        monthly: env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
        yearly: env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
      },
    },
    {
      id: "business",
      title: "Business",
      description: "For multiple locations",
      benefits: [
        "Everything in Pro",
        "Multiple businesses or locations",
        "Unlimited users",
        "SII electronic receipts (coming soon)",
        "Dedicated priority support",
      ],
      limitations: [],
      prices: {
        monthly: 29990,
        yearly: 299900,
      },
      stripeIds: {
        monthly: env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
        yearly: env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
      },
    },
  ],
};
