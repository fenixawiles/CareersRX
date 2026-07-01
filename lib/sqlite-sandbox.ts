import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { querySqlFile, runSqlFile } from "@/lib/sqlite-runtime";
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

const DEMO_SANDBOX_ID = "local-blank-sandbox";
const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "careersrx-live-resume-sandbox.sqlite");

function now() {
  return new Date().toISOString();
}

function sqlString(value: string | null) {
  if (value === null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(sql: string) {
  runSqlFile(dbPath, sql);
}

function querySql<T>(sql: string): T[] {
  return querySqlFile<T>(dbPath, sql);
}

function initializeDatabase() {
  runSql(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sandbox_state (
      id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL,
      resume_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_versions (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      resume_json TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_named_resume_versions (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      title TEXT NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL,
      source_version_id TEXT,
      active_revision_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_resume_revisions (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      named_version_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      resume_json TEXT NOT NULL,
      source TEXT NOT NULL,
      note TEXT,
      sync_summary_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_active_resume_version (
      sandbox_id TEXT PRIMARY KEY,
      named_version_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_proposals (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      target TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      proposed_value_json TEXT NOT NULL,
      before_value_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sandbox_audit (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      before_value_json TEXT NOT NULL,
      after_value_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandbox_ai_interactions (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      task TEXT NOT NULL,
      model TEXT NOT NULL,
      fallback_model TEXT,
      status TEXT NOT NULL,
      input_metadata_json TEXT,
      parsed_output_json TEXT,
      raw_response_id TEXT,
      error TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sandbox_resume_imports (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      extracted_text TEXT NOT NULL,
      extractor TEXT NOT NULL,
      intent TEXT NOT NULL,
      status TEXT NOT NULL,
      parsed_result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      applied_at TEXT
    );
  `);
  ensureState();
}

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
    preferences: {
      roles: [],
      locations: [],
    },
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

function resumeFromProfile(profile: SandboxProfile): SandboxResume {
  const timestamp = now();
  return {
    title: profile.fullName ? `${profile.fullName} — Live Résumé` : "Untitled Live Résumé",
    targetRole: profile.headline,
    updatedAt: timestamp,
    sections: [
      {
        id: "summary",
        title: "Professional Summary",
        helper: "This section seeds and syncs to the profile summary.",
        content: profile.summary,
        syncStatus: profile.summary ? "SYNCED" : "BLANK",
      },
      {
        id: "experience",
        title: "Experience",
        helper: "This section seeds and syncs to profile experience when you approve it.",
        content: profile.experience,
        syncStatus: profile.experience ? "SYNCED" : "BLANK",
      },
      {
        id: "credentials",
        title: "Credentials",
        helper: "This section seeds and syncs to profile credentials.",
        content: profile.credentials.join("\n"),
        syncStatus: profile.credentials.length > 0 ? "SYNCED" : "BLANK",
      },
      {
        id: "skills",
        title: "Skills",
        helper: "This section seeds and syncs to profile skills.",
        content: profile.skills.join(" · "),
        syncStatus: profile.skills.length > 0 ? "SYNCED" : "BLANK",
      },
      {
        id: "preferences",
        title: "Role Preferences",
        helper: "This section seeds and syncs to profile job preferences.",
        content: [
          profile.preferences.roles.length > 0 ? `Roles:\n${profile.preferences.roles.join("\n")}` : "",
          profile.preferences.locations.length > 0
            ? `Locations:\n${profile.preferences.locations.join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        syncStatus:
          profile.preferences.roles.length > 0 || profile.preferences.locations.length > 0
            ? "SYNCED"
            : "BLANK",
      },
    ],
  };
}

function blankResume(): SandboxResume {
  const timestamp = now();
  return {
    title: "Untitled Live Résumé",
    targetRole: "",
    updatedAt: timestamp,
    sections: [
      {
        id: "summary",
        title: "Professional Summary",
        helper: "Write a short positioning statement. Applying this can update profile summary/headline.",
        content: "",
        syncStatus: "BLANK",
      },
      {
        id: "experience",
        title: "Experience",
        helper: "Draft role bullets here. Wording can stay résumé-only unless it implies profile facts.",
        content: "",
        syncStatus: "BLANK",
      },
      {
        id: "credentials",
        title: "Credentials",
        helper: "List licenses, certifications, degrees, or clearances. Applying this updates profile credentials.",
        content: "",
        syncStatus: "BLANK",
      },
      {
        id: "skills",
        title: "Skills",
        helper: "Separate skills with commas, bullets, new lines, or dots. Applying this updates profile skills.",
        content: "",
        syncStatus: "BLANK",
      },
      {
        id: "preferences",
        title: "Role Preferences",
        helper: "Add target roles or locations. Applying this updates job preferences.",
        content: "",
        syncStatus: "BLANK",
      },
    ],
  };
}

function ensureState(sandboxId = DEMO_SANDBOX_ID) {
  const [{ count = 0 } = { count: 0 }] = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sandbox_state WHERE id = ${sqlString(sandboxId)}`,
  );
  if (count > 0) {
    ensureHistoryState(sandboxId);
    return;
  }
  const profile = blankProfile();
  const resume = blankResume();
  runSql(
    `INSERT INTO sandbox_state (id, profile_json, resume_json, updated_at) VALUES (${sqlString(
      sandboxId,
    )}, ${sqlString(JSON.stringify(profile))}, ${sqlString(JSON.stringify(resume))}, ${sqlString(now())})`,
  );
  ensureHistoryState(sandboxId);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeProfile(profile: Partial<SandboxProfile>): SandboxProfile {
  const fallback = blankProfile();
  return {
    ...fallback,
    ...profile,
    email: typeof profile.email === "string" ? profile.email : fallback.email,
    fullName: typeof profile.fullName === "string" ? profile.fullName : fallback.fullName,
    headline: typeof profile.headline === "string" ? profile.headline : fallback.headline,
    location: typeof profile.location === "string" ? profile.location : fallback.location,
    summary: typeof profile.summary === "string" ? profile.summary : fallback.summary,
    experience: typeof profile.experience === "string" ? profile.experience : fallback.experience,
    skills: Array.isArray(profile.skills) ? profile.skills : fallback.skills,
    credentials: Array.isArray(profile.credentials) ? profile.credentials : fallback.credentials,
    preferences: {
      roles: Array.isArray(profile.preferences?.roles) ? profile.preferences.roles : fallback.preferences.roles,
      locations: Array.isArray(profile.preferences?.locations)
        ? profile.preferences.locations
        : fallback.preferences.locations,
    },
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : fallback.updatedAt,
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

function getStateRow(sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  ensureState(sandboxId);
  const [row] = querySql<{ profile_json: string; resume_json: string }>(
    `SELECT profile_json, resume_json FROM sandbox_state WHERE id = ${sqlString(sandboxId)}`,
  );
  if (row) return row;
  resetSandbox(sandboxId);
  return querySql<{ profile_json: string; resume_json: string }>(
    `SELECT profile_json, resume_json FROM sandbox_state WHERE id = ${sqlString(sandboxId)}`,
  )[0];
}

let initialized = false;
function initializeDatabaseIfNeeded() {
  if (initialized) return;
  initialized = true;
  initializeDatabase();
}

function getStoredProfile(sandboxId = DEMO_SANDBOX_ID) {
  const row = getStateRow(sandboxId);
  return normalizeProfile(parseJson<Partial<SandboxProfile>>(row?.profile_json, blankProfile()));
}

function getStoredResume(sandboxId = DEMO_SANDBOX_ID) {
  const row = getStateRow(sandboxId);
  return normalizeResume(
    parseJson<Partial<SandboxResume>>(row?.resume_json, blankResume()),
    getStoredProfile(sandboxId),
  );
}

function saveState(profile: SandboxProfile, resume: SandboxResume, sandboxId = DEMO_SANDBOX_ID) {
  const timestamp = now();
  runSql(
    `UPDATE sandbox_state SET profile_json = ${sqlString(
      JSON.stringify({ ...profile, updatedAt: profile.updatedAt || timestamp }),
    )}, resume_json = ${sqlString(
      JSON.stringify({ ...resume, updatedAt: resume.updatedAt || timestamp }),
    )}, updated_at = ${sqlString(timestamp)} WHERE id = ${sqlString(sandboxId)}`,
  );
}

function mapResumeFromJson(value: unknown) {
  return normalizeResume(parseJson<Partial<SandboxResume>>(value, {}), blankProfile());
}

function ensureHistoryState(sandboxId = DEMO_SANDBOX_ID) {
  const [{ count = 0 } = { count: 0 }] = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sandbox_named_resume_versions WHERE sandbox_id = ${sqlString(sandboxId)}`,
  );
  if (count > 0) {
    const [{ active_count: activeCount = 0 } = { active_count: 0 }] = querySql<{ active_count: number }>(
      `SELECT COUNT(*) AS active_count FROM sandbox_active_resume_version WHERE sandbox_id = ${sqlString(sandboxId)}`,
    );
    if (activeCount > 0) return;
    const [latestVersion] = querySql<{ id: string }>(
      `SELECT id FROM sandbox_named_resume_versions WHERE sandbox_id = ${sqlString(
        sandboxId,
      )} ORDER BY updated_at DESC LIMIT 1`,
    );
    if (latestVersion?.id) {
      runSql(
        `INSERT OR REPLACE INTO sandbox_active_resume_version (sandbox_id, named_version_id) VALUES (${sqlString(
          sandboxId,
        )}, ${sqlString(latestVersion.id)})`,
      );
    }
    return;
  }

  const [state] = querySql<{ resume_json: string }>(
    `SELECT resume_json FROM sandbox_state WHERE id = ${sqlString(sandboxId)} LIMIT 1`,
  );
  const resume = mapResumeFromJson(state?.resume_json ?? JSON.stringify(blankResume()));
  const timestamp = now();
  const namedVersionId = randomUUID();

  runSql(
    `INSERT INTO sandbox_named_resume_versions (id, sandbox_id, title, purpose, status, source_version_id, active_revision_id, created_at, updated_at) VALUES (${[
      sqlString(namedVersionId),
      sqlString(sandboxId),
      sqlString(resume.title || "Untitled Live Résumé"),
      sqlString(resume.targetRole || "Primary résumé"),
      sqlString("ACTIVE"),
      "NULL",
      "NULL",
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})`,
  );

  const legacyRows = querySql<Record<string, unknown>>(
    `SELECT id, version_number, resume_json, source, created_at FROM sandbox_versions WHERE sandbox_id = ${sqlString(
      sandboxId,
    )} ORDER BY version_number ASC`,
  );

  let activeRevisionId: string | null = null;
  let nextRevisionNumber = 1;
  if (legacyRows.length > 0) {
    for (const row of legacyRows) {
      const revisionId = randomUUID();
      const revisionNumber = Number(row.version_number ?? nextRevisionNumber);
      runSql(
        `INSERT INTO sandbox_resume_revisions (id, sandbox_id, named_version_id, revision_number, resume_json, source, note, sync_summary_json, created_at) VALUES (${[
          sqlString(revisionId),
          sqlString(sandboxId),
          sqlString(namedVersionId),
          String(revisionNumber),
          sqlString(String(row.resume_json ?? JSON.stringify(resume))),
          sqlString(String(row.source ?? "legacy_save")),
          sqlString("Migrated from previous save history"),
          "NULL",
          sqlString(String(row.created_at ?? timestamp)),
        ].join(", ")})`,
      );
      activeRevisionId = revisionId;
      nextRevisionNumber = Math.max(nextRevisionNumber, revisionNumber + 1);
    }
  } else {
    activeRevisionId = writeRevision(resume, "initial_resume", sandboxId, namedVersionId, "Initial live résumé");
  }

  runSql(`
    UPDATE sandbox_named_resume_versions
      SET active_revision_id = ${sqlString(activeRevisionId)}, updated_at = ${sqlString(timestamp)}
      WHERE id = ${sqlString(namedVersionId)} AND sandbox_id = ${sqlString(sandboxId)};
    INSERT OR REPLACE INTO sandbox_active_resume_version (sandbox_id, named_version_id)
      VALUES (${sqlString(sandboxId)}, ${sqlString(namedVersionId)});
  `);
}

function getActiveNamedVersionId(sandboxId = DEMO_SANDBOX_ID) {
  ensureHistoryState(sandboxId);
  const [active] = querySql<{ named_version_id: string }>(
    `SELECT named_version_id FROM sandbox_active_resume_version WHERE sandbox_id = ${sqlString(sandboxId)} LIMIT 1`,
  );
  if (active?.named_version_id) {
    const [{ count = 0 } = { count: 0 }] = querySql<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sandbox_named_resume_versions WHERE id = ${sqlString(
        active.named_version_id,
      )} AND sandbox_id = ${sqlString(sandboxId)}`,
    );
    if (count > 0) return active.named_version_id;
  }
  const [latestVersion] = querySql<{ id: string }>(
    `SELECT id FROM sandbox_named_resume_versions WHERE sandbox_id = ${sqlString(
      sandboxId,
    )} ORDER BY updated_at DESC LIMIT 1`,
  );
  if (!latestVersion?.id) return null;
  runSql(
    `INSERT OR REPLACE INTO sandbox_active_resume_version (sandbox_id, named_version_id) VALUES (${sqlString(
      sandboxId,
    )}, ${sqlString(latestVersion.id)})`,
  );
  return latestVersion.id;
}

function namedVersionExists(namedVersionId: string, sandboxId = DEMO_SANDBOX_ID) {
  const [{ count = 0 } = { count: 0 }] = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sandbox_named_resume_versions WHERE id = ${sqlString(
      namedVersionId,
    )} AND sandbox_id = ${sqlString(sandboxId)}`,
  );
  return count > 0;
}

function setActiveNamedVersion(sandboxId: string, namedVersionId: string) {
  if (!namedVersionExists(namedVersionId, sandboxId)) return;
  runSql(
    `INSERT OR REPLACE INTO sandbox_active_resume_version (sandbox_id, named_version_id) VALUES (${sqlString(
      sandboxId,
    )}, ${sqlString(namedVersionId)})`,
  );
}

function writeRevision(
  resume: SandboxResume,
  source: string,
  sandboxId = DEMO_SANDBOX_ID,
  namedVersionId?: string | null,
  note?: string,
  syncSummary?: unknown,
) {
  const resolvedVersionId = namedVersionId ?? getActiveNamedVersionId(sandboxId);
  if (resolvedVersionId && !namedVersionExists(resolvedVersionId, sandboxId)) return null;
  if (!resolvedVersionId) return null;
  const [{ max_revision: maxRevision = 0 } = { max_revision: 0 }] = querySql<{ max_revision: number | null }>(
    `SELECT MAX(revision_number) AS max_revision FROM sandbox_resume_revisions WHERE sandbox_id = ${sqlString(
      sandboxId,
    )} AND named_version_id = ${sqlString(resolvedVersionId)}`,
  );
  const revisionId = randomUUID();
  const timestamp = now();
  runSql(`
    INSERT INTO sandbox_resume_revisions (id, sandbox_id, named_version_id, revision_number, resume_json, source, note, sync_summary_json, created_at) VALUES (${[
      sqlString(revisionId),
      sqlString(sandboxId),
      sqlString(resolvedVersionId),
      String(Number(maxRevision ?? 0) + 1),
      sqlString(JSON.stringify(resume)),
      sqlString(source),
      note ? sqlString(note) : "NULL",
      syncSummary === undefined ? "NULL" : sqlString(JSON.stringify(syncSummary)),
      sqlString(timestamp),
    ].join(", ")});
    UPDATE sandbox_named_resume_versions
      SET active_revision_id = ${sqlString(revisionId)}, updated_at = ${sqlString(timestamp)}
      WHERE id = ${sqlString(resolvedVersionId)} AND sandbox_id = ${sqlString(sandboxId)};
  `);
  return revisionId;
}

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

function normalizeListKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
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

function writeAudit(
  action: string,
  target: string,
  beforeValue: unknown,
  afterValue: unknown,
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  runSql(
    `INSERT INTO sandbox_audit (id, sandbox_id, action, target, before_value_json, after_value_json, created_at) VALUES (${[
      sqlString(randomUUID()),
      sqlString(sandboxId),
      sqlString(action),
      sqlString(target),
      sqlString(JSON.stringify(beforeValue ?? null)),
      sqlString(JSON.stringify(afterValue ?? null)),
      sqlString(now()),
    ].join(", ")})`,
  );
}

function insertProposal(
  proposal: Omit<SandboxProposal, "id" | "status" | "createdAt" | "decidedAt">,
  sandboxId = DEMO_SANDBOX_ID,
) {
  const inserted: SandboxProposal = {
    ...proposal,
    id: randomUUID(),
    status: "PENDING",
    createdAt: now(),
    decidedAt: null,
  };
  runSql(
    `INSERT INTO sandbox_proposals (id, sandbox_id, title, summary, target, scope, status, proposed_value_json, before_value_json, created_at, decided_at) VALUES (${[
      sqlString(inserted.id),
      sqlString(sandboxId),
      sqlString(inserted.title),
      sqlString(inserted.summary),
      sqlString(inserted.target),
      sqlString(inserted.scope),
      sqlString(inserted.status),
      sqlString(JSON.stringify(inserted.proposedValue ?? null)),
      sqlString(JSON.stringify(inserted.beforeValue ?? null)),
      sqlString(inserted.createdAt),
      sqlString(inserted.decidedAt),
    ].join(", ")})`,
  );
  writeAudit("PROPOSAL_CREATED", inserted.target, inserted.beforeValue, inserted.proposedValue, sandboxId);
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
      sectionIds.includes(section.id) && hasContent(section)
        ? { ...section, syncStatus }
        : section,
    ),
    updatedAt: now(),
  };
}

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
    versionNumber: Number(row.revision_number ?? row.version_number ?? 0),
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
  const parsedResult = parseJson<SandboxResumeImportReview>(
    row.parsed_result_json,
    {
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
    },
  );
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

export function getSandboxSnapshot(sandboxId = DEMO_SANDBOX_ID): SandboxSnapshot {
  initializeDatabaseIfNeeded();
  const activeVersionId = getActiveNamedVersionId(sandboxId);
  const revisions = activeVersionId
    ? querySql<Record<string, unknown>>(
        `SELECT id, named_version_id, revision_number, resume_json, source, note, sync_summary_json, created_at
         FROM sandbox_resume_revisions
         WHERE sandbox_id = ${sqlString(sandboxId)} AND named_version_id = ${sqlString(activeVersionId)}
         ORDER BY revision_number DESC`,
      ).map(mapRevision)
    : [];
  return {
    profile: getStoredProfile(sandboxId),
    resume: getStoredResume(sandboxId),
    activeVersionId,
    namedVersions: querySql<Record<string, unknown>>(
      `SELECT
        named_versions.*,
        active_revision.resume_json AS active_resume_json,
        (
          SELECT COUNT(*)
          FROM sandbox_resume_revisions AS revision_count
          WHERE revision_count.named_version_id = named_versions.id
            AND revision_count.sandbox_id = named_versions.sandbox_id
        ) AS revision_count
      FROM sandbox_named_resume_versions AS named_versions
      LEFT JOIN sandbox_resume_revisions AS active_revision
        ON active_revision.id = named_versions.active_revision_id
      WHERE named_versions.sandbox_id = ${sqlString(sandboxId)}
      ORDER BY named_versions.updated_at DESC`,
    ).map((row) => mapNamedVersion(row, activeVersionId)),
    revisions,
    proposals: querySql<Record<string, unknown>>(
      `SELECT * FROM sandbox_proposals WHERE sandbox_id = ${sqlString(sandboxId)} ORDER BY created_at DESC`,
    ).map(mapProposal),
    versions: revisions,
    audit: querySql<Record<string, unknown>>(
      `SELECT * FROM sandbox_audit WHERE sandbox_id = ${sqlString(
        sandboxId,
      )} ORDER BY created_at DESC LIMIT 20`,
    ).map(mapAudit),
    persistence: {
      kind: "sqlite",
      path: dbPath,
    },
  };
}

export function createSandboxProfile(input: SandboxSignupInput, sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  const profile = profileFromSignup(input);
  const resume = resumeFromProfile(profile);
  const timestamp = now();
  runSql(`
    DELETE FROM sandbox_state WHERE id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_versions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_named_resume_versions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_resume_revisions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_active_resume_version WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_proposals WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_audit WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_ai_interactions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_resume_imports WHERE sandbox_id = ${sqlString(sandboxId)};
    INSERT INTO sandbox_state (id, profile_json, resume_json, updated_at) VALUES (${sqlString(
      sandboxId,
    )}, ${sqlString(JSON.stringify(profile))}, ${sqlString(JSON.stringify(resume))}, ${sqlString(timestamp)});
  `);
  ensureHistoryState(sandboxId);
  writeAudit("PROFILE_CREATED_FROM_SIGNUP", "LiveResume", null, { profile, resume }, sandboxId);
  return getSandboxSnapshot(sandboxId);
}

export function saveSandboxDraft(
  sections: SandboxResumeSection[],
  targetRole: string,
  title?: string,
  changedSectionId?: SandboxResumeSection["id"],
  sandboxId = DEMO_SANDBOX_ID,
  namedVersionId?: string,
) {
  initializeDatabaseIfNeeded();
  const profile = getStoredProfile(sandboxId);
  const previousResume = getStoredResume(sandboxId);
  const activeVersionId =
    namedVersionId && namedVersionExists(namedVersionId, sandboxId)
      ? namedVersionId
      : getActiveNamedVersionId(sandboxId);
  if (activeVersionId) setActiveNamedVersion(sandboxId, activeVersionId);
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
        syncStatus: hasContent(section)
          ? shouldMarkDraft
            ? "DRAFT"
            : section.syncStatus
          : "BLANK",
      };
    }),
    updatedAt: timestamp,
  };
  saveState(profile, resume, sandboxId);
  writeRevision(
    resume,
    "manual_save",
    sandboxId,
    activeVersionId,
    changedSectionId ? `Saved ${changedSectionId} section` : "Saved changes",
  );
  writeAudit("RESUME_REVISION_SAVED", "Resume", previousResume, resume, sandboxId);
  return getSandboxSnapshot(sandboxId);
}

export function createSandboxNamedVersion(
  input: {
    title: string;
    purpose?: string;
    status?: SandboxResumeVersionStatus;
    sourceVersionId?: string;
    resume?: SandboxResume;
    source?: "blank" | "current" | "upload";
  },
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  const profile = getStoredProfile(sandboxId);
  const sourceVersionId = input.sourceVersionId || getActiveNamedVersionId(sandboxId);
  const storedResume = getStoredResume(sandboxId);
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
      syncStatus: section.content ? section.syncStatus === "SYNCED" ? "DRAFT" : section.syncStatus : "BLANK",
    })),
    updatedAt: timestamp,
  };

  runSql(
    `INSERT INTO sandbox_named_resume_versions (id, sandbox_id, title, purpose, status, source_version_id, active_revision_id, created_at, updated_at) VALUES (${[
      sqlString(namedVersionId),
      sqlString(sandboxId),
      sqlString(title),
      sqlString(input.purpose?.trim() || resume.targetRole || "Role-targeted version"),
      sqlString(status),
      sourceVersionId ? sqlString(sourceVersionId) : "NULL",
      "NULL",
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})`,
  );
  saveState(profile, resume, sandboxId);
  writeRevision(
    resume,
    input.source === "upload" ? "uploaded_resume_version_created" : "named_version_created",
    sandboxId,
    namedVersionId,
    input.source === "blank"
      ? "Created blank résumé version"
      : input.source === "upload"
        ? "Created résumé version from upload"
        : "Created named résumé version",
  );
  setActiveNamedVersion(sandboxId, namedVersionId);
  writeAudit(
    "NAMED_RESUME_VERSION_CREATED",
    "ResumeVersion",
    sourceVersionId,
    { id: namedVersionId, title, source: input.source ?? "current" },
    sandboxId,
  );
  return getSandboxSnapshot(sandboxId);
}

export function selectSandboxNamedVersion(namedVersionId: string, sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT
      named_versions.id,
      named_versions.title,
      active_revision.resume_json
    FROM sandbox_named_resume_versions AS named_versions
    LEFT JOIN sandbox_resume_revisions AS active_revision
      ON active_revision.id = named_versions.active_revision_id
    WHERE named_versions.id = ${sqlString(namedVersionId)}
      AND named_versions.sandbox_id = ${sqlString(sandboxId)}
    LIMIT 1`,
  );
  if (!row) return getSandboxSnapshot(sandboxId);

  const profile = getStoredProfile(sandboxId);
  const previousResume = getStoredResume(sandboxId);
  const resume = mapResumeFromJson(row.resume_json);
  setActiveNamedVersion(sandboxId, namedVersionId);
  saveState(profile, { ...resume, updatedAt: now() }, sandboxId);
  writeAudit(
    "NAMED_RESUME_VERSION_SELECTED",
    "ResumeVersion",
    { activeResume: previousResume.title },
    { versionId: namedVersionId, title: String(row.title ?? "") },
    sandboxId,
  );
  return getSandboxSnapshot(sandboxId);
}

export function restoreSandboxRevision(revisionId: string, sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT * FROM sandbox_resume_revisions WHERE id = ${sqlString(revisionId)} AND sandbox_id = ${sqlString(
      sandboxId,
    )} LIMIT 1`,
  );
  if (!row) return getSandboxSnapshot(sandboxId);

  const profile = getStoredProfile(sandboxId);
  const previousResume = getStoredResume(sandboxId);
  const restoredResume = mapResumeFromJson(row.resume_json);
  const namedVersionId = String(row.named_version_id ?? "");
  const timestamp = now();
  setActiveNamedVersion(sandboxId, namedVersionId);
  const restoredWithTimestamp = { ...restoredResume, updatedAt: timestamp };
  saveState(profile, restoredWithTimestamp, sandboxId);
  writeRevision(
    restoredWithTimestamp,
    "revision_restored",
    sandboxId,
    namedVersionId,
    `Restored from revision ${Number(row.revision_number ?? 0)}`,
  );
  writeAudit("RESUME_REVISION_RESTORED", "ResumeRevision", previousResume, restoredResume, sandboxId);
  return getSandboxSnapshot(sandboxId);
}

export function writeSandboxAiInteraction(input: {
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
  initializeDatabaseIfNeeded();
  const sandboxId = input.sandboxId ?? DEMO_SANDBOX_ID;
  const timestamp = now();
  const id = randomUUID();
  runSql(
    `INSERT INTO sandbox_ai_interactions (id, sandbox_id, task, model, fallback_model, status, input_metadata_json, parsed_output_json, raw_response_id, error, input_tokens, output_tokens, created_at, completed_at) VALUES (${[
      sqlString(id),
      sqlString(sandboxId),
      sqlString(input.task),
      sqlString(input.model),
      input.fallbackModel ? sqlString(input.fallbackModel) : "NULL",
      sqlString(input.status),
      input.inputMetadata === undefined ? "NULL" : sqlString(JSON.stringify(input.inputMetadata)),
      input.parsedOutput === undefined ? "NULL" : sqlString(JSON.stringify(input.parsedOutput)),
      input.rawResponseId ? sqlString(input.rawResponseId) : "NULL",
      input.error ? sqlString(input.error) : "NULL",
      input.inputTokens === undefined ? "NULL" : String(input.inputTokens),
      input.outputTokens === undefined ? "NULL" : String(input.outputTokens),
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})`,
  );
  return id;
}

export function createSandboxResumeImport(
  input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    extractedText: string;
    extractor: string;
    intent: SandboxResumeImportIntent;
    parsedResult: SandboxResumeImportReview;
  },
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  const timestamp = now();
  const id = randomUUID();
  runSql(
    `INSERT INTO sandbox_resume_imports (id, sandbox_id, file_name, content_type, size_bytes, extracted_text, extractor, intent, status, parsed_result_json, created_at, applied_at) VALUES (${[
      sqlString(id),
      sqlString(sandboxId),
      sqlString(input.fileName),
      sqlString(input.contentType),
      String(input.sizeBytes),
      sqlString(input.extractedText),
      sqlString(input.extractor),
      sqlString(input.intent),
      sqlString("PARSED"),
      sqlString(JSON.stringify(input.parsedResult)),
      sqlString(timestamp),
      "NULL",
    ].join(", ")})`,
  );
  writeAudit(
    "RESUME_IMPORT_PARSED",
    "ResumeImport",
    null,
    { id, fileName: input.fileName, intent: input.intent, extractedCharCount: input.extractedText.length },
    sandboxId,
  );
  return getSandboxResumeImport(id, sandboxId);
}

export function getSandboxResumeImport(importId: string, sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT * FROM sandbox_resume_imports WHERE id = ${sqlString(importId)} AND sandbox_id = ${sqlString(
      sandboxId,
    )} LIMIT 1`,
  );
  return row ? mapResumeImport(row) : null;
}

export function applySandboxResumeImport(
  importId: string,
  applyMode: SandboxResumeImportApplyMode,
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  const resumeImport = getSandboxResumeImport(importId, sandboxId);
  if (!resumeImport || resumeImport.status !== "PARSED") {
    return { ok: false as const, error: "Resume import was not found or has already been applied." };
  }

  const previousResume = getStoredResume(sandboxId);
  const importedResume = resumeFromImportReview(resumeImport.parsedResult, previousResume);
  const timestamp = now();

  if (applyMode === "create_version") {
    const snapshot = createSandboxNamedVersion(
      {
        title: importedResume.title,
        purpose: importedResume.targetRole,
        status: "DRAFT",
        resume: importedResume,
        source: "upload",
      },
      sandboxId,
    );
    runSql(
      `UPDATE sandbox_resume_imports SET status = 'APPLIED', applied_at = ${sqlString(timestamp)} WHERE id = ${sqlString(
        importId,
      )} AND sandbox_id = ${sqlString(sandboxId)}`,
    );
    writeAudit("RESUME_IMPORT_APPLIED", "ResumeImport", { id: importId }, { mode: applyMode }, sandboxId);
    return { ok: true as const, snapshot };
  }

  if (applyMode === "replace_current") {
    const profile = getStoredProfile(sandboxId);
    const activeVersionId = getActiveNamedVersionId(sandboxId);
    saveState(profile, importedResume, sandboxId);
    writeRevision(importedResume, "resume_upload_import", sandboxId, activeVersionId, "Applied uploaded résumé import");
    runSql(
      `UPDATE sandbox_resume_imports SET status = 'APPLIED', applied_at = ${sqlString(timestamp)} WHERE id = ${sqlString(
        importId,
      )} AND sandbox_id = ${sqlString(sandboxId)}`,
    );
    writeAudit("RESUME_IMPORT_APPLIED", "ResumeImport", previousResume, importedResume, sandboxId);
    return { ok: true as const, snapshot: getSandboxSnapshot(sandboxId) };
  }

  return { ok: false as const, error: "Use the sign-up import review to fill sign-up fields before account creation." };
}

function shouldAnalyzeSection(
  sectionId: SandboxResumeSection["id"],
  focusedSectionId?: SandboxResumeSection["id"],
) {
  return !focusedSectionId || focusedSectionId === sectionId;
}

export function analyzeSandboxResume(
  focusedSectionId?: SandboxResumeSection["id"],
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  const profile = getStoredProfile(sandboxId);
  const resume = getStoredResume(sandboxId);
  runSql(
    `UPDATE sandbox_proposals SET status = 'REJECTED', decided_at = ${sqlString(
      now(),
    )} WHERE sandbox_id = ${sqlString(sandboxId)} AND status = 'PENDING'`,
  );

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
      insertProposal({
        title: "Update profile summary",
        summary: "Use the résumé summary as the structured profile summary.",
        target: "PROFILE_SUMMARY",
        scope: "UPDATE_PROFILE",
        beforeValue: { summary: profile.summary },
        proposedValue: { summary: summarySection.content.trim() },
      }, sandboxId),
    );
  }

  if (!focusedSectionId && resume.targetRole.trim() && resume.targetRole.trim() !== profile.headline.trim()) {
    proposals.push(
      insertProposal({
        title: "Sync target role to profile headline",
        summary: "Use the résumé target role as the profile headline and a job preference.",
        target: "HEADLINE",
        scope: "UPDATE_PROFILE",
        beforeValue: { headline: profile.headline, roles: profile.preferences.roles },
        proposedValue: { headline: resume.targetRole.trim(), roles: [resume.targetRole.trim()] },
      }, sandboxId),
    );
  }

  if (
    shouldAnalyzeSection("experience", focusedSectionId) &&
    experienceSection &&
    hasContent(experienceSection) &&
    normalizeComparableText(experienceSection.content) !== normalizeComparableText(profile.experience)
  ) {
    proposals.push(
      insertProposal({
        title: "Update profile experience",
        summary: "Use the live résumé experience section as the structured profile experience.",
        target: "EXPERIENCE",
        scope: "UPDATE_PROFILE",
        beforeValue: { experience: profile.experience },
        proposedValue: { experience: experienceSection.content.trim() },
      }, sandboxId),
    );
  }

  if (shouldAnalyzeSection("credentials", focusedSectionId) && credentialsSection) {
    const credentials = hasContent(credentialsSection) ? normalizeList(credentialsSection.content) : [];
    const addedCredentials = listDifference(credentials, profile.credentials);
    const removedCredentials = listDifference(profile.credentials, credentials);
    if (addedCredentials.length > 0 || removedCredentials.length > 0) {
      proposals.push(
        insertProposal({
          title: "Update profile credentials",
          summary:
            removedCredentials.length > 0
              ? "Review credentials added or removed in the résumé before changing the public profile."
              : "Move confirmed licenses, certifications, or credentials from the résumé into the structured profile.",
          target: "CREDENTIALS",
          scope: "UPDATE_PROFILE",
          beforeValue: { credentials: profile.credentials },
          proposedValue: { credentials, addedCredentials, removedCredentials },
        }, sandboxId),
      );
    }
  }

  if (shouldAnalyzeSection("skills", focusedSectionId) && skillsSection) {
    const skills = hasContent(skillsSection) ? normalizeList(skillsSection.content) : [];
    const addedSkills = listDifference(skills, profile.skills);
    const removedSkills = listDifference(profile.skills, skills);
    if (addedSkills.length > 0 || removedSkills.length > 0) {
      proposals.push(
        insertProposal({
          title: "Update profile skills",
          summary:
            removedSkills.length > 0
              ? "Review skills added or removed in the résumé before changing the public profile."
              : "Add résumé skills to the structured profile so future packets can reuse them.",
          target: "SKILLS",
          scope: "UPDATE_PROFILE",
          beforeValue: { skills: profile.skills },
          proposedValue: { skills, addedSkills, removedSkills },
        }, sandboxId),
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
        insertProposal({
          title: "Update job preferences",
          summary: "Treat these résumé targeting notes as job preference roles or locations.",
          target: "PREFERENCES",
          scope: "UPDATE_PROFILE",
          beforeValue: { preferences: profile.preferences },
          proposedValue: { roles: newRoles, locations: newLocations },
        }, sandboxId),
      );
    }
  }

  const proposalSectionIds = new Set(
    proposals.flatMap((proposal) => sectionIdsForProposal(proposal)),
  );
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
  saveState(profile, updatedResume, sandboxId);
  writeAudit("ANALYZED", "Resume", { pendingProposals: 0 }, { pendingProposals: proposals.length }, sandboxId);
  return getSandboxSnapshot(sandboxId);
}

export function decideSandboxProposal(
  proposalId: string,
  decision: "APPLY" | "KEEP_RESUME_ONLY" | "REJECT",
  sandboxId = DEMO_SANDBOX_ID,
) {
  initializeDatabaseIfNeeded();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT * FROM sandbox_proposals WHERE id = ${sqlString(proposalId)} AND sandbox_id = ${sqlString(sandboxId)}`,
  );
  if (!row) return getSandboxSnapshot(sandboxId);

  const proposal = mapProposal(row);
  const profile = getStoredProfile(sandboxId);
  const resume = getStoredResume(sandboxId);
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

  saveState(nextProfile, nextResume, sandboxId);
  runSql(
    `UPDATE sandbox_proposals SET status = ${sqlString(status)}, decided_at = ${sqlString(
      now(),
    )} WHERE id = ${sqlString(proposal.id)} AND sandbox_id = ${sqlString(sandboxId)}`,
  );
  writeAudit(
    decision === "REJECT" ? "PROPOSAL_REJECTED" : decision === "KEEP_RESUME_ONLY" ? "KEPT_RESUME_ONLY" : "PROFILE_UPDATED",
    proposal.target,
    previousProfile,
    decision === "REJECT" ? previousProfile : nextProfile,
    sandboxId,
  );
  return getSandboxSnapshot(sandboxId);
}

export function resetSandbox(sandboxId = DEMO_SANDBOX_ID) {
  initializeDatabaseIfNeeded();
  const profile = blankProfile();
  const resume = blankResume();
  const timestamp = now();
  runSql(`
    DELETE FROM sandbox_state WHERE id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_versions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_named_resume_versions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_resume_revisions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_active_resume_version WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_proposals WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_audit WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_ai_interactions WHERE sandbox_id = ${sqlString(sandboxId)};
    DELETE FROM sandbox_resume_imports WHERE sandbox_id = ${sqlString(sandboxId)};
    INSERT INTO sandbox_state (id, profile_json, resume_json, updated_at) VALUES (${sqlString(
      sandboxId,
    )}, ${sqlString(JSON.stringify(profile))}, ${sqlString(JSON.stringify(resume))}, ${sqlString(timestamp)});
  `);
  ensureHistoryState(sandboxId);
  writeAudit("SANDBOX_RESET", "Sandbox", null, { profile, resume }, sandboxId);
  return getSandboxSnapshot(sandboxId);
}

export function sandboxDatabasePath() {
  return dbPath;
}
