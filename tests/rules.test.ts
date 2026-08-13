import { describe, expect, it } from "vitest";
import { evaluateDeterministicRule } from "../lib/criteria/rules";

describe("deterministic criteria rules", () => {
  it("treats missing and skipped attestations as insufficient evidence", () => {
    const rule = { type: "attestation", questionKey: "rnLicense", expected: true } as const;
    expect(evaluateDeterministicRule(rule, {}).assessment).toBe("INSUFFICIENT_EVIDENCE");
    expect(evaluateDeterministicRule(rule, { attestations: { rnLicense: undefined } }).assessment).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });

  it("only emits NOT_SATISFIED for an explicit comparable value", () => {
    const rule = { type: "attestation", questionKey: "rnLicense", expected: true } as const;
    expect(evaluateDeterministicRule(rule, { attestations: { rnLicense: false } }).assessment).toBe("NOT_SATISFIED");
  });
});
