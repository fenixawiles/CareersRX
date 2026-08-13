import { describe, expect, it } from "vitest";
import { assessmentAfterEvidence, verifyEvidence } from "../lib/evaluation/evidence-verify";
import { buildApplicantExplanation, explanationSentence, renderApplicantExplanation } from "../lib/evaluation/explain";

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

  it("writes applicant-safe explanations only from eligible cited facts", () => {
    const explanation = buildApplicantExplanation({
      decision: "DO_NOT_ADVANCE",
      reasonCategory: "MANDATORY_CRITERION_NOT_MET",
      findings: [
        { criterion: "active license", disposition: "MANDATORY", origin: "DETERMINISTIC_RULE", assessment: "NOT_SATISFIED" },
        { criterion: "leadership", disposition: "PREFERRED", origin: "MODEL", assessment: "INSUFFICIENT_EVIDENCE" },
        { criterion: "pregnancy status", disposition: "MANDATORY", origin: "DETERMINISTIC_RULE", assessment: "NOT_SATISFIED" },
      ],
    });
    expect(explanation.reasons).toEqual(["The application did not meet the posted mandatory requirement for active license."]);
    const rendered = renderApplicantExplanation(explanation);
    expect(rendered).not.toMatch(/model|pregnancy/i);
    expect(rendered).toContain("It does not use a score, ranking, prediction, or automated hiring decision.");
  });
});
