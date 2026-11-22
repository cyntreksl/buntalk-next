import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Guards the order operations endpoints (retry queue, problem orders) with
 * `Authorization: Bearer <ORDERS_OPS_SECRET>`. Returns an error response, or
 * null when the request may continue.
 */
export function checkOpsAuth(request: Request): Response | null {
  const secret = serverEnv().ORDERS_OPS_SECRET;
  if (!secret) {
    return Response.json({ error: "Order operations are not configured" }, { status: 503 });
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
