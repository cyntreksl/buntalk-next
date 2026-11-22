import { describe, expect, it } from "vitest";
import { statusLabel, statusTimeline } from "./status";
import { signPayload, verifySignature } from "@/lib/webhooks/signature";

describe("statusLabel", () => {
  it("uses customer words that depend on delivery or pickup", () => {
    expect(statusLabel(null, "delivery").title).toBe("Order received");
    expect(statusLabel("preparing", "delivery").title).toBe("Being prepared");
    expect(statusLabel("ready", "pickup").title).toBe("Ready to collect");
    expect(statusLabel("ready", "delivery").title).toBe("Ready for delivery");
    expect(statusLabel("dispatched", "delivery").title).toBe("Out for delivery");
    expect(statusLabel("completed", "delivery").title).toBe("Delivered");
    expect(statusLabel("completed", "pickup").title).toBe("Collected");
    expect(statusLabel("cancelled", "pickup").title).toBe("Cancelled");
  });
});

describe("statusTimeline", () => {
  const states = (s: ReturnType<typeof statusTimeline>) => s.map((x) => `${x.title}:${x.state}`);

  it("shows done, current and upcoming steps for a delivery", () => {
    expect(states(statusTimeline("preparing", "delivery"))).toEqual([
      "Order received:done",
      "Order confirmed:done",
      "Being prepared:current",
      "Ready for delivery:upcoming",
      "Out for delivery:upcoming",
      "Delivered:upcoming",
    ]);
  });

  it("has no 'Out for delivery' step for pickup, and marks the last step done when finished", () => {
    expect(states(statusTimeline("completed", "pickup"))).toEqual([
      "Order received:done",
      "Order confirmed:done",
      "Being prepared:done",
      "Ready to collect:done",
      "Collected:done",
    ]);
  });

  it("shows the steps reached before a cancellation, then Cancelled", () => {
    expect(states(statusTimeline("cancelled", "delivery", "confirmed"))).toEqual([
      "Order received:done",
      "Order confirmed:done",
      "Cancelled:current",
    ]);
  });
});

describe("webhook signature", () => {
  const secret = "test-webhook-secret-123";
  const body = '{"event":"order.status_changed"}';
  const now = 1_795_000_000;

  it("accepts a correctly signed, recent request", () => {
    expect(verifySignature(secret, body, signPayload(secret, body, now), now + 10)).toEqual({
      ok: true,
    });
  });

  it("refuses a changed body, a wrong secret, an old timestamp or no signature", () => {
    const header = signPayload(secret, body, now);
    expect(verifySignature(secret, body + " ", header, now).ok).toBe(false);
    expect(verifySignature("another-secret-12345", body, header, now).ok).toBe(false);
    expect(verifySignature(secret, body, header, now + 6 * 60).ok).toBe(false);
    expect(verifySignature(secret, body, null, now).ok).toBe(false);
    expect(verifySignature(secret, body, "garbage", now).ok).toBe(false);
  });
});
