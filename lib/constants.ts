// Shared domain constants for CareersRX.

export const SITE_NAME = "CareersRX";
export const SITE_TAGLINE = "Update once. Choose where it syncs. Stay application-ready.";
export const SITE_DESCRIPTION =
  "CareersRX keeps professional profiles, live résumés, and application materials connected. Healthcare and senior care are the first verticals, with more industries to come.";

// First-vertical job categories tuned to healthcare and senior care
export const JOB_CATEGORIES = [
  "Nursing (RN/LPN)",
  "Certified Nursing Assistant (CNA)",
  "Caregiver / Resident Aide",
  "Memory Care",
  "Med Tech / Medication Aide",
  "Administration & Leadership",
  "Activities & Recreation",
  "Social Work",
  "Dietary & Culinary",
  "Housekeeping & Environmental Services",
  "Maintenance & Facilities",
  "Physical / Occupational Therapy",
  "Hospice & Palliative Care",
  "Sales & Marketing",
] as const;

// Geographic focus: southern US corridor, FL to CA
export const FOCUS_STATES = [
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "AL", name: "Alabama" },
  { code: "MS", name: "Mississippi" },
  { code: "LA", name: "Louisiana" },
  { code: "TX", name: "Texas" },
  { code: "NM", name: "New Mexico" },
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
] as const;

// All US states (for forms that need the full list)
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

// States that legally require salary disclosure in job postings
export const PAY_TRANSPARENCY_STATES = [
  "CA", "CO", "CT", "IL", "MD", "MN", "NV", "NY", "WA",
] as const;

export const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  PRN: "PRN",
  PER_DIEM: "Per diem",
  INTERNSHIP: "Internship",
  VOLUNTEER: "Volunteer",
};

export const SHIFT_LABELS: Record<string, string> = {
  DAY: "Day",
  EVENING: "Evening",
  NIGHT: "Night",
  OVERNIGHT: "Overnight",
  WEEKEND: "Weekend",
  HOLIDAY: "Holiday",
  ON_CALL: "On-call",
  FLEXIBLE: "Flexible",
};

export const FACILITY_TYPE_LABELS: Record<string, string> = {
  ASSISTED_LIVING: "Assisted Living",
  MEMORY_CARE: "Memory Care",
  SKILLED_NURSING: "Skilled Nursing",
  INDEPENDENT_LIVING: "Independent Living",
  HOME_HEALTH: "Home Health",
  HOSPICE: "Hospice",
  ADULT_DAY_CARE: "Adult Day Care",
  CCRC: "Continuing Care (CCRC)",
  OTHER: "Other",
};

export const PAY_TYPE_LABELS: Record<string, string> = {
  HOURLY: "/hr",
  ANNUAL: "/yr",
  PER_DIEM: "/day",
};

// Default EEO statement pre-populated on every job posting
export const DEFAULT_EEO_STATEMENT =
  "CareersRX employers are committed to equal employment opportunity. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, national origin, disability, veteran status, age, or any other protected class.";
