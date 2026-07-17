/**
 * Seed de datos de demo para desarrollo local.
 *
 * Idempotente: se puede correr múltiples veces sin duplicar filas (usa
 * ON CONFLICT DO NOTHING con IDs fijos).
 *
 * Escenario: "Barbería El Corte Fino", una barbería/peluquería chilena
 * con 2 usuarios (dueño + staff), catálogo de servicios y productos,
 * clientes, ventas de las últimas 2 semanas y algunos egresos.
 *
 * Uso:
 *   cd packages/db && bun run db:seed
 */

import { db } from "..";
import type {
  BusinessRole,
  CategoryKind,
  PaymentMethod,
  ProductKind,
  SaleStatus,
} from "..";

// IDs fijos (idempotencia). Prefijo "seed-" para identificarlos en la DB.
const BIZ = "seed-biz-corte-fino";
const OWNER = "seed-user-owner";
const STAFF = "seed-user-staff";

const CAT_CORTES = "seed-cat-cortes";
const CAT_BARBA = "seed-cat-barba";
const CAT_PRODUCTOS = "seed-cat-productos";
const CAT_EXP_STAFF = "seed-cat-exp-staff";
const CAT_EXP_INSUMOS = "seed-cat-exp-insumos";
const CAT_EXP_ARRIENDO = "seed-cat-exp-arriendo";

// Helpers ------------------------------------------------------------------

const now = new Date();
function daysAgo(n: number, hour = 12, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Log tiempo por bloque (útil si algo se pega en red).
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const result = await fn();
  console.log(`  ✓ ${label} (${Date.now() - t0}ms)`);
  return result;
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const users = [
  { id: OWNER, name: "Mario (dueño demo)", email: "demo-owner@saas.local" },
  { id: STAFF, name: "Pedro (staff demo)", email: "demo-staff@saas.local" },
];

const business = {
  id: BIZ,
  name: "Barbería El Corte Fino",
  legalName: "El Corte Fino SpA",
  rut: "76.123.456-7",
  currency: "CLP",
  timezone: "America/Santiago",
  address: "Av. Providencia 1234, Providencia, Santiago",
  phone: "+56 9 1234 5678",
  ownerId: OWNER,
};

const members = [
  { id: "seed-mem-owner", businessId: BIZ, userId: OWNER, role: "OWNER" as BusinessRole },
  { id: "seed-mem-staff", businessId: BIZ, userId: STAFF, role: "STAFF" as BusinessRole },
];

const categories = [
  { id: CAT_CORTES, businessId: BIZ, name: "Cortes", kind: "SERVICE" as CategoryKind, color: "#4F46E5" },
  { id: CAT_BARBA, businessId: BIZ, name: "Barba", kind: "SERVICE" as CategoryKind, color: "#059669" },
  { id: CAT_PRODUCTOS, businessId: BIZ, name: "Productos", kind: "PRODUCT" as CategoryKind, color: "#DC2626" },
  { id: CAT_EXP_STAFF, businessId: BIZ, name: "Sueldos", kind: "EXPENSE" as CategoryKind, color: "#F59E0B" },
  { id: CAT_EXP_INSUMOS, businessId: BIZ, name: "Insumos", kind: "EXPENSE" as CategoryKind, color: "#8B5CF6" },
  { id: CAT_EXP_ARRIENDO, businessId: BIZ, name: "Arriendo y servicios", kind: "EXPENSE" as CategoryKind, color: "#6B7280" },
];

// Precios en CLP (unidad = peso, sin decimales).
const products = [
  // Servicios (kind SERVICE, sin stock)
  { id: "seed-prod-corte-clasico", categoryId: CAT_CORTES, kind: "SERVICE" as ProductKind, name: "Corte clásico", price: 12000, cost: 0, durationMinutes: 30 },
  { id: "seed-prod-corte-degradado", categoryId: CAT_CORTES, kind: "SERVICE" as ProductKind, name: "Corte + degradado", price: 15000, cost: 0, durationMinutes: 45 },
  { id: "seed-prod-corte-nino", categoryId: CAT_CORTES, kind: "SERVICE" as ProductKind, name: "Corte infantil", price: 9000, cost: 0, durationMinutes: 25 },
  { id: "seed-prod-barba", categoryId: CAT_BARBA, kind: "SERVICE" as ProductKind, name: "Perfilado de barba", price: 8000, cost: 0, durationMinutes: 20 },
  { id: "seed-prod-barba-full", categoryId: CAT_BARBA, kind: "SERVICE" as ProductKind, name: "Barba completa (afeitado navaja)", price: 12000, cost: 0, durationMinutes: 30 },
  { id: "seed-prod-combo", categoryId: CAT_CORTES, kind: "SERVICE" as ProductKind, name: "Combo corte + barba", price: 22000, cost: 0, durationMinutes: 50 },
  // Bienes (kind GOOD, con stock)
  { id: "seed-prod-cera", categoryId: CAT_PRODUCTOS, kind: "GOOD" as ProductKind, name: "Cera moldeadora 100g", price: 8500, cost: 4200, sku: "CER-100", trackStock: true, stock: 24, stockAlertAt: 5 },
  { id: "seed-prod-shampoo", categoryId: CAT_PRODUCTOS, kind: "GOOD" as ProductKind, name: "Shampoo anticaída 250ml", price: 12000, cost: 6500, sku: "SHA-250", trackStock: true, stock: 12, stockAlertAt: 3 },
  { id: "seed-prod-aceite", categoryId: CAT_PRODUCTOS, kind: "GOOD" as ProductKind, name: "Aceite para barba 30ml", price: 9500, cost: 4800, sku: "ACE-030", trackStock: true, stock: 18, stockAlertAt: 5 },
  { id: "seed-prod-peine", categoryId: CAT_PRODUCTOS, kind: "GOOD" as ProductKind, name: "Peine de madera", price: 4500, cost: 2000, sku: "PEI-01", trackStock: true, stock: 8, stockAlertAt: 3 },
];

const clients = [
  { id: "seed-cli-1", name: "Juan Pérez", rut: "12.345.678-9", email: "juan.perez@example.cl", phone: "+56 9 8765 4321" },
  { id: "seed-cli-2", name: "María González", rut: "18.234.567-1", email: "maria.g@example.cl", phone: "+56 9 5555 1122" },
  { id: "seed-cli-3", name: "Carlos Rojas", rut: "9.876.543-2", email: null, phone: "+56 9 3333 4444" },
  { id: "seed-cli-4", name: "Ana Muñoz", rut: null, email: "ana.m@example.cl", phone: "+56 9 7777 8888" },
  { id: "seed-cli-5", name: "Luis Sepúlveda", rut: "16.888.999-K", email: null, phone: null },
  { id: "seed-cli-6", name: "Camila Torres", rut: "20.111.222-3", email: "camila.t@example.cl", phone: "+56 9 2222 3333" },
];

// Ventas de las últimas 2 semanas. Cada venta lista sus items por productId
// junto con cantidad y método de pago.
type ItemRef = { productId: string; qty: number };
type SeedSale = {
  id: string;
  clientId: string | null;
  soldByUserId: string;
  paymentMethod: PaymentMethod;
  soldAt: Date;
  status: SaleStatus;
  items: ItemRef[];
  discount?: number;
};

const sales: SeedSale[] = [
  // Semana pasada
  { id: "seed-sale-01", clientId: "seed-cli-1", soldByUserId: STAFF, paymentMethod: "CARD", soldAt: daysAgo(13, 10, 15), status: "COMPLETED", items: [{ productId: "seed-prod-corte-clasico", qty: 1 }] },
  { id: "seed-sale-02", clientId: "seed-cli-2", soldByUserId: OWNER, paymentMethod: "CASH", soldAt: daysAgo(13, 15, 30), status: "COMPLETED", items: [{ productId: "seed-prod-combo", qty: 1 }] },
  { id: "seed-sale-03", clientId: null,          soldByUserId: STAFF, paymentMethod: "CASH", soldAt: daysAgo(12, 11, 20), status: "COMPLETED", items: [{ productId: "seed-prod-corte-nino", qty: 1 }, { productId: "seed-prod-cera", qty: 1 }] },
  { id: "seed-sale-04", clientId: "seed-cli-3", soldByUserId: STAFF, paymentMethod: "TRANSFER", soldAt: daysAgo(11, 17, 45), status: "COMPLETED", items: [{ productId: "seed-prod-corte-degradado", qty: 1 }, { productId: "seed-prod-shampoo", qty: 1 }] },
  { id: "seed-sale-05", clientId: "seed-cli-4", soldByUserId: OWNER, paymentMethod: "CARD", soldAt: daysAgo(10, 12, 0), status: "COMPLETED", items: [{ productId: "seed-prod-barba-full", qty: 1 }] },
  { id: "seed-sale-06", clientId: null,          soldByUserId: STAFF, paymentMethod: "CARD", soldAt: daysAgo(10, 19, 0), status: "COMPLETED", items: [{ productId: "seed-prod-corte-clasico", qty: 1 }, { productId: "seed-prod-barba", qty: 1 }] },
  { id: "seed-sale-07", clientId: "seed-cli-5", soldByUserId: OWNER, paymentMethod: "CARD", soldAt: daysAgo(9, 14, 30), status: "COMPLETED", items: [{ productId: "seed-prod-combo", qty: 1 }, { productId: "seed-prod-aceite", qty: 1 }] },
  // Esta semana
  { id: "seed-sale-08", clientId: "seed-cli-6", soldByUserId: STAFF, paymentMethod: "CARD", soldAt: daysAgo(6, 11, 15), status: "COMPLETED", items: [{ productId: "seed-prod-corte-degradado", qty: 1 }] },
  { id: "seed-sale-09", clientId: null,          soldByUserId: STAFF, paymentMethod: "CASH", soldAt: daysAgo(6, 18, 30), status: "COMPLETED", items: [{ productId: "seed-prod-corte-clasico", qty: 1 }] },
  { id: "seed-sale-10", clientId: "seed-cli-1", soldByUserId: OWNER, paymentMethod: "CARD", soldAt: daysAgo(5, 13, 0), status: "COMPLETED", items: [{ productId: "seed-prod-combo", qty: 1 }] },
  { id: "seed-sale-11", clientId: "seed-cli-2", soldByUserId: STAFF, paymentMethod: "TRANSFER", soldAt: daysAgo(4, 16, 0), status: "COMPLETED", items: [{ productId: "seed-prod-corte-nino", qty: 2 }, { productId: "seed-prod-cera", qty: 1 }] },
  { id: "seed-sale-12", clientId: "seed-cli-3", soldByUserId: OWNER, paymentMethod: "CARD", soldAt: daysAgo(3, 10, 45), status: "COMPLETED", items: [{ productId: "seed-prod-barba", qty: 1 }, { productId: "seed-prod-aceite", qty: 1 }] },
  { id: "seed-sale-13", clientId: null,          soldByUserId: STAFF, paymentMethod: "CARD", soldAt: daysAgo(2, 12, 30), status: "COMPLETED", items: [{ productId: "seed-prod-corte-clasico", qty: 1 }, { productId: "seed-prod-peine", qty: 1 }], discount: 500 },
  { id: "seed-sale-14", clientId: "seed-cli-4", soldByUserId: OWNER, paymentMethod: "CARD", soldAt: daysAgo(1, 15, 0), status: "COMPLETED", items: [{ productId: "seed-prod-combo", qty: 1 }, { productId: "seed-prod-shampoo", qty: 1 }] },
  { id: "seed-sale-15", clientId: "seed-cli-6", soldByUserId: STAFF, paymentMethod: "CASH", soldAt: daysAgo(0, 11, 0), status: "COMPLETED", items: [{ productId: "seed-prod-corte-degradado", qty: 1 }] },
];

const expenses = [
  { id: "seed-exp-01", categoryId: CAT_EXP_ARRIENDO, description: "Arriendo local", amount: 650000, paymentMethod: "TRANSFER" as PaymentMethod, occurredAt: daysAgo(13, 9, 0) },
  { id: "seed-exp-02", categoryId: CAT_EXP_ARRIENDO, description: "Cuenta luz",     amount: 48000,  paymentMethod: "TRANSFER" as PaymentMethod, occurredAt: daysAgo(11, 10, 0) },
  { id: "seed-exp-03", categoryId: CAT_EXP_INSUMOS,  description: "Compra cera (24 unid.)", amount: 100800, paymentMethod: "TRANSFER" as PaymentMethod, occurredAt: daysAgo(10, 14, 0) },
  { id: "seed-exp-04", categoryId: CAT_EXP_INSUMOS,  description: "Shampoo profesional", amount: 78000, paymentMethod: "CARD" as PaymentMethod, occurredAt: daysAgo(8, 11, 0) },
  { id: "seed-exp-05", categoryId: CAT_EXP_ARRIENDO, description: "Internet mensual", amount: 22000, paymentMethod: "TRANSFER" as PaymentMethod, occurredAt: daysAgo(7, 12, 0) },
  { id: "seed-exp-06", categoryId: CAT_EXP_STAFF,    description: "Adelanto sueldo Pedro", amount: 200000, paymentMethod: "TRANSFER" as PaymentMethod, occurredAt: daysAgo(5, 16, 0) },
  { id: "seed-exp-07", categoryId: CAT_EXP_INSUMOS,  description: "Aceite para barba (18 unid.)", amount: 86400, paymentMethod: "CASH" as PaymentMethod, occurredAt: daysAgo(3, 15, 0) },
  { id: "seed-exp-08", categoryId: CAT_EXP_INSUMOS,  description: "Toallas nuevas", amount: 45000, paymentMethod: "CARD" as PaymentMethod, occurredAt: daysAgo(2, 18, 30) },
];

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

const productById = new Map(products.map((p) => [p.id, p]));

async function main() {
  console.log("→ Seed demo data en Supabase\n");

  await step("Users", async () => {
    for (const u of users) {
      await db
        .insertInto("User")
        .values(u)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  await step("Business", async () => {
    await db
      .insertInto("Business")
      .values(business)
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();
  });

  await step("BusinessMembers", async () => {
    for (const m of members) {
      await db
        .insertInto("BusinessMember")
        .values(m)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  await step("Categories", async () => {
    for (const c of categories) {
      await db
        .insertInto("Category")
        .values(c)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  await step("Products", async () => {
    for (const p of products) {
      await db
        .insertInto("Product")
        .values({ ...p, businessId: BIZ })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  await step("Clients", async () => {
    for (const c of clients) {
      await db
        .insertInto("Client")
        .values({ ...c, businessId: BIZ })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  await step(`Sales + SaleItems (${sales.length} ventas)`, async () => {
    for (const s of sales) {
      // Calcular totales desde los items usando snapshot de precio actual.
      const items = s.items.map((it) => {
        const p = productById.get(it.productId);
        if (!p) throw new Error(`Producto no encontrado en seed: ${it.productId}`);
        const total = p.price * it.qty;
        return {
          id: `${s.id}-item-${it.productId}`,
          saleId: s.id,
          productId: it.productId,
          productName: p.name,
          unitPrice: p.price,
          unitCost: p.cost ?? null,
          quantity: it.qty,
          total,
        };
      });
      const subtotal = items.reduce((sum, it) => sum + it.total, 0);
      const discount = s.discount ?? 0;
      const total = subtotal - discount;

      await db
        .insertInto("Sale")
        .values({
          id: s.id,
          businessId: BIZ,
          clientId: s.clientId,
          soldByUserId: s.soldByUserId,
          subtotal,
          discount,
          tax: 0,
          total,
          paymentMethod: s.paymentMethod,
          status: s.status,
          soldAt: s.soldAt,
        })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();

      for (const it of items) {
        await db
          .insertInto("SaleItem")
          .values(it)
          .onConflict((oc) => oc.column("id").doNothing())
          .execute();
      }
    }
  });

  await step(`Expenses (${expenses.length})`, async () => {
    for (const e of expenses) {
      await db
        .insertInto("Expense")
        .values({ ...e, businessId: BIZ, createdByUserId: OWNER })
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }
  });

  // Resumen
  console.log("\n✓ Seed listo\n");
  console.log(`   Business:  ${business.name} (${business.rut})`);
  console.log(`   Users:     ${users.length}  Products: ${products.length}  Clients: ${clients.length}`);
  console.log(`   Ventas:    ${sales.length}    Egresos:  ${expenses.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Seed falló:", err);
    process.exit(1);
  });
