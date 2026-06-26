// Feature flags — prevent UI from exposing unavailable functionality.
// Flip to true as each capability is implemented in later phases.
export const FEATURES = {
  SAVED_SEARCH_ALERTS: false, // email alerts for saved searches — deferred
  BILLING_UI: false, // billing plan selection UI — deferred
  RESUME_PARSING: false, // auto-parse resume into profile — deferred
  JOB_RECOMMENDATIONS: false, // recommendation engine — deferred
} as const;
