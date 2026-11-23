import { z } from "zod";

/**
 * Messages between the storefront and the embedded ERP Cake Studio
 * (BUN-180, ERP ticket BUN-261). Usable in the browser.
 *
 * ERP → storefront: { source: "buntalk-cake-studio", type, … }
 * storefront → ERP: { source: "buntalk-storefront", type, … }, always sent to
 * the ERP's origin, never "*".
 */

export const EMBED_SOURCE = "buntalk-cake-studio";
export const STOREFRONT_SOURCE = "buntalk-storefront";

const summary = z.array(z.object({ label: z.string(), value: z.string() })).max(20);
const money = z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number()]).transform(Number);

export const embedMessageSchema = z.discriminatedUnion("type", [
  z.object({ source: z.literal(EMBED_SOURCE), type: z.literal("ready") }),
  z.object({
    source: z.literal(EMBED_SOURCE),
    type: z.literal("resize"),
    height: z.number().int().min(200).max(10_000),
  }),
  z.object({
    source: z.literal(EMBED_SOURCE),
    type: z.literal("design"),
    total: money,
    summary: summary.optional(),
  }),
  z.object({
    source: z.literal(EMBED_SOURCE),
    type: z.literal("saved"),
    design_id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
    total: money,
    summary: summary.default([]),
    preview_url: z
      .string()
      .regex(/^https:\/\//)
      .max(500)
      .optional(),
  }),
  z.object({
    source: z.literal(EMBED_SOURCE),
    type: z.literal("error"),
    message: z.string().max(300),
  }),
]);
export type EmbedMessage = z.infer<typeof embedMessageSchema>;

/**
 * The message, if it really comes from the embedded Cake Studio: the right
 * origin, our own iframe, and a known shape. Anything else is ignored.
 */
export function readEmbedMessage(
  event: { origin: string; source: unknown; data: unknown },
  allowed: { origin: string; frame: unknown },
): EmbedMessage | null {
  if (event.origin !== allowed.origin) return null;
  if (allowed.frame && event.source !== allowed.frame) return null;
  const parsed = embedMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : null;
}
