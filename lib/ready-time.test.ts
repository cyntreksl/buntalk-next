import { describe, expect, it } from "vitest";
import { earliestReadyLabel } from "./ready-time";

// 22 Nov 2026, 10:00 in Colombo (UTC+5:30).
const now = new Date("2026-11-22T04:30:00Z");

describe("earliestReadyLabel", () => {
  it("shows today with a time when ready the same day", () => {
    expect(earliestReadyLabel(3, now)).toMatch(/^today, from about 1:00\s?pm$/);
  });

  it("shows tomorrow when it crosses midnight in Colombo", () => {
    expect(earliestReadyLabel(16, now)).toMatch(/^tomorrow, from about 2:00\s?am$/);
  });

  it("shows the date for two days or more", () => {
    expect(earliestReadyLabel(48, now)).toMatch(/^on Tue,? 24 Nov$/);
  });

  it("uses the store's time zone, not UTC", () => {
    // 23:00 in Colombo is still 22 Nov there but 17:30 UTC; +2 h is 01:00 on the 23rd.
    const late = new Date("2026-11-22T17:30:00Z");
    expect(earliestReadyLabel(2, late)).toMatch(/^tomorrow/);
  });
});
