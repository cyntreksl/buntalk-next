import "server-only";
import { ErpNotFoundError } from "./errors";
import { erpGet, erpRequest } from "./http";
import { erpCustomerSchema, erpOrderSchema, one } from "./schemas";
import { toCustomer, toOrder } from "./mappers";
import type { Customer, Order } from "./types";

/**
 * ERP writes for orders (BUN-164). Contract: docs/erp-api-contract.md,
 * "Order (POST /orders)". Both calls send an Idempotency-Key, so a retry
 * after a timeout never creates a second customer or order in the ERP.
 * Writes are never retried inside the HTTP client; the order retry queue
 * (lib/orders) decides when to try again.
 */

export type ErpOrderLineInput = {
  productId: string;
  skuId?: string;
  quantity: number;
  /** The storefront's priced values, for the ERP to check against its own. */
  unitPrice: number;
  discount: number;
  lineTotal: number;
  schemeIds: string[];
};

export type ErpOrderInput = {
  storefrontOrderId: string;
  storefrontOrderNumber: string;
  customerId: string;
  fulfilment:
    | {
        type: "delivery";
        address: { line1: string; line2?: string; city: string; notes?: string };
        date?: string;
        slot?: string;
      }
    | { type: "pickup"; outletId: string; date?: string; slot?: string };
  lines: ErpOrderLineInput[];
  appliedSchemeIds: string[];
  currency: string;
  /** Expected totals. The ERP re-prices and answers 409 if they differ. */
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  payment: { method: string; status: string; reference?: string };
  note?: string;
};

const money = (n: number) => n.toFixed(2);

/** Finds the customer by phone (then email) or creates one, tagged as a storefront customer. */
export async function matchOrCreateCustomer(
  customer: { name: string; phone: string; email?: string },
  idempotencyKey: string,
): Promise<Customer> {
  const { data } = await erpRequest({
    method: "POST",
    path: "/customers",
    schema: one(erpCustomerSchema),
    idempotencyKey,
    body: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? null,
      source: "storefront",
    },
  });
  return toCustomer(data);
}

/** Places the order in the ERP. The same idempotency key always returns the same ERP order. */
export async function createOrder(input: ErpOrderInput, idempotencyKey: string): Promise<Order> {
  const { data } = await erpRequest({
    method: "POST",
    path: "/orders",
    schema: one(erpOrderSchema),
    idempotencyKey,
    body: {
      storefront_order_id: input.storefrontOrderId,
      storefront_order_number: input.storefrontOrderNumber,
      customer_link_id: input.customerId,
      channel: "online",
      fulfilment:
        input.fulfilment.type === "delivery"
          ? {
              type: "delivery",
              address: input.fulfilment.address,
              date: input.fulfilment.date ?? null,
              slot: input.fulfilment.slot ?? null,
            }
          : {
              type: "pickup",
              outlet_link_id: input.fulfilment.outletId,
              date: input.fulfilment.date ?? null,
              slot: input.fulfilment.slot ?? null,
            },
      lines: input.lines.map((l) => ({
        product_link_id: l.productId,
        sku_link_id: l.skuId ?? null,
        quantity: l.quantity,
        unit_price: money(l.unitPrice),
        discount: money(l.discount),
        line_total: money(l.lineTotal),
        scheme_ids: l.schemeIds,
      })),
      applied_scheme_ids: input.appliedSchemeIds,
      currency: input.currency,
      subtotal: money(input.subtotal),
      discount_total: money(input.discountTotal),
      delivery_fee: money(input.deliveryFee),
      total: money(input.total),
      payment: input.payment,
      note: input.note ?? null,
    },
  });
  return toOrder(data);
}

/**
 * Reads one order from the ERP (live, never cached): its current status.
 * Returns null if the ERP doesn't know the order.
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const { data } = await erpGet(`/orders/${encodeURIComponent(orderId)}`, one(erpOrderSchema));
    return toOrder(data);
  } catch (error) {
    if (error instanceof ErpNotFoundError) return null;
    throw error;
  }
}

export type ErpCustomerProfile = {
  name: string;
  phone: string;
  email?: string;
  addresses: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    notes?: string;
    isDefault: boolean;
  }[];
};

/**
 * Replaces the customer's storefront-managed details in the ERP (BUN-166):
 * name, phone, email and saved addresses. A full replace, so sending the
 * same version twice is harmless. ERP answers: 409 when the phone or email
 * belongs to another ERP customer; 404 when the customer no longer exists
 * (e.g. merged); then the storefront links again by phone.
 */
export async function updateCustomer(
  customerId: string,
  profile: ErpCustomerProfile,
  idempotencyKey: string,
): Promise<Customer> {
  const { data } = await erpRequest({
    method: "PUT",
    path: `/customers/${encodeURIComponent(customerId)}`,
    schema: one(erpCustomerSchema),
    idempotencyKey,
    body: {
      name: profile.name,
      phone: profile.phone,
      email: profile.email ?? null,
      addresses: profile.addresses.map((a) => ({
        label: a.label ?? null,
        line1: a.line1,
        line2: a.line2 ?? null,
        city: a.city,
        notes: a.notes ?? null,
        is_default: a.isDefault,
      })),
      source: "storefront",
    },
  });
  return toCustomer(data);
}
