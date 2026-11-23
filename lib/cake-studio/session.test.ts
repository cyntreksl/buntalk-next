import { describe, expect, it } from "vitest";
import { readEmbedMessage } from "./messages";
import { signEmbedSession, verifyEmbedSession } from "./session";

const secret = "test-secret-at-least-16";
const now = Date.parse("2026-11-23T10:00:00Z");
const session = {
  v: 1 as const,
  origin: "https://buntalk.lk",
  exp: now / 1000 + 1800,
  preselect: { product_id: "p-cake", size_id: 4 },
};

describe("embed session", () => {
  it("round-trips a signed session", () => {
    const token = signEmbedSession(session, secret);
    expect(verifyEmbedSession(token, secret, now)).toEqual({ ok: true, session });
  });

  it("refuses a changed payload, a wrong secret and an expired session", () => {
    const token = signEmbedSession(session, secret);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...session, origin: "https://evil.example" }),
    ).toString("base64url");
    expect(verifyEmbedSession(`${forged}.${sig}`, secret, now)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(verifyEmbedSession(token, "another-secret-16-chars", now).ok).toBe(false);
    expect(verifyEmbedSession(token, secret, now + 31 * 60 * 1000)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(verifyEmbedSession(`${payload}`, secret, now)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("messages from the embed", () => {
  const frame = {};
  const allowed = { origin: "https://erp.example.com", frame };
  const msg = (data: unknown, origin = allowed.origin, source: unknown = frame) => ({
    origin,
    source,
    data,
  });

  it("accepts known messages from the ERP origin and our own iframe", () => {
    expect(
      readEmbedMessage(
        msg({ source: "buntalk-cake-studio", type: "resize", height: 1200 }),
        allowed,
      ),
    ).toEqual({ source: "buntalk-cake-studio", type: "resize", height: 1200 });
    expect(
      readEmbedMessage(
        msg({ source: "buntalk-cake-studio", type: "saved", design_id: "d-1", total: "4750.00" }),
        allowed,
      ),
    ).toMatchObject({ type: "saved", design_id: "d-1", total: 4750 });
  });

  it("ignores other origins, other windows and unknown shapes", () => {
    const ready = { source: "buntalk-cake-studio", type: "ready" };
    expect(readEmbedMessage(msg(ready, "https://evil.example"), allowed)).toBeNull();
    expect(readEmbedMessage(msg(ready, allowed.origin, {}), allowed)).toBeNull();
    expect(readEmbedMessage(msg({ type: "ready" }), allowed)).toBeNull();
    expect(
      readEmbedMessage(msg({ source: "buntalk-cake-studio", type: "resize", height: 5 }), allowed),
    ).toBeNull();
    expect(
      readEmbedMessage(
        msg({ source: "buntalk-cake-studio", type: "saved", design_id: "../x", total: 1 }),
        allowed,
      ),
    ).toBeNull();
  });
});
