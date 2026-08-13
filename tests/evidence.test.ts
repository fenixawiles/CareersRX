import { describe, expect, it } from "vitest";
import { assessmentAfterEvidence, verifyEvidence } from "../lib/evaluation/evidence-verify";
import { explanationSentence } from "../lib/evaluation/explain";

describe("evidence verification", () => {
  it("does not let negated evidence support satisfaction", () => {
    const text = "I am not CPR certified.";
    const verified = verifyEvidence(
      { resume: { summary: text } },
      { snapshotField: "resume.summary", excerpt: "CPR certified", charStart: 9, charEnd: 22, claimPolarity: "SUPPORTS" },
    );
    expect(verified?.claimPolarity).toBe("AMBIGUOUS");
    expect(assessmentAfterEvidence("SATISFIED", verified ? [verified] : [])).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("never turns human-review flags into applicant deficiencies", () => {
    expect(explanationSentence({ criterion: "leadership", assessment: "REQUIRES_HUMAN_JUDGMENT" })).toBeNull();
    expect(explanationSentence({ criterion: "leadership", assessment: "INSUFFICIENT_EVIDENCE" })).toContain(
      "did not establish",
    );
  });

  it("admits protected evidence only for documented registry templates and marks it for auditing", () => {
    const text = "Date of birth: 1980";
    const candidate = {
      snapshotField: "profile.summary",
      excerpt: text,
      charStart: 0,
      charEnd: text.length,
      claimPolarity: "SUPPORTS" as const,
    };
    expect(verifyEvidence({ profile: { summary: text } }, candidate)).toBeNull();
    expect(verifyEvidence({ profile: { summary: text } }, candidate, { ruleTemplateId: "LICENSE_ATTESTATION" })).toBeNull();
    expect(
      verifyEvidence({ profile: { summary: text } }, candidate, { ruleTemplateId: "LEGAL_MINIMUM_AGE" })
        ?.protectedContentAdmittedUnderTemplate,
    ).toBe(true);
  });
});
