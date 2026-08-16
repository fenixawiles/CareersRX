import "server-only";

import { randomUUID } from "node:crypto";
import { query, queryOne, run, tx } from "@/lib/db/sql";
import type {
  SandboxAuditEntry,
  SandboxNamedResumeVersion,
  SandboxProfile,
  SandboxProposal,
  SandboxProposalScope,
  SandboxProposalStatus,
  SandboxResume,
  SandboxResumeImport,
  SandboxResumeImportApplyMode,
  SandboxResumeImportIntent,
  SandboxResumeImportReview,
  SandboxResumeSection,
  SandboxResumeVersionStatus,
  SandboxRevision,
  SandboxSignupInput,
  SandboxSnapshot,
} from "@/lib/sandbox-types";

/**
 * The live-résumé workspace on Postgres. Profile facts and editable sections are relational rows;
 * revision history stores whole-résumé JSONB snapshots because revisions are restored and compared
 * as documents. Workspaces are keyed by user id (formerly `sandboxId`; the parameter names keep the
 * old word so the 11 route callers read unchanged).
 */

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringArray(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

// ── Section templates ─────────────────────────────────────────────────────────

const SECTION_ORDER: SandboxResumeSection["id"][] = ["summary", "experience", "credentials", "skills", "preferences"];

const SECTION_TEMPLATES: Record<SandboxResumeSection["id"], { title: string; helper: string }> = {
  summary: {
    title: "Professional Summary",
    helper: "Write a short positioning statement. Applying this can update profile summary/headline.",
  },
  experience: {
    title: "Experience",
    helper: "Draft role bullets here. Wording can stay résumé-only unless it implies profile facts.",
  },
  credentials: {
    title: "Credentials",
    helper: "List licenses, certifications, degrees, or clearances. Applying this updates profile credentials.",
  },
  skills: {
    title: "Skills",
    helper: "Separate skills with commas, bullets, new lines, or dots. Applying this updates profile skills.",
  },
  preferences: {
    title: "Role Preferences",
    helper: "Add target roles or locations. Applying this updates job preferences.",
  },
};

function blankProfile(): SandboxProfile {
  return {
    email: "",
    fullName: "",
    headline: "",
    location: "",
    summary: "",
    experience: "",
    skills: [],
    credentials: [],
    preferences: { roles: [], locations: [] },
    updatedAt: now(),
  };
}

function profileFromSignup(input: SandboxSignupInput): SandboxProfile {
  return {
    email: input.email.trim(),
    fullName: input.fullName.trim(),
    headline: input.headline.trim(),
    location: input.location.trim(),
    summary: input.summary.trim(),
    experience: input.experience.trim(),
    skills: input.skills.map((skill) => skill.trim()).filter(Boolean),
    credentials: input.credentials.map((credential) => credential.trim()).filter(Boolean),
    preferences: {
      roles: input.preferredRoles.map((role) => role.trim()).filter(Boolean),
      locations: input.preferredLocations.map((location) => location.trim()).filter(Boolean),
    },
    updatedAt: now(),
  };
}

function sectionContentFromProfile(profile: SandboxProfile): Record<SandboxResumeSection["id"], string> {
  return {
    summary: profile.summary,
    experience: profile.experience,
    credentials: profile.credentials.join("\n"),
    skills: profile.skills.join(" · "),
    preferences: [
      profile.preferences.roles.length > 0 ? `Roles:\n${profile.preferences.roles.join("\n")}` : "",
      profile.preferences.locations.length > 0 ? `Locations:\n${profile.preferences.locations.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function resumeFromProfile(profile: SandboxProfile): SandboxResume {
  const content = sectionContentFromProfile(profile);
  return {
    title: profile.fullName ? `${profile.fullName} — Live Résumé` : "Untitled Live Résumé",
    targetRole: profile.headline,
    updatedAt: now(),
    sections: SECTION_ORDER.map((id) => ({
      id,
      title: SECTION_TEMPLATES[id].title,
      helper: SECTION_TEMPLATES[id].helper,
      content: content[id],
      syncStatus: content[id] ? "SYNCED" : "BLANK",
    })),
  };
}

function blankResume(): SandboxResume {
  return {
    title: "Untitled Live Résumé",
    targetRole: "",
    updatedAt: now(),
    sections: SECTION_ORDER.map((id) => ({
      id,
      title: SECTION_TEMPLATES[id].title,
      helper: SECTION_TEMPLATES[id].helper,
      content: "",
      syncStatus: "BLANK",
    })),
  };
}

function normalizeResume(resume: Partial<SandboxResume>, profile: SandboxProfile): SandboxResume {
  const fallback = resumeFromProfile(profile);
  const existingSections = Array.isArray(resume.sections) ? resume.sections : [];
  return {
    ...fallback,
    ...resume,
    title: typeof resume.title === "string" ? resume.title : fallback.title,
    targetRole: typeof resume.targetRole === "string" ? resume.targetRole : fallback.targetRole,
    sections: fallback.sections.map((fallbackSection) => {
      const existing = existingSections.find((section) => section.id === fallbackSection.id);
      return existing
        ? {
            ...fallbackSection,
            ...existing,
            content: typeof existing.content === "string" ? existing.content : fallbackSection.content,
          }
        : fallbackSection;
    }),
    updatedAt: typeof resume.updatedAt === "string" ? resume.updatedAt : fallback.updatedAt,
  };
}

function mapResumeFromJson(value: unknown) {
  return normalizeResume(parseJson<Partial<SandboxResume>>(value, {}), blankProfile());
}

// ── Workspace bootstrap and state access ─────────────────────────────────────

async function writeProfileRow(userId: string, profile: SandboxProfile) {
  await run(
    `INSERT INTO seeker_profiles (user_id, email, full_name, headline, location, summary, experience, skills, credentials, preferred_roles, preferred_locations, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       email = EXCLUDED.email, full_name = EXCLUDED.full_name, headline = EXCLUDED.headline,
       location = EXCLUDED.location, summary = EXCLUDED.summary, experience = EXCLUDED.experience,
       skills = EXCLUDED.skills, credentials = EXCLUDED.credentials,
       preferred_roles = EXCLUDED.preferred_roles, preferred_locations = EXCLUDED.preferred_locations,
       updated_at = EXCLUDED.updated_at`,
    [
      userId,
      profile.email,
      profile.fullName,
      profile.headline,
      profile.location,
      profile.summary,
      profile.experience,
      JSON.stringify(profile.skills),
      JSON.stringify(profile.credentials),
      JSON.stringify(profile.preferences.roles),
      JSON.stringify(profile.preferences.locations),
      profile.updatedAt || now(),
    ],
  );
}

async function writeResumeRows(userId: string, resume: SandboxResume) {
  const timestamp = resume.updatedAt || now();
  await run(
    `INSERT INTO resumes (user_id, title, target_role, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET title = EXCLUDED.title, target_role = EXCLUDED.target_role, updated_at = EXCLUDED.updated_at`,
    [userId, resume.title, resume.targetRole, timestamp],
  );
  for (const section of resume.sections) {
    await run(
      `INSERT INTO resume_sections (user_id, section_id, title, helper, content, sync_status, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, section_id) DO UPDATE SET
         title = EXCLUDED.title, helper = EXCLUDED.helper, content = EXCLUDED.content,
         sync_status = EXCLUDED.sync_status, ordinal = EXCLUDED.ordinal`,
      [
        userId,
        section.id,
        section.title,
        section.helper,
        section.content,
        section.syncStatus,
        SECTION_ORDER.indexOf(section.id),
      ],
    );
  }
}

async function ensureWorkspace(userId: string) {
  const existing = await queryOne<{ user_id: string }>("SELECT user_id FROM seeker_profiles WHERE user_id = ?", [userId]);
  if (!existing) {
    const profile = blankProfile();
    const resume = blankResume();
    await writeProfileRow(userId, profile);
    await writeResumeRows(userId, resume);
  }
  await ensureHistoryState(userId);
}

async function getStoredProfile(userId: string): Promise<SandboxProfile> {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM seeker_profiles WHERE user_id = ?", [userId]);
  if (!row) return blankProfile();
  return {
    email: String(row.email ?? ""),
    fullName: String(row.full_name ?? ""),
    headline: String(row.headline ?? ""),
    location: String(row.location ?? ""),
    summary: String(row.summary ?? ""),
    experience: String(row.experience ?? ""),
    skills: stringArray(row.skills),
    credentials: stringArray(row.credentials),
    preferences: {
      roles: stringArray(row.preferred_roles),
      locations: stringArray(row.preferred_locations),
    },
    updatedAt: String(row.updated_at ?? now()),
  };
}

async function getStoredResume(userId: string): Promise<SandboxResume> {
  const resumeRow = await queryOne<Record<string, unknown>>("SELECT * FROM resumes WHERE user_id = ?", [userId]);
  const sectionRows = await query<Record<string, unknown>>(
    "SELECT * FROM resume_sections WHERE user_id = ? ORDER BY ordinal ASC",
    [userId],
  );
  if (!resumeRow) return blankResume();
  const sections = SECTION_ORDER.map((id) => {
    const row = sectionRows.find((candidate) => candidate.section_id === id);
    const syncStatus = String(row?.sync_status ?? "BLANK");
    return {
      id,
      title: String(row?.title ?? SECTION_TEMPLATES[id].title),
      helper: String(row?.helper ?? SECTION_TEMPLATES[id].helper),
      content: String(row?.content ?? ""),
      syncStatus: (["BLANK", "DRAFT", "SYNCED", "NEEDS_REVIEW", "RESUME_ONLY"].includes(syncStatus)
        ? syncStatus
        : "BLANK") as SandboxResumeSection["syncStatus"],
    };
  });
  return {
    title: String(resumeRow.title ?? "Untitled Live Résumé"),
    targetRole: String(resumeRow.target_role ?? ""),
    sections,
    updatedAt: String(resumeRow.updated_at ?? now()),
  };
}

async function saveState(profile: SandboxProfile, resume: SandboxResume, userId: string) {
  const timestamp = now();
  await writeProfileRow(userId, { ...profile, updatedAt: profile.updatedAt || timestamp });
  await writeResumeRows(userId, { ...resume, updatedAt: resume.updatedAt || timestamp });
}

// ── Version history ──────────────────────────────────────────────────────────

async function ensureHistoryState(userId: string) {
  const count = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM resume_named_versions WHERE user_id = ?",
    [userId],
  );
  if (Number(count?.count ?? 0) > 0) {
    const active = await queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM resume_active_versions WHERE user_id = ?",
      [userId],
    );
    if (Number(active?.count ?? 0) > 0) return;
    const latest = await queryOne<{ id: string }>(
      "SELECT id FROM resume_named_versions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      [userId],
    );
    if (latest?.id) await setActivePointer(userId, latest.id);
    return;
  }

  const resume = await getStoredResume(userId);
  const timestamp = now();
  const namedVersionId = randomUUID();
  await run(
    `INSERT INTO resume_named_versions (id, user_id, title, purpose, status, source_version_id, active_revision_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', NULL, NULL, ?, ?)`,
    [namedVersionId, userId, resume.title || "Untitled Live Résumé", resume.targetRole || "Primary résumé", timestamp, timestamp],
  );
  await writeRevision(resume, "initial_resume", userId, namedVersionId, "Initial live résumé");
  await setActivePointer(userId, namedVersionId);
}

async function setActivePointer(userId: string, namedVersionId: string) {
  await run(
    `INSERT INTO resume_active_versions (user_id, named_version_id) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET named_version_id = EXCLUDED.named_version_id`,
    [userId, namedVersionId],
  );
}

async function namedVersionExists(namedVersionId: string, userId: string) {
  const row = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM resume_named_versions WHERE id = ? AND user_id = ?",
    [namedVersionId, userId],
  );
  return Number(row?.count ?? 0) > 0;
}

async function getActiveNamedVersionId(userId: string): Promise<string | null> {
  await ensureHistoryState(userId);
  const active = await queryOne<{ named_version_id: string }>(
    "SELECT named_version_id FROM resume_active_versions WHERE user_id = ?",
    [userId],
  );
  if (active?.named_version_id && (await namedVersionExists(active.named_version_id, userId))) {
    return active.named_version_id;
  }
  const latest = await queryOne<{ id: string }>(
    "SELECT id FROM resume_named_versions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    [userId],
  );
  if (!latest?.id) return null;
  await setActivePointer(userId, latest.id);
  return latest.id;
}

async function setActiveNamedVersion(userId: string, namedVersionId: string) {
  if (!(await namedVersionExists(namedVersionId, userId))) return;
  await setActivePointer(userId, namedVersionId);
}

async function writeRevision(
  resume: SandboxResume,
  source: string,
  userId: string,
  namedVersionId?: string | null,
  note?: string,
  syncSummary?: unknown,
) {
  const resolvedVersionId = namedVersionId ?? (await getActiveNamedVersionId(userId));
  if (!resolvedVersionId || !(await namedVersionExists(resolvedVersionId, userId))) return null;
  const max = await queryOne<{ max_revision: number | null }>(
    "SELECT MAX(revision_number) AS max_revision FROM resume_revisions WHERE user_id = ? AND named_version_id = ?",
    [userId, resolvedVersionId],
  );
  const revisionId = randomUUID();
  const timestamp = now();
  await run(
    `INSERT INTO resume_revisions (id, user_id, named_version_id, revision_number, resume_json, source, note, sync_summary_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      revisionId,
      userId,
      resolvedVersionId,
      Number(max?.max_revision ?? 0) + 1,
      JSON.stringify(resume),
      source,
      note ?? null,
      syncSummary === undefined ? null : JSON.stringify(syncSummary),
      timestamp,
    ],
  );
  await run(
    "UPDATE resume_named_versions SET active_revision_id = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [revisionId, timestamp, resolvedVersionId, userId],
  );
  return revisionId;
}

// ── Text normalization helpers (unchanged behavior) ──────────────────────────

function plainTextFromRichText(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeComparableText(text: string) {
  return plainTextFromRichText(text).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeListKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueNormalizedItems(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim();
    const key = normalizeListKey(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeList(text: string) {
  return uniqueNormalizedItems(plainTextFromRichText(text).split(/\n|,|·|•|;/)).filter((item) => item.length > 1);
}

function listKeys(values: string[]) {
  return values.map(normalizeListKey).filter(Boolean);
}

function listSetEquals(first: string[], second: string[]) {
  const firstKeys = new Set(listKeys(first));
  const secondKeys = new Set(listKeys(second));
  if (firstKeys.size !== secondKeys.size) return false;
  return Array.from(firstKeys).every((key) => secondKeys.has(key));
}

function listDifference(source: string[], comparison: string[]) {
  const comparisonKeys = new Set(listKeys(comparison));
  return source.filter((item) => !comparisonKeys.has(normalizeListKey(item)));
}

function parsePreferenceContent(text: string) {
  const roles: string[] = [];
  const locations: string[] = [];
  let mode: "roles" | "locations" = "roles";

  for (const rawLine of plainTextFromRichText(text).split(/\n|·|•|;/)) {
    const line = rawLine.replace(/^[-*]\s*/, "").trim();
    if (!line) continue;
    if (/^roles?:?$/i.test(line)) {
      mode = "roles";
      continue;
    }
    if (/^locations?:?$/i.test(line)) {
      mode = "locations";
      continue;
    }
    if (/^roles?:/i.test(line)) {
      mode = "roles";
      roles.push(...normalizeList(line.replace(/^roles?:/i, "")));
      continue;
    }
    if (/^locations?:/i.test(line)) {
      mode = "locations";
      const location = line.replace(/^locations?:/i, "").trim();
      if (location) locations.push(location);
      continue;
    }
    if (mode === "locations") locations.push(line);
    else roles.push(...normalizeList(line));
  }

  return {
    roles: Array.from(new Set(roles)),
    locations: Array.from(new Set(locations)),
  };
}

function mergeUnique(existing: string[], additions: string[]) {
  return uniqueNormalizedItems([...existing, ...additions]);
}

function hasContent(section: SandboxResumeSection) {
  return plainTextFromRichText(section.content).length > 0;
}

function sectionMatchesProfile(section: SandboxResumeSection, profile: SandboxProfile) {
  if (section.id === "summary") {
    return normalizeComparableText(section.content) === normalizeComparableText(profile.summary);
  }
  if (section.id === "experience") {
    return normalizeComparableText(section.content) === normalizeComparableText(profile.experience);
  }
  if (section.id === "credentials") {
    return listSetEquals(normalizeList(section.content), profile.credentials);
  }
  if (section.id === "skills") {
    return listSetEquals(normalizeList(section.content), profile.skills);
  }
  if (section.id === "preferences") {
    const preferences = parsePreferenceContent(section.content);
    return (
      preferences.roles.every((role) =>
        profile.preferences.roles.some((existing) => existing.toLowerCase() === role.toLowerCase()),
      ) &&
      preferences.locations.every((location) =>
        profile.preferences.locations.some((existing) => existing.toLowerCase() === location.toLowerCase()),
      )
    );
  }
  return false;
}

// ── Audit and proposals ──────────────────────────────────────────────────────

async function writeAudit(action: string, target: string, beforeValue: unknown, afterValue: unknown, userId: string) {
  await run(
    "INSERT INTO career_audit (id, user_id, action, target, before_value_json, after_value_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), userId, action, target, JSON.stringify(beforeValue ?? null), JSON.stringify(afterValue ?? null), now()],
  );
}

async function insertProposal(
  proposal: Omit<SandboxProposal, "id" | "status" | "createdAt" | "decidedAt">,
  userId: string,
) {
  const inserted: SandboxProposal = {
    ...proposal,
    id: randomUUID(),
    status: "PENDING",
    createdAt: now(),
    decidedAt: null,
  };
  await run(
    `INSERT INTO resume_proposals (id, user_id, title, summary, target, scope, status, proposed_value_json, before_value_json, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inserted.id,
      userId,
      inserted.title,
      inserted.summary,
      inserted.target,
      inserted.scope,
      inserted.status,
      JSON.stringify(inserted.proposedValue ?? null),
      JSON.stringify(inserted.beforeValue ?? null),
      inserted.createdAt,
      inserted.decidedAt,
    ],
  );
  await writeAudit("PROPOSAL_CREATED", inserted.target, inserted.beforeValue, inserted.proposedValue, userId);
  return inserted;
}

function sectionIdsForProposal(proposal: SandboxProposal): SandboxResumeSection["id"][] {
  switch (proposal.target) {
    case "PROFILE_SUMMARY":
      return ["summary"];
    case "EXPERIENCE":
      return ["experience"];
    case "CREDENTIALS":
      return ["credentials"];
    case "SKILLS":
      return ["skills"];
    case "PREFERENCES":
      return ["preferences"];
    case "HEADLINE":
      return [];
    case "RESUME_ONLY":
      return ["experience"];
  }
}

function updateSectionStatus(
  resume: SandboxResume,
  proposal: SandboxProposal,
  syncStatus: SandboxResumeSection["syncStatus"],
) {
  const sectionIds = sectionIdsForProposal(proposal);
  if (sectionIds.length === 0) return resume;
  return {
    ...resume,
    sections: resume.sections.map((section) =>
      sectionIds.includes(section.id) && hasContent(section) ? { ...section, syncStatus } : section,
    ),
    updatedAt: now(),
  };
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function mapProposal(row: Record<string, unknown>): SandboxProposal {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    target: String(row.target ?? "RESUME_ONLY") as SandboxProposal["target"],
    scope: String(row.scope ?? "RESUME_ONLY") as SandboxProposalScope,
    status: String(row.status ?? "PENDING") as SandboxProposalStatus,
    proposedValue: parseJson(row.proposed_value_json, null),
    beforeValue: parseJson(row.before_value_json, null),
    createdAt: String(row.created_at ?? ""),
    decidedAt: row.decided_at ? String(row.decided_at) : null,
  };
}

function mapRevision(row: Record<string, unknown>): SandboxRevision {
  const resume = parseJson<Partial<SandboxResume>>(row.resume_json, {});
  return {
    id: String(row.id ?? ""),
    parentVersionId: String(row.named_version_id ?? ""),
    versionNumber: Number(row.revision_number ?? 0),
    source: String(row.source ?? ""),
    note: row.note ? String(row.note) : undefined,
    syncSummary: row.sync_summary_json ? JSON.stringify(parseJson(row.sync_summary_json, null)) : undefined,
    createdAt: String(row.created_at ?? ""),
    resume: Object.keys(resume).length > 0 ? normalizeResume(resume, blankProfile()) : undefined,
  };
}

function mapNamedVersion(row: Record<string, unknown>, activeVersionId: string | null): SandboxNamedResumeVersion {
  const resume = parseJson<Partial<SandboxResume>>(row.active_resume_json, {});
  const status = String(row.status ?? "DRAFT");
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Untitled résumé version"),
    purpose: String(row.purpose ?? ""),
    status: (status === "ACTIVE" || status === "ARCHIVED" ? status : "DRAFT") as SandboxResumeVersionStatus,
    sourceVersionId: row.source_version_id ? String(row.source_version_id) : null,
    activeRevisionId: row.active_revision_id ? String(row.active_revision_id) : null,
    revisionCount: Number(row.revision_count ?? 0),
    isCurrent: String(row.id ?? "") === activeVersionId,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    resume: Object.keys(resume).length > 0 ? normalizeResume(resume, blankProfile()) : undefined,
  };
}

function mapAudit(row: Record<string, unknown>): SandboxAuditEntry {
  return {
    id: String(row.id ?? ""),
    action: String(row.action ?? ""),
    target: String(row.target ?? ""),
    beforeValue: parseJson(row.before_value_json, null),
    afterValue: parseJson(row.after_value_json, null),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapResumeImport(row: Record<string, unknown>): SandboxResumeImport {
  const parsedResult = parseJson<SandboxResumeImportReview>(row.parsed_result_json, {
    assistantName: "Rex",
    answer: "Rex prepared a résumé import review.",
    resumeTitle: "Imported résumé draft",
    targetRole: "",
    placements: [],
    suggestions: [],
    ambiguousItems: [],
    unsupportedItems: [],
    confidence: 0,
    safetyNotes: [],
  });
  const status = String(row.status ?? "PARSED");
  const intent = String(row.intent ?? "new_version");
  return {
    id: String(row.id ?? ""),
    fileName: String(row.file_name ?? ""),
    contentType: String(row.content_type ?? ""),
    sizeBytes: Number(row.size_bytes ?? 0),
    extractedText: String(row.extracted_text ?? ""),
    extractedCharCount: String(row.extracted_text ?? "").length,
    extractor: String(row.extractor ?? ""),
    intent: (intent === "replace_current" || intent === "signup_onboarding" ? intent : "new_version") as SandboxResumeImportIntent,
    status: (status === "APPLIED" || status === "FAILED" ? status : "PARSED") as SandboxResumeImport["status"],
    parsedResult,
    createdAt: String(row.created_at ?? ""),
    appliedAt: row.applied_at ? String(row.applied_at) : null,
  };
}

function normalizeImportedSectionContent(sectionId: SandboxResumeSection["id"], content: string) {
  if (sectionId === "skills") return normalizeList(content).join(" · ");
  if (sectionId === "credentials") return normalizeList(content).join("\n");
  return content.trim();
}

function resumeFromImportReview(review: SandboxResumeImportReview, currentResume: SandboxResume): SandboxResume {
  const timestamp = now();
  const placementBySection = new Map(
    review.placements.map((placementItem) => [
      placementItem.sectionId,
      normalizeImportedSectionContent(placementItem.sectionId, placementItem.content),
    ]),
  );
  return {
    ...currentResume,
    title: review.resumeTitle.trim() || "Imported résumé draft",
    targetRole: review.targetRole.trim() || currentResume.targetRole,
    updatedAt: timestamp,
    sections: currentResume.sections.map((section) => {
      const content = placementBySection.get(section.id) ?? "";
      return {
        ...section,
        content,
        syncStatus: content ? "DRAFT" : "BLANK",
      };
    }),
  };
}

// ── Public API (same contract the routes already use) ────────────────────────

export async function getSandboxSnapshot(userId: string): Promise<SandboxSnapshot> {
  await ensureWorkspace(userId);
  const activeVersionId = await getActiveNamedVersionId(userId);
  const revisions = activeVersionId
    ? (
        await query<Record<string, unknown>>(
          `SELECT id, named_version_id, revision_number, resume_json, source, note, sync_summary_json, created_at
           FROM resume_revisions
           WHERE user_id = ? AND named_version_id = ?
           ORDER BY revision_number DESC`,
          [userId, activeVersionId],
        )
      ).map(mapRevision)
    : [];
  return {
    profile: await getStoredProfile(userId),
    resume: await getStoredResume(userId),
    activeVersionId,
    namedVersions: (
      await query<Record<string, unknown>>(
        `SELECT
          named_versions.*,
          active_revision.resume_json AS active_resume_json,
          (
            SELECT COUNT(*)
            FROM resume_revisions AS revision_count
            WHERE revision_count.named_version_id = named_versions.id
              AND revision_count.user_id = named_versions.user_id
          ) AS revision_count
        FROM resume_named_versions AS named_versions
        LEFT JOIN resume_revisions AS active_revision
          ON active_revision.id = named_versions.active_revision_id
        WHERE named_versions.user_id = ?
        ORDER BY named_versions.updated_at DESC`,
        [userId],
      )
    ).map((row) => mapNamedVersion(row, activeVersionId)),
    revisions,
    proposals: (
      await query<Record<string, unknown>>(
        "SELECT * FROM resume_proposals WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
      )
    ).map(mapProposal),
    versions: revisions,
    audit: (
      await query<Record<string, unknown>>(
        "SELECT * FROM career_audit WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        [userId],
      )
    ).map(mapAudit),
    persistence: { kind: "postgres" },
  };
}

async function deleteWorkspaceRows(userId: string) {
  await run("DELETE FROM resume_active_versions WHERE user_id = ?", [userId]);
  await run("DELETE FROM resume_revisions WHERE user_id = ?", [userId]);
  await run("DELETE FROM resume_named_versions WHERE user_id = ?", [userId]);
  await run("DELETE FROM resume_proposals WHERE user_id = ?", [userId]);
  await run("DELETE FROM career_audit WHERE user_id = ?", [userId]);
  await run("DELETE FROM ai_interactions WHERE user_id = ?", [userId]);
  await run("DELETE FROM resume_imports WHERE user_id = ?", [userId]);
  await run("DELETE FROM resume_sections WHERE user_id = ?", [userId]);
  await run("DELETE FROM resumes WHERE user_id = ?", [userId]);
  await run("DELETE FROM seeker_profiles WHERE user_id = ?", [userId]);
}

export async function createResumeWorkspace(input: SandboxSignupInput, userId: string) {
  const profile = profileFromSignup(input);
  const resume = resumeFromProfile(profile);
  return tx(async () => {
    await deleteWorkspaceRows(userId);
    await writeProfileRow(userId, profile);
    await writeResumeRows(userId, resume);
    await ensureHistoryState(userId);
    await writeAudit("PROFILE_CREATED_FROM_SIGNUP", "LiveResume", null, { profile, resume }, userId);
    return getSandboxSnapshot(userId);
  });
}

/** Back-compat alias for the pre-Postgres name. */
export const createSandboxProfile = createResumeWorkspace;

export async function saveSandboxDraft(
  sections: SandboxResumeSection[],
  targetRole: string,
  title: string | undefined,
  changedSectionId: SandboxResumeSection["id"] | undefined,
  userId: string,
  namedVersionId?: string,
) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const profile = await getStoredProfile(userId);
    const previousResume = await getStoredResume(userId);
    const activeVersionId =
      namedVersionId && (await namedVersionExists(namedVersionId, userId))
        ? namedVersionId
        : await getActiveNamedVersionId(userId);
    if (activeVersionId) await setActiveNamedVersion(userId, activeVersionId);
    const timestamp = now();
    const resume: SandboxResume = {
      ...previousResume,
      title: title?.trim() || "Untitled Live Résumé",
      targetRole,
      sections: sections.map((section) => {
        const previousSection = previousResume.sections.find((candidate) => candidate.id === section.id);
        const contentChanged = (previousSection?.content ?? "") !== section.content;
        const shouldMarkDraft = changedSectionId ? section.id === changedSectionId : contentChanged;
        return {
          ...section,
          syncStatus: hasContent(section) ? (shouldMarkDraft ? "DRAFT" : section.syncStatus) : "BLANK",
        };
      }),
      updatedAt: timestamp,
    };
    await saveState(profile, resume, userId);
    await writeRevision(
      resume,
      "manual_save",
      userId,
      activeVersionId,
      changedSectionId ? `Saved ${changedSectionId} section` : "Saved changes",
    );
    await writeAudit("RESUME_REVISION_SAVED", "Resume", previousResume, resume, userId);
    return getSandboxSnapshot(userId);
  });
}

export async function createSandboxNamedVersion(
  input: {
    title: string;
    purpose?: string;
    status?: SandboxResumeVersionStatus;
    sourceVersionId?: string;
    resume?: SandboxResume;
    source?: "blank" | "current" | "upload";
  },
  userId: string,
) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const profile = await getStoredProfile(userId);
    const sourceVersionId = input.sourceVersionId || (await getActiveNamedVersionId(userId));
    const storedResume = await getStoredResume(userId);
    const sourceResume = input.resume ?? (input.source === "blank" ? blankResume() : storedResume);
    const timestamp = now();
    const namedVersionId = randomUUID();
    const title = input.title.trim() || sourceResume.title || "Untitled résumé version";
    const status = input.status === "ACTIVE" || input.status === "ARCHIVED" ? input.status : "DRAFT";
    const resume: SandboxResume = {
      ...sourceResume,
      title,
      targetRole: input.purpose?.trim() || sourceResume.targetRole,
      sections: sourceResume.sections.map((section) => ({
        ...section,
        syncStatus: section.content ? (section.syncStatus === "SYNCED" ? "DRAFT" : section.syncStatus) : "BLANK",
      })),
      updatedAt: timestamp,
    };

    await run(
      `INSERT INTO resume_named_versions (id, user_id, title, purpose, status, source_version_id, active_revision_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        namedVersionId,
        userId,
        title,
        input.purpose?.trim() || resume.targetRole || "Role-targeted version",
        status,
        sourceVersionId ?? null,
        timestamp,
        timestamp,
      ],
    );
    await saveState(profile, resume, userId);
    await writeRevision(
      resume,
      input.source === "upload" ? "uploaded_resume_version_created" : "named_version_created",
      userId,
      namedVersionId,
      input.source === "blank"
        ? "Created blank résumé version"
        : input.source === "upload"
          ? "Created résumé version from upload"
          : "Created named résumé version",
    );
    await setActiveNamedVersion(userId, namedVersionId);
    await writeAudit(
      "NAMED_RESUME_VERSION_CREATED",
      "ResumeVersion",
      sourceVersionId,
      { id: namedVersionId, title, source: input.source ?? "current" },
      userId,
    );
    return getSandboxSnapshot(userId);
  });
}

export async function selectSandboxNamedVersion(namedVersionId: string, userId: string) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const row = await queryOne<Record<string, unknown>>(
      `SELECT named_versions.id, named_versions.title, active_revision.resume_json
       FROM resume_named_versions AS named_versions
       LEFT JOIN resume_revisions AS active_revision ON active_revision.id = named_versions.active_revision_id
       WHERE named_versions.id = ? AND named_versions.user_id = ?`,
      [namedVersionId, userId],
    );
    if (!row) return getSandboxSnapshot(userId);

    const profile = await getStoredProfile(userId);
    const previousResume = await getStoredResume(userId);
    const resume = mapResumeFromJson(row.resume_json);
    await setActiveNamedVersion(userId, namedVersionId);
    await saveState(profile, { ...resume, updatedAt: now() }, userId);
    await writeAudit(
      "NAMED_RESUME_VERSION_SELECTED",
      "ResumeVersion",
      { activeResume: previousResume.title },
      { versionId: namedVersionId, title: String(row.title ?? "") },
      userId,
    );
    return getSandboxSnapshot(userId);
  });
}

export async function restoreSandboxRevision(revisionId: string, userId: string) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const row = await queryOne<Record<string, unknown>>(
      "SELECT * FROM resume_revisions WHERE id = ? AND user_id = ?",
      [revisionId, userId],
    );
    if (!row) return getSandboxSnapshot(userId);

    const profile = await getStoredProfile(userId);
    const previousResume = await getStoredResume(userId);
    const restoredResume = mapResumeFromJson(row.resume_json);
    const namedVersionId = String(row.named_version_id ?? "");
    const timestamp = now();
    await setActiveNamedVersion(userId, namedVersionId);
    const restoredWithTimestamp = { ...restoredResume, updatedAt: timestamp };
    await saveState(profile, restoredWithTimestamp, userId);
    await writeRevision(
      restoredWithTimestamp,
      "revision_restored",
      userId,
      namedVersionId,
      `Restored from revision ${Number(row.revision_number ?? 0)}`,
    );
    await writeAudit("RESUME_REVISION_RESTORED", "ResumeRevision", previousResume, restoredResume, userId);
    return getSandboxSnapshot(userId);
  });
}

export async function writeSandboxAiInteraction(input: {
  sandboxId?: string;
  task: string;
  model: string;
  fallbackModel?: string;
  status: "SUCCEEDED" | "FAILED";
  inputMetadata?: unknown;
  parsedOutput?: unknown;
  rawResponseId?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const userId = input.sandboxId;
  if (!userId) throw new Error("writeSandboxAiInteraction requires the owning user id.");
  const timestamp = now();
  const id = randomUUID();
  await run(
    `INSERT INTO ai_interactions (id, user_id, task, model, fallback_model, status, input_metadata_json, parsed_output_json, raw_response_id, error, input_tokens, output_tokens, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.task,
      input.model,
      input.fallbackModel ?? null,
      input.status,
      input.inputMetadata === undefined ? null : JSON.stringify(input.inputMetadata),
      input.parsedOutput === undefined ? null : JSON.stringify(input.parsedOutput),
      input.rawResponseId ?? null,
      input.error ?? null,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      timestamp,
      timestamp,
    ],
  );
  return id;
}

export async function createSandboxResumeImport(
  input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    extractedText: string;
    extractor: string;
    intent: SandboxResumeImportIntent;
    parsedResult: SandboxResumeImportReview;
  },
  userId: string,
) {
  await ensureWorkspace(userId);
  const timestamp = now();
  const id = randomUUID();
  await run(
    `INSERT INTO resume_imports (id, user_id, file_name, content_type, size_bytes, extracted_text, extractor, intent, status, parsed_result_json, created_at, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PARSED', ?, ?, NULL)`,
    [
      id,
      userId,
      input.fileName,
      input.contentType,
      input.sizeBytes,
      input.extractedText,
      input.extractor,
      input.intent,
      JSON.stringify(input.parsedResult),
      timestamp,
    ],
  );
  await writeAudit(
    "RESUME_IMPORT_PARSED",
    "ResumeImport",
    null,
    { id, fileName: input.fileName, intent: input.intent, extractedCharCount: input.extractedText.length },
    userId,
  );
  return getSandboxResumeImport(id, userId);
}

export async function getSandboxResumeImport(importId: string, userId: string) {
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM resume_imports WHERE id = ? AND user_id = ?",
    [importId, userId],
  );
  return row ? mapResumeImport(row) : null;
}

export async function applySandboxResumeImport(
  importId: string,
  applyMode: SandboxResumeImportApplyMode,
  userId: string,
) {
  const resumeImport = await getSandboxResumeImport(importId, userId);
  if (!resumeImport || resumeImport.status !== "PARSED") {
    return { ok: false as const, error: "Resume import was not found or has already been applied." };
  }

  const previousResume = await getStoredResume(userId);
  const importedResume = resumeFromImportReview(resumeImport.parsedResult, previousResume);
  const timestamp = now();

  if (applyMode === "create_version") {
    return tx(async () => {
      const snapshot = await createSandboxNamedVersion(
        {
          title: importedResume.title,
          purpose: importedResume.targetRole,
          status: "DRAFT",
          resume: importedResume,
          source: "upload",
        },
        userId,
      );
      await run("UPDATE resume_imports SET status = 'APPLIED', applied_at = ? WHERE id = ? AND user_id = ?", [
        timestamp,
        importId,
        userId,
      ]);
      await writeAudit("RESUME_IMPORT_APPLIED", "ResumeImport", { id: importId }, { mode: applyMode }, userId);
      return { ok: true as const, snapshot };
    });
  }

  if (applyMode === "replace_current") {
    return tx(async () => {
      const profile = await getStoredProfile(userId);
      const activeVersionId = await getActiveNamedVersionId(userId);
      await saveState(profile, importedResume, userId);
      await writeRevision(importedResume, "resume_upload_import", userId, activeVersionId, "Applied uploaded résumé import");
      await run("UPDATE resume_imports SET status = 'APPLIED', applied_at = ? WHERE id = ? AND user_id = ?", [
        timestamp,
        importId,
        userId,
      ]);
      await writeAudit("RESUME_IMPORT_APPLIED", "ResumeImport", previousResume, importedResume, userId);
      return { ok: true as const, snapshot: await getSandboxSnapshot(userId) };
    });
  }

  return { ok: false as const, error: "Use the sign-up import review to fill sign-up fields before account creation." };
}

function shouldAnalyzeSection(
  sectionId: SandboxResumeSection["id"],
  focusedSectionId?: SandboxResumeSection["id"],
) {
  return !focusedSectionId || focusedSectionId === sectionId;
}

export async function analyzeSandboxResume(
  focusedSectionId: SandboxResumeSection["id"] | undefined,
  userId: string,
) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const profile = await getStoredProfile(userId);
    const resume = await getStoredResume(userId);
    await run("UPDATE resume_proposals SET status = 'REJECTED', decided_at = ? WHERE user_id = ? AND status = 'PENDING'", [
      now(),
      userId,
    ]);

    const summarySection = resume.sections.find((section) => section.id === "summary");
    const experienceSection = resume.sections.find((section) => section.id === "experience");
    const credentialsSection = resume.sections.find((section) => section.id === "credentials");
    const skillsSection = resume.sections.find((section) => section.id === "skills");
    const preferencesSection = resume.sections.find((section) => section.id === "preferences");
    const proposals: SandboxProposal[] = [];

    if (
      shouldAnalyzeSection("summary", focusedSectionId) &&
      summarySection &&
      hasContent(summarySection) &&
      normalizeComparableText(summarySection.content) !== normalizeComparableText(profile.summary)
    ) {
      proposals.push(
        await insertProposal(
          {
            title: "Update profile summary",
            summary: "Use the résumé summary as the structured profile summary.",
            target: "PROFILE_SUMMARY",
            scope: "UPDATE_PROFILE",
            beforeValue: { summary: profile.summary },
            proposedValue: { summary: summarySection.content.trim() },
          },
          userId,
        ),
      );
    }

    if (!focusedSectionId && resume.targetRole.trim() && resume.targetRole.trim() !== profile.headline.trim()) {
      proposals.push(
        await insertProposal(
          {
            title: "Sync target role to profile headline",
            summary: "Use the résumé target role as the profile headline and a job preference.",
            target: "HEADLINE",
            scope: "UPDATE_PROFILE",
            beforeValue: { headline: profile.headline, roles: profile.preferences.roles },
            proposedValue: { headline: resume.targetRole.trim(), roles: [resume.targetRole.trim()] },
          },
          userId,
        ),
      );
    }

    if (
      shouldAnalyzeSection("experience", focusedSectionId) &&
      experienceSection &&
      hasContent(experienceSection) &&
      normalizeComparableText(experienceSection.content) !== normalizeComparableText(profile.experience)
    ) {
      proposals.push(
        await insertProposal(
          {
            title: "Update profile experience",
            summary: "Use the live résumé experience section as the structured profile experience.",
            target: "EXPERIENCE",
            scope: "UPDATE_PROFILE",
            beforeValue: { experience: profile.experience },
            proposedValue: { experience: experienceSection.content.trim() },
          },
          userId,
        ),
      );
    }

    if (shouldAnalyzeSection("credentials", focusedSectionId) && credentialsSection) {
      const credentials = hasContent(credentialsSection) ? normalizeList(credentialsSection.content) : [];
      const addedCredentials = listDifference(credentials, profile.credentials);
      const removedCredentials = listDifference(profile.credentials, credentials);
      if (addedCredentials.length > 0 || removedCredentials.length > 0) {
        proposals.push(
          await insertProposal(
            {
              title: "Update profile credentials",
              summary:
                removedCredentials.length > 0
                  ? "Review credentials added or removed in the résumé before changing the public profile."
                  : "Move confirmed licenses, certifications, or credentials from the résumé into the structured profile.",
              target: "CREDENTIALS",
              scope: "UPDATE_PROFILE",
              beforeValue: { credentials: profile.credentials },
              proposedValue: { credentials, addedCredentials, removedCredentials },
            },
            userId,
          ),
        );
      }
    }

    if (shouldAnalyzeSection("skills", focusedSectionId) && skillsSection) {
      const skills = hasContent(skillsSection) ? normalizeList(skillsSection.content) : [];
      const addedSkills = listDifference(skills, profile.skills);
      const removedSkills = listDifference(profile.skills, skills);
      if (addedSkills.length > 0 || removedSkills.length > 0) {
        proposals.push(
          await insertProposal(
            {
              title: "Update profile skills",
              summary:
                removedSkills.length > 0
                  ? "Review skills added or removed in the résumé before changing the public profile."
                  : "Add résumé skills to the structured profile so future packets can reuse them.",
              target: "SKILLS",
              scope: "UPDATE_PROFILE",
              beforeValue: { skills: profile.skills },
              proposedValue: { skills, addedSkills, removedSkills },
            },
            userId,
          ),
        );
      }
    }

    if (shouldAnalyzeSection("preferences", focusedSectionId) && preferencesSection && hasContent(preferencesSection)) {
      const preferences = parsePreferenceContent(preferencesSection.content);
      const newRoles = preferences.roles.filter(
        (role) => !profile.preferences.roles.some((existing) => existing.toLowerCase() === role.toLowerCase()),
      );
      const newLocations = preferences.locations.filter(
        (location) =>
          !profile.preferences.locations.some((existing) => existing.toLowerCase() === location.toLowerCase()),
      );
      if (newRoles.length > 0 || newLocations.length > 0) {
        proposals.push(
          await insertProposal(
            {
              title: "Update job preferences",
              summary: "Treat these résumé targeting notes as job preference roles or locations.",
              target: "PREFERENCES",
              scope: "UPDATE_PROFILE",
              beforeValue: { preferences: profile.preferences },
              proposedValue: { roles: newRoles, locations: newLocations },
            },
            userId,
          ),
        );
      }
    }

    const proposalSectionIds = new Set(proposals.flatMap((proposal) => sectionIdsForProposal(proposal)));
    const updatedResume: SandboxResume = {
      ...resume,
      sections: resume.sections.map((section) => ({
        ...section,
        syncStatus: proposalSectionIds.has(section.id)
          ? "NEEDS_REVIEW"
          : !hasContent(section)
            ? "BLANK"
            : shouldAnalyzeSection(section.id, focusedSectionId) && sectionMatchesProfile(section, profile)
              ? "SYNCED"
              : section.syncStatus,
      })),
      updatedAt: now(),
    };
    await saveState(profile, updatedResume, userId);
    await writeAudit("ANALYZED", "Resume", { pendingProposals: 0 }, { pendingProposals: proposals.length }, userId);
    return getSandboxSnapshot(userId);
  });
}

export async function decideSandboxProposal(
  proposalId: string,
  decision: "APPLY" | "KEEP_RESUME_ONLY" | "REJECT",
  userId: string,
) {
  return tx(async () => {
    await ensureWorkspace(userId);
    const row = await queryOne<Record<string, unknown>>(
      "SELECT * FROM resume_proposals WHERE id = ? AND user_id = ?",
      [proposalId, userId],
    );
    if (!row) return getSandboxSnapshot(userId);

    const proposal = mapProposal(row);
    const profile = await getStoredProfile(userId);
    const resume = await getStoredResume(userId);
    const proposedValue = proposal.proposedValue as Record<string, unknown> | null;
    const previousProfile = profile;
    let nextProfile = profile;
    let nextResume = resume;
    let status: SandboxProposalStatus = "APPLIED";

    if (decision === "REJECT") {
      status = "REJECTED";
    } else if (decision === "KEEP_RESUME_ONLY" || proposal.scope === "RESUME_ONLY") {
      nextResume = updateSectionStatus(resume, proposal, "RESUME_ONLY");
    } else if (proposedValue) {
      if (proposal.target === "PROFILE_SUMMARY" && typeof proposedValue.summary === "string") {
        nextProfile = { ...nextProfile, summary: proposedValue.summary, updatedAt: now() };
      }
      if (proposal.target === "HEADLINE") {
        const headline = typeof proposedValue.headline === "string" ? proposedValue.headline : nextProfile.headline;
        const roles = Array.isArray(proposedValue.roles)
          ? proposedValue.roles.filter((role): role is string => typeof role === "string")
          : [];
        nextProfile = {
          ...nextProfile,
          headline,
          preferences: {
            ...nextProfile.preferences,
            roles: mergeUnique(nextProfile.preferences.roles, roles),
          },
          updatedAt: now(),
        };
      }
      if (proposal.target === "EXPERIENCE" && typeof proposedValue.experience === "string") {
        nextProfile = { ...nextProfile, experience: proposedValue.experience, updatedAt: now() };
      }
      if (proposal.target === "CREDENTIALS" && Array.isArray(proposedValue.credentials)) {
        const targetCredentials = uniqueNormalizedItems(
          proposedValue.credentials.filter((credential): credential is string => typeof credential === "string"),
        );
        const hasGranularReview =
          Array.isArray(proposedValue.addedCredentials) || Array.isArray(proposedValue.removedCredentials);
        nextProfile = {
          ...nextProfile,
          credentials: hasGranularReview ? targetCredentials : mergeUnique(nextProfile.credentials, targetCredentials),
          updatedAt: now(),
        };
      }
      if (proposal.target === "SKILLS" && Array.isArray(proposedValue.skills)) {
        const targetSkills = uniqueNormalizedItems(
          proposedValue.skills.filter((skill): skill is string => typeof skill === "string"),
        );
        const hasGranularReview =
          Array.isArray(proposedValue.addedSkills) || Array.isArray(proposedValue.removedSkills);
        nextProfile = {
          ...nextProfile,
          skills: hasGranularReview ? targetSkills : mergeUnique(nextProfile.skills, targetSkills),
          updatedAt: now(),
        };
      }
      if (
        proposal.target === "PREFERENCES" &&
        (Array.isArray(proposedValue.roles) || Array.isArray(proposedValue.locations))
      ) {
        const roles = Array.isArray(proposedValue.roles)
          ? proposedValue.roles.filter((role): role is string => typeof role === "string")
          : [];
        const locations = Array.isArray(proposedValue.locations)
          ? proposedValue.locations.filter((location): location is string => typeof location === "string")
          : [];
        nextProfile = {
          ...nextProfile,
          preferences: {
            ...nextProfile.preferences,
            roles: mergeUnique(nextProfile.preferences.roles, roles),
            locations: mergeUnique(nextProfile.preferences.locations, locations),
          },
          updatedAt: now(),
        };
      }
      nextResume = updateSectionStatus(resume, proposal, "SYNCED");
    }

    await saveState(nextProfile, nextResume, userId);
    await run("UPDATE resume_proposals SET status = ?, decided_at = ? WHERE id = ? AND user_id = ?", [
      status,
      now(),
      proposal.id,
      userId,
    ]);
    await writeAudit(
      decision === "REJECT" ? "PROPOSAL_REJECTED" : decision === "KEEP_RESUME_ONLY" ? "KEPT_RESUME_ONLY" : "PROFILE_UPDATED",
      proposal.target,
      previousProfile,
      decision === "REJECT" ? previousProfile : nextProfile,
      userId,
    );
    return getSandboxSnapshot(userId);
  });
}

export async function resetSandbox(userId: string) {
  return tx(async () => {
    const profile = blankProfile();
    const resume = blankResume();
    await deleteWorkspaceRows(userId);
    await writeProfileRow(userId, profile);
    await writeResumeRows(userId, resume);
    await ensureHistoryState(userId);
    await writeAudit("SANDBOX_RESET", "Sandbox", null, { profile, resume }, userId);
    return getSandboxSnapshot(userId);
  });
}
