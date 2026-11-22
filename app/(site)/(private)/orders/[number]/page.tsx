import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { and, asc, eq } from "drizzle-orm";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui";
import { AutoRefresh } from "@/features/orders/AutoRefresh";
import { OrderStatusCard } from "@/features/orders/OrderStatusCard";
import { getDb } from "@/lib/db";
import { orderEvents, orders } from "@/lib/db/schema";
import { refreshStatusIfStale } from "@/lib/orders";
import { FINAL_STATUSES, type ErpOrderStatus } from "@/lib/orders/status";
import { formatPrice } from "@/lib/utils";

/**
 * Order tracking page: /orders/{number}?token={access token} (BUN-165).
 *
 * Works without signing in: the link (returned when the order is placed and
 * sent in the confirmation, BUN-202) carries the order's secret access
 * token, so only the person who placed it can open it. A missing or wrong
 * token shows the not-found screen and sends no order data. (The page
 * streams, so per the Next.js docs the HTTP status stays 200 with a noindex
 * tag.) Dynamic and private (never cached, Cache-Control: private).
 *
 * The status comes from the storefront database, kept in step with the ERP
 * by webhook and polling; if it's more than a minute old, it is re-checked
 * with the ERP before rendering. While the order is open, the page refreshes
 * itself every 30 seconds.
 */

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

// A per-visitor page: nothing to prerender, so skip Next's dev-time "instant
// navigation" check (same as the product and category pages).
export const instant = false;

const placedFormat = new Intl.DateTimeFormat("en-LK", {
  timeZone: "Asia/Colombo",
  dateStyle: "medium",
  timeStyle: "short",
});

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function OrderDetails({ params, searchParams }: PageProps<"/orders/[number]">) {
  // Per-request page: the status check uses the current time (new Date()).
  await connection();
  const [{ number }, { token }] = await Promise.all([params, searchParams]);
  if (typeof token !== "string") notFound();

  const db = await getDb();
  const [found] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!found || !sameToken(found.accessToken, token)) notFound();

  const order = await refreshStatusIfStale(db, found);
  const open = order.status === null || !FINAL_STATUSES.has(order.status);

  // For a cancelled order: the last step it reached before being cancelled.
  let reachedBeforeCancel: ErpOrderStatus | null = null;
  if (order.status === "cancelled") {
    const events = await db
      .select({ data: orderEvents.data })
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.type, "status")))
      .orderBy(asc(orderEvents.createdAt));
    const last = events.at(-1)?.data as { from?: ErpOrderStatus } | null;
    reachedBeforeCancel = last?.from ?? null;
  }

  const money = (n: number) => formatPrice(n, order.currency);
  const f = order.fulfilment;

  return (
    <>
      <AutoRefresh active={open} />
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${placedFormat.format(order.createdAt)}${order.erpOrderNumber ? ` · Reference ${order.erpOrderNumber}` : ""}`}
      />
      <OrderStatusCard
        status={order.status}
        type={f.type}
        changedAt={order.statusChangedAt}
        reachedBeforeCancel={reachedBeforeCancel}
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="order-items" className="flex flex-col gap-3">
          <h2 id="order-items" className="text-h3">
            Items
          </h2>
          <ul className="divide-border border-border divide-y border-y">
            {order.lines.map((line) => (
              <li
                key={`${line.productSlug}:${line.skuId ?? ""}`}
                className="flex justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{line.name}</span>
                  {line.variant && <span className="text-muted-foreground"> ({line.variant})</span>}
                  <span className="text-muted-foreground"> × {line.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold">{money(line.lineSubtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 self-end sm:w-72">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            {order.appliedSchemes.map((s) => (
              <div key={s.id} className="text-success flex justify-between">
                <dt>{s.name}</dt>
                <dd>−{money(s.discount)}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{order.deliveryFee > 0 ? money(order.deliveryFee) : "Free"}</dd>
            </div>
            <div className="border-border text-body-lg flex justify-between border-t pt-2 font-bold">
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <aside
          aria-labelledby="order-fulfilment"
          className="bg-surface-muted flex flex-col gap-2 self-start rounded-2xl p-5"
        >
          <h2 id="order-fulfilment" className="text-h4">
            {f.type === "delivery" ? "Delivery" : "Pickup"}
          </h2>
          {f.type === "delivery" ? (
            <address className="text-body-sm not-italic">
              {f.address.line1}
              {f.address.line2 && <>, {f.address.line2}</>}
              <br />
              {f.address.city}
            </address>
          ) : (
            <p className="text-body-sm">From your chosen outlet</p>
          )}
          {(f.date || f.slot) && (
            <p className="text-body-sm text-muted-foreground">
              {[f.date, f.slot].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="text-body-sm text-muted-foreground">
            Payment: {order.payment.method === "cash_on_delivery" ? "Cash on delivery" : "Card"}
          </p>
        </aside>
      </div>
    </>
  );
}

export default function OrderPage(props: PageProps<"/orders/[number]">) {
  return (
    <Container width="content" className="flex flex-col gap-6 py-8 md:py-12">
      <Suspense
        fallback={
          <div role="status" className="flex flex-col gap-4">
            <span className="sr-only">Loading your order…</span>
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <OrderDetails {...props} />
      </Suspense>
    </Container>
  );
}
