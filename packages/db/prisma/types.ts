import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type {
  SubscriptionPlan,
  BusinessRole,
  CategoryKind,
  ProductKind,
  PaymentMethod,
  SaleStatus,
  BoletaStatus,
} from "./enums";

export type Account = {
  id: Generated<string>;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};
export type Business = {
  id: Generated<string>;
  name: string;
  legalName: string | null;
  rut: string | null;
  currency: Generated<string>;
  timezone: Generated<string>;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  ownerId: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type BusinessMember = {
  id: Generated<string>;
  businessId: string;
  userId: string;
  role: Generated<BusinessRole>;
  active: Generated<boolean>;
  createdAt: Generated<Timestamp>;
};
export type Category = {
  id: Generated<string>;
  businessId: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  createdAt: Generated<Timestamp>;
};
export type Client = {
  id: Generated<string>;
  businessId: string;
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type Customer = {
  id: Generated<number>;
  authUserId: string;
  name: string | null;
  plan: SubscriptionPlan | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: Timestamp | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type Expense = {
  id: Generated<string>;
  businessId: string;
  categoryId: string | null;
  createdByUserId: string | null;
  description: string;
  amount: number;
  paymentMethod: Generated<PaymentMethod>;
  occurredAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type Product = {
  id: Generated<string>;
  businessId: string;
  categoryId: string | null;
  kind: Generated<ProductKind>;
  name: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  cost: number | null;
  trackStock: Generated<boolean>;
  stock: number | null;
  stockAlertAt: number | null;
  durationMinutes: number | null;
  active: Generated<boolean>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type Sale = {
  id: Generated<string>;
  businessId: string;
  clientId: string | null;
  soldByUserId: string | null;
  receiptNumber: number | null;
  subtotal: number;
  discount: Generated<number>;
  tax: Generated<number>;
  total: number;
  paymentMethod: PaymentMethod;
  status: Generated<SaleStatus>;
  boletaStatus: Generated<BoletaStatus>;
  boletaFolio: string | null;
  boletaUrl: string | null;
  notes: string | null;
  soldAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};
export type SaleItem = {
  id: Generated<string>;
  saleId: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
  discount: Generated<number>;
  total: number;
};
export type Session = {
  id: Generated<string>;
  sessionToken: string;
  userId: string;
  expires: Timestamp;
};
export type User = {
  id: Generated<string>;
  name: string | null;
  email: string | null;
  emailVerified: Timestamp | null;
  image: string | null;
};
export type VerificationToken = {
  identifier: string;
  token: string;
  expires: Timestamp;
};
export type DB = {
  Account: Account;
  Business: Business;
  BusinessMember: BusinessMember;
  Category: Category;
  Client: Client;
  Customer: Customer;
  Expense: Expense;
  Product: Product;
  Sale: Sale;
  SaleItem: SaleItem;
  Session: Session;
  User: User;
  VerificationToken: VerificationToken;
};
