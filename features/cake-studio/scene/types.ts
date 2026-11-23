/**
 * Types the 3D cake scene draws from (same as the ERP's resources/js/types/cake-studio.ts,
 * BUN-182). Kept identical so cakes look the same in the ERP and the storefront.
 */

/** How the 3D cake is drawn for a shape. */
export type CakeShapeModel = "round" | "square" | "heart";

/** How the 3D cake draws a finish, a topping or the writing. */
export type CakeFinishStyle = "smooth" | "piped" | "drip" | "ombre";
export type CakeToppingStyle =
  "fruit" | "sprinkles" | "macarons" | "pearls" | "candles" | "flowers" | "pieces";
export type CakeLetteringStyle = "script" | "bold";

/** One deck: width and height in scene units, bottom first. */
export type CakeTier = { width: number; height: number };
