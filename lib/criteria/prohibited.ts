import "server-only";

/**
 * Structured criteria may assess job-related qualifications, not protected traits or their common
 * stand-ins. This intentionally operates on all author-authored text and rule JSON before it is
 * persisted, so future evaluators never need to interpret unsafe criteria.
 */
const prohibitedPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(race|racial|ethnicity|ethnic|color)\b/i, label: "race or ethnicity" },
  { pattern: /\b(religion|religious|faith|church|mosque|synagogue|christian|muslim|jewish|hindu|buddhist|sikh|atheist)\b/i, label: "religion" },
  { pattern: /\b(gender|sex|pregnan(?:t|cy)|sexual orientation|lgbtq?|transgender)\b/i, label: "sex, gender, or sexual orientation" },
  { pattern: /\b(national(?:ity| origin)|citizenship|native language|accent)\b/i, label: "national origin" },
  { pattern: /\b(disab(?:ility|led)|medical condition|health condition|genetic)\b/i, label: "disability or genetic information" },
  { pattern: /\b(marital status|married|single|divorc(?:ed|e)|family status|children)\b/i, label: "marital or family status" },
  { pattern: /\b(zip code|postcode|neighbou?rhood|commute distance|home ownership)\b/i, label: "a protected-trait proxy" },
  { pattern: /\b(arrest record|criminal history|conviction history)\b/i, label: "a protected-trait proxy" },
  // Age proxies. Direct age requirements route through the LEGAL_MINIMUM_AGE template check in
  // authoring; these catch the softer stand-ins that imply an age preference.
  { pattern: /\b(young|youthful|energetic|digital native|recent graduate|new grad|older worker|overqualified)\b/i, label: "an age proxy" },
];

export type ProhibitedCriterion = { label: string };

export function findProhibitedCriterion(values: Array<string | undefined | null>): ProhibitedCriterion | null {
  const text = values.filter((value): value is string => typeof value === "string").join("\n");
  for (const item of prohibitedPatterns) {
    if (item.pattern.test(text)) return { label: item.label };
  }
  return null;
}
