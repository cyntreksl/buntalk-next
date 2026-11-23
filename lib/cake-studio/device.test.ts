import { describe, expect, it } from "vitest";
import { SLOW_FRAME_MS, startMode, tooSlow, WATCH_FRAMES } from "./device";

const phone = { webgl: true, cores: 8, memoryGb: 4, connection: "4g" };

describe("startMode (BUN-185)", () => {
  it("starts in 3D on a capable device", () => {
    expect(startMode(phone)).toEqual({ mode: "3d", why: null });
    // Browsers that don't report memory or the connection (Safari, Firefox).
    expect(startMode({ webgl: true, cores: 4 })).toEqual({ mode: "3d", why: null });
  });

  it("always draws the cake without WebGL, even if 3D was chosen before", () => {
    expect(startMode({ ...phone, webgl: false }, "3d")).toEqual({ mode: "2d", why: "no_webgl" });
  });

  it("starts with the drawing on budget devices and slow or data-saving connections", () => {
    expect(startMode({ ...phone, cores: 2 })).toMatchObject({ why: "low_end" });
    expect(startMode({ ...phone, memoryGb: 1 })).toMatchObject({ why: "low_end" });
    expect(startMode({ ...phone, memoryGb: 2 })).toMatchObject({ mode: "3d" });
    expect(startMode({ ...phone, saveData: true })).toMatchObject({ why: "slow_connection" });
    expect(startMode({ ...phone, connection: "2g" })).toMatchObject({ why: "slow_connection" });
    expect(startMode({ ...phone, connection: "3g" })).toMatchObject({ mode: "3d" });
  });

  it("keeps the customer's own choice", () => {
    expect(startMode({ ...phone, cores: 2 }, "3d")).toEqual({ mode: "3d", why: null });
    expect(startMode(phone, "2d")).toEqual({ mode: "2d", why: "chosen" });
  });
});

describe("tooSlow", () => {
  const frames = (ms: number, n = WATCH_FRAMES) => Array.from({ length: n }, () => ms);

  it("is slow when the typical frame takes over 60 ms", () => {
    expect(tooSlow(frames(16))).toBe(false);
    expect(tooSlow(frames(SLOW_FRAME_MS + 20))).toBe(true);
    // A few long frames (loading, a hiccup) don't count.
    expect(tooSlow([...frames(16, 50), ...frames(400, 10)])).toBe(false);
  });

  it("doesn't decide on too few frames", () => {
    expect(tooSlow(frames(200, 10))).toBe(false);
  });
});
