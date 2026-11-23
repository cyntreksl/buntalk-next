import { describe, expect, it } from "vitest";
import { passwordChecks, passwordProblem } from "./password";
import { usernameProblem } from "./username";

describe("password rules (BUN-187)", () => {
  it("accepts a password with a letter and a number, or a long passphrase", () => {
    expect(passwordProblem("Rose-garden-42")).toBeNull();
    expect(passwordProblem("kottu roti at midnight")).toBeNull(); // 16+ characters, no number
    expect(passwordProblem("ගෙදර2024කේක්")).toBeNull(); // letters in any script
  });

  it("explains the first rule a password breaks", () => {
    expect(passwordProblem("ab1")).toMatch(/at least 8/);
    expect(passwordProblem("abcdefgh")).toMatch(/one letter and one number/);
    expect(passwordProblem("Password123")).toMatch(/too common/);
    expect(passwordProblem("nimal-2024", { email: "Nimal@example.test" })).toMatch(
      /email or username/,
    );
    expect(passwordProblem("x1".repeat(65))).toMatch(/at most 128/);
  });

  it("ticks the rules off for the checklist", () => {
    expect(passwordChecks("").every((c) => !c.ok)).toBe(true);
    expect(passwordChecks("Rose-garden-42", { username: "nimal" }).every((c) => c.ok)).toBe(true);
  });
});

describe("username rules", () => {
  it("allows 3 to 30 letters, numbers, dots and underscores", () => {
    expect(usernameProblem("nimal.p")).toBeNull();
    expect(usernameProblem("Nimal_2024")).toBeNull();
    expect(usernameProblem("ab")).toMatch(/at least 3/);
    expect(usernameProblem(".nimal")).toMatch(/starting with a letter/);
    expect(usernameProblem("nimal perera")).toMatch(/letters, numbers/);
    expect(usernameProblem("a".repeat(31))).toMatch(/at most 30/);
  });
});
