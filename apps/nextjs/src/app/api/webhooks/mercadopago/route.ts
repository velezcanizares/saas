import { NextResponse, type NextRequest } from "next/server";

import { db } from "@saasfly/db";

import { env } from "~/env.mjs";

/**
 * Webhook de Mercado Pago. Recibe la notificación de un pago, lo confirma
 * consultando la API de MP y, si está aprobado, marca la venta (creada como
 * DRAFT por `payment.createCheckout`) como COMPLETED y descuenta el stock.
 *
 * Es idempotente: la venta se completa con un UPDATE ... WHERE status = 'DRAFT',
 * así que reintentos de MP no descuentan stock dos veces.
 */
const handler = async (req: NextRequest) => {
  const token = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    // Integración deshabilitada: respondemos 200 para que MP no reintente.
    return NextResponse.json({ ignored: "mp disabled" }, { status: 200 });
  }

  try {
    // MP manda el id del pago por query (?type=payment&data.id=...) o en el body.
    const url = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      data?: { id?: string | number };
      action?: string;
    };
    const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const paymentId =
      body.data?.id ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");

    if (type !== "payment" || !paymentId) {
      return NextResponse.json({ ignored: "not a payment event" }, { status: 200 });
    }

    // Confirmar el pago consultando la API de MP (fuente de verdad).
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "payment lookup failed" }, { status: 200 });
    }
    const payment = (await res.json()) as {
      status: string;
      external_reference: string | null;
    };

    const saleId = payment.external_reference;
    if (payment.status !== "approved" || !saleId) {
      return NextResponse.json({ ok: true, status: payment.status }, { status: 200 });
    }

    await db.transaction().execute(async (trx) => {
      // Claim atómico: solo completa si sigue en DRAFT (evita doble descuento).
      const claim = await trx
        .updateTable("Sale")
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where("id", "=", saleId)
        .where("status", "=", "DRAFT")
        .executeTakeFirst();

      if (!claim.numUpdatedRows || Number(claim.numUpdatedRows) === 0) {
        return; // ya procesada o no existe
      }

      const lines = await trx
        .selectFrom("SaleItem as si")
        .innerJoin("Product as p", "p.id", "si.productId")
        .select(["si.productId", "si.quantity", "p.stock"])
        .where("si.saleId", "=", saleId)
        .where("p.trackStock", "=", true)
        .execute();

      const agg = new Map<string, { stock: number; qty: number }>();
      for (const l of lines) {
        if (!l.productId) continue;
        const a = agg.get(l.productId) ?? { stock: l.stock ?? 0, qty: 0 };
        a.qty += l.quantity;
        agg.set(l.productId, a);
      }
      for (const [pid, { stock, qty }] of agg) {
        await trx
          .updateTable("Product")
          .set({ stock: Math.max(0, stock - qty), updatedAt: new Date() })
          .where("id", "=", pid)
          .execute();
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`❌ Error en webhook Mercado Pago: ${message}`);
    // 200 para evitar reintentos infinitos ante errores no recuperables.
    return NextResponse.json({ error: message }, { status: 200 });
  }
};

export { handler as GET, handler as POST };
