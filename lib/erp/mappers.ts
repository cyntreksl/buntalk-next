import "server-only";
import type {
  ErpBanner,
  ErpCategory,
  ErpCustomer,
  ErpOrder,
  ErpProduct,
  ErpScheme,
  ErpSku,
} from "./schemas";
import { isSkuVisible } from "./visibility";
import type { Banner, Category, Customer, Order, Product, Scheme, Sku } from "./types";

/** ERP wire types → storefront types. Pure functions, no I/O. */

const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

/** Only show a compare-at price when it is really higher than what the customer pays. */
function compareAt(selling: number, compare: number | null | undefined): number | undefined {
  return compare != null && compare > selling ? compare : undefined;
}

export function toCategory(c: ErpCategory): Category {
  return {
    id: c.link_id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    imageUrl: orUndefined(c.image_url),
    parentId: orUndefined(c.parent_link_id),
    sortOrder: c.sort_order,
  };
}

/** Main image first, then gallery images; anything that isn't a valid absolute URL is dropped. */
function productImages(p: ErpProduct): string[] {
  const urls = [p.image_url, ...p.gallery_urls].filter((u): u is string => Boolean(u));
  return [...new Set(urls)].filter((u) => URL.canParse(u) && /^https?:/.test(u));
}

export function toSku(s: ErpSku): Sku {
  return {
    id: s.link_id,
    code: s.code,
    options: s.options,
    price: s.price.selling_price,
    compareAtPrice: compareAt(s.price.selling_price, s.price.compare_at_price),
    inStock: s.in_stock ?? true,
  };
}

export function toProduct(p: ErpProduct): Product {
  return {
    id: p.link_id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    price: p.price.selling_price,
    compareAtPrice: compareAt(p.price.selling_price, p.price.compare_at_price),
    printedPrice: orUndefined(p.price.printed_price),
    currency: p.price.currency,
    categorySlug: p.category.slug,
    featured: p.is_featured,
    code: p.code,
    imageUrls: productImages(p),
    attributes: p.attributes.filter((a) => a.values.length > 0),
    processingTimeHours: orUndefined(p.processing_time_hours),
    skus: p.skus.filter(isSkuVisible).map(toSku),
  };
}

export function toBanner(b: ErpBanner): Banner {
  return {
    id: b.link_id,
    title: b.title,
    subtitle: orUndefined(b.subtitle),
    ctaLabel: b.cta_label,
    href: b.href,
    imageUrl: orUndefined(b.image_url),
    imageAlt: orUndefined(b.image_alt),
  };
}

export function toScheme(s: ErpScheme): Scheme {
  return {
    id: s.link_id,
    name: s.name,
    kind: s.kind,
    rewardValue: s.reward_value,
    minSpend: orUndefined(s.min_spend),
    startsAt: orUndefined(s.starts_at),
    endsAt: orUndefined(s.ends_at),
    productIds: s.product_ids,
    categoryIds: s.category_ids,
  };
}

export function toCustomer(c: ErpCustomer): Customer {
  return {
    id: c.link_id,
    code: c.code,
    name: c.name,
    phone: orUndefined(c.phone),
    email: orUndefined(c.email),
  };
}

export function toOrder(o: ErpOrder): Order {
  return {
    id: o.link_id,
    number: o.number,
    status: o.status,
    placedAt: o.placed_at,
    currency: o.currency,
    customerId: orUndefined(o.customer_link_id),
    lines: o.lines.map((l) => ({
      skuId: l.sku_link_id,
      productName: l.product_name,
      skuLabel: orUndefined(l.sku_label),
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discount: l.discount,
      lineTotal: l.line_total,
    })),
    subtotal: o.subtotal,
    discountTotal: o.discount_total,
    deliveryFee: o.delivery_fee,
    total: o.total,
  };
}
