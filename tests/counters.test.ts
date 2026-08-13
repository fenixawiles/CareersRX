import { describe, expect, it } from "vitest";
import { deriveCounters } from "../lib/evaluation/derive-counters";

describe("evaluation counters", () => {
  it("keeps a missing model finding distinct from insufficient evidence", () => {
    const counters = deriveCounters([
      { id: "license", disposition: "MANDATORY", finding: "SATISFIED" },
      { id: "experience", disposition: "MANDATORY", finding: "INSUFFICIENT_EVIDENCE" },
      { id: "mentoring", disposition: "PREFERRED" },
      { id: "leadership", disposition: "PREFERRED", finding: "REQUIRES_HUMAN_JUDGMENT" },
    ]);
    expect(counters.mandatorySatisfied).toEqual({ count: 1, criterionIds: ["license"] });
    expect(counters.unresolved).toEqual({ count: 1, criterionIds: ["experience"] });
    expect(counters.notEvaluated).toEqual({ count: 1, criterionIds: ["mentoring"] });
    expect(counters.humanReviewRequired).toEqual({ count: 1, criterionIds: ["leadership"] });
  });
});
