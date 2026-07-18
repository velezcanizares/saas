export const SubscriptionPlan = {
  FREE: "FREE",
  PRO: "PRO",
  BUSINESS: "BUSINESS",
} as const;
export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];
export const BusinessRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  CASHIER: "CASHIER",
} as const;
export type BusinessRole = (typeof BusinessRole)[keyof typeof BusinessRole];
export const CategoryKind = {
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
  EXPENSE: "EXPENSE",
} as const;
export type CategoryKind = (typeof CategoryKind)[keyof typeof CategoryKind];
export const ProductKind = {
  GOOD: "GOOD",
  SERVICE: "SERVICE",
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];
export const PaymentMethod = {
  CASH: "CASH",
  CARD: "CARD",
  TRANSFER: "TRANSFER",
  MERCADO_PAGO: "MERCADO_PAGO",
  WEBPAY: "WEBPAY",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const SaleStatus = {
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];
export const BoletaStatus = {
  NOT_ISSUED: "NOT_ISSUED",
  PENDING: "PENDING",
  ISSUED: "ISSUED",
  REJECTED: "REJECTED",
} as const;
export type BoletaStatus = (typeof BoletaStatus)[keyof typeof BoletaStatus];
