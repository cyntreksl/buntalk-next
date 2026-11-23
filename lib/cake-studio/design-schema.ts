import { z } from "zod";

/**
 * A Cake Studio design: the picks the customer made, with the ERP's ids
 * (the ERP's CakeDesignRequest). Plain data, safe in the browser: the
 * designer's draft (BUN-183) is checked with it, and lib/erp uses it for
 * quotes and saved designs.
 */
const id = z.number().int().positive();

export const cakeDesignSchema = z.object({
  size_id: id,
  tier_count: z.number().int().min(1).max(5).nullable().optional(),
  deck_heights: z.array(z.number().int().min(1).max(60)).max(5).nullable().optional(),
  shape_id: id,
  sponge_id: id,
  filling_id: id.nullable().optional(),
  frosting_id: id,
  finish_id: id,
  drip_id: id.nullable().optional(),
  topping_ids: z.array(id).max(20).nullable().optional(),
  candle_count: z.number().int().min(1).max(200).nullable().optional(),
  /** eggless | less_sugar | number_topper | photo_print */
  extras: z.array(z.string().max(30)).max(10).nullable().optional(),
  topper_number: z.string().max(3).nullable().optional(),
  message: z.string().max(120).nullable().optional(),
  lettering_id: id.nullable().optional(),
  writing_colour_id: id.nullable().optional(),
  occasion_id: id.nullable().optional(),
});
export type CakeDesign = z.infer<typeof cakeDesignSchema>;
