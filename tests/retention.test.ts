import { describe, expect, it } from "vitest";
import { retentionCutoff } from "../lib/retention/policy";

describe("retention policy", () => {
  it("enforces the 36-month retention floor", () => {
    expect(retentionCutoff(12, new Date("2026-08-13T00:00:00.000Z"))).toBe("2023-08-13T00:00:00.000Z");
  });
});
