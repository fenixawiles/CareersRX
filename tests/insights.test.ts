import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/db/sql", () => ({ queryFile: vi.fn() }));

import { queryFile } from "../lib/db/sql";
import { aggregateApplicantInsights } from "../lib/insights/aggregate";
import { deidentifiedDecisionExport } from "../lib/analytics/decisions";

const query = vi.mocked(queryFile);

describe("released explanation aggregates", () => {
  beforeEach(() => query.mockReset());

  it("derives applicant insights only from released explanation bodies", () => {
    query.mockReturnValue([
      { body_json: JSON.stringify({ decision: "DO_NOT_ADVANCE", reasonCategory: "POSITION_CLOSED" }) },
      { body_json: JSON.stringify({ decision: "ADVANCE", reasonCategory: null }) },
      { body_json: "not json" },
    ]);
    expect(aggregateApplicantInsights("test.sqlite", "seeker")).toEqual(expect.objectContaining({
      releasedDecisionCount: 3,
      reasons: [{ reasonCategory: "POSITION_CLOSED", count: 1 }],
    }));
    expect(query).toHaveBeenCalledWith(
      "test.sqlite",
      expect.stringContaining("FROM applicant_explanations"),
      ["seeker"],
    );
  });

  it("suppresses small cohorts in a de-identified analytics export", () => {
    query.mockReturnValue(Array.from({ length: 10 }, () => ({ body_json: JSON.stringify({ decision: "DO_NOT_ADVANCE", reasonCategory: "ROLE_FILLED" }) })));
    expect(deidentifiedDecisionExport("test.sqlite", "company")).toEqual([{ reasonCategory: "ROLE_FILLED", count: 10 }]);
  });
});
