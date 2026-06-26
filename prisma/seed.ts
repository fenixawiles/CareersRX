import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { DEFAULT_EEO_STATEMENT } from "../lib/constants";
import slugify from "slugify";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slug(input: string, salt: string) {
  return `${slugify(input, { lower: true, strict: true })}-${salt}`;
}

const COMPANIES = [
  {
    name: "Sunrise Gardens Senior Living",
    city: "Sarasota",
    state: "FL",
    type: "ASSISTED_LIVING" as const,
    blurb:
      "A family-owned assisted living community on Florida's Gulf Coast, caring for residents since 1998.",
  },
  {
    name: "Magnolia Trace Memory Care",
    city: "Austin",
    state: "TX",
    type: "MEMORY_CARE" as const,
    blurb:
      "Specialized memory care with a person-centered approach, serving the greater Austin area.",
  },
  {
    name: "Pacific Vista Health & Rehabilitation",
    city: "San Diego",
    state: "CA",
    type: "SKILLED_NURSING" as const,
    blurb:
      "Skilled nursing and short-term rehabilitation overlooking the Pacific, with a 4.5-star CMS rating.",
  },
  {
    name: "Desert Bloom Retirement Community",
    city: "Phoenix",
    state: "AZ",
    type: "CCRC" as const,
    blurb:
      "A continuing care retirement community offering independent living through skilled nursing.",
  },
  {
    name: "Bayou Comfort Hospice",
    city: "New Orleans",
    state: "LA",
    type: "HOSPICE" as const,
    blurb:
      "Compassionate hospice and palliative care delivered in homes and facilities across southern Louisiana.",
  },
];

type JobSeed = {
  title: string;
  category: string;
  jobType: "FULL_TIME" | "PART_TIME" | "PRN" | "PER_DIEM";
  shifts: ("DAY" | "EVENING" | "NIGHT" | "OVERNIGHT" | "WEEKEND" | "FLEXIBLE")[];
  payType: "HOURLY" | "ANNUAL";
  min: number; // cents
  max: number; // cents
  licenses?: string[];
  certs?: string[];
  signOn?: number;
  summary: string;
};

const JOB_TEMPLATES: JobSeed[] = [
  {
    title: "Registered Nurse (RN) — Assisted Living",
    category: "Nursing (RN/LPN)",
    jobType: "FULL_TIME",
    shifts: ["DAY"],
    payType: "HOURLY",
    min: 3600_0 / 10,
    max: 4200_0 / 10,
    licenses: ["RN"],
    certs: ["BLS", "CPR"],
    signOn: 5000_00,
    summary:
      "Lead resident care and supervise a team of caregivers in a warm assisted living setting.",
  },
  {
    title: "Certified Nursing Assistant (CNA)",
    category: "Certified Nursing Assistant (CNA)",
    jobType: "FULL_TIME",
    shifts: ["DAY", "EVENING"],
    payType: "HOURLY",
    min: 1800_0 / 10,
    max: 2200_0 / 10,
    licenses: ["CNA"],
    certs: ["CPR"],
    summary:
      "Provide hands-on daily care, dignity, and companionship to the residents we serve.",
  },
  {
    title: "Licensed Practical Nurse (LPN)",
    category: "Nursing (RN/LPN)",
    jobType: "FULL_TIME",
    shifts: ["NIGHT"],
    payType: "HOURLY",
    min: 2800_0 / 10,
    max: 3400_0 / 10,
    licenses: ["LPN"],
    certs: ["BLS"],
    signOn: 3000_00,
    summary:
      "Administer medications and treatments and partner with families on resident wellness.",
  },
  {
    title: "Memory Care Aide",
    category: "Memory Care",
    jobType: "PART_TIME",
    shifts: ["EVENING"],
    payType: "HOURLY",
    min: 1900_0 / 10,
    max: 2300_0 / 10,
    certs: ["CPR"],
    summary:
      "Support residents living with dementia through structured, compassionate daily routines.",
  },
  {
    title: "Resident Caregiver",
    category: "Caregiver / Resident Aide",
    jobType: "FULL_TIME",
    shifts: ["DAY"],
    payType: "HOURLY",
    min: 1700_0 / 10,
    max: 2000_0 / 10,
    summary:
      "Assist residents with activities of daily living in a supportive team environment.",
  },
  {
    title: "Activities & Recreation Coordinator",
    category: "Activities & Recreation",
    jobType: "FULL_TIME",
    shifts: ["DAY"],
    payType: "ANNUAL",
    min: 42000_00,
    max: 52000_00,
    summary:
      "Design engaging programming that keeps residents active, connected, and joyful.",
  },
  {
    title: "Executive Director",
    category: "Administration & Leadership",
    jobType: "FULL_TIME",
    shifts: ["DAY"],
    payType: "ANNUAL",
    min: 95000_00,
    max: 130000_00,
    summary:
      "Lead community operations, census growth, and a culture of exceptional resident care.",
  },
  {
    title: "Dietary Aide",
    category: "Dietary & Culinary",
    jobType: "PART_TIME",
    shifts: ["DAY"],
    payType: "HOURLY",
    min: 1500_0 / 10,
    max: 1800_0 / 10,
    summary:
      "Help prepare and serve nourishing meals that residents look forward to every day.",
  },
  {
    title: "Hospice Registered Nurse",
    category: "Hospice & Palliative Care",
    jobType: "FULL_TIME",
    shifts: ["FLEXIBLE"],
    payType: "ANNUAL",
    min: 78000_00,
    max: 92000_00,
    licenses: ["RN"],
    certs: ["BLS"],
    signOn: 7500_00,
    summary:
      "Provide skilled, compassionate end-of-life care to patients and their families.",
  },
  {
    title: "Med Tech / Medication Aide",
    category: "Med Tech / Medication Aide",
    jobType: "FULL_TIME",
    shifts: ["EVENING"],
    payType: "HOURLY",
    min: 2000_0 / 10,
    max: 2400_0 / 10,
    certs: ["Medication Aide Certification"],
    summary:
      "Safely administer medications and monitor resident response under nurse supervision.",
  },
  {
    title: "Weekend Caregiver (PRN)",
    category: "Caregiver / Resident Aide",
    jobType: "PRN",
    shifts: ["WEEKEND"],
    payType: "HOURLY",
    min: 1900_0 / 10,
    max: 2300_0 / 10,
    summary: "Flexible weekend shifts supporting residents when they need it most.",
  },
  {
    title: "Physical Therapy Assistant",
    category: "Physical / Occupational Therapy",
    jobType: "FULL_TIME",
    shifts: ["DAY"],
    payType: "HOURLY",
    min: 3000_0 / 10,
    max: 3600_0 / 10,
    licenses: ["PTA"],
    summary:
      "Help residents rebuild strength and independence through guided therapy plans.",
  },
];

const createdJobs: { id: string; title: string; companyName: string }[] = [];

async function main() {
  console.log("Seeding CareersRX…");

  // ── Reset job-related data so re-running the seed is idempotent ──
  // (Jobs use create(), not upsert, so we clear them first to avoid duplicates.)
  await prisma.careerSyncAuditLog.deleteMany();
  await prisma.resumeSyncProposal.deleteMany();
  await prisma.applicationPacket.deleteMany();
  await prisma.aiInteraction.deleteMany();
  await prisma.resumeSection.deleteMany();
  await prisma.resumeVersion.deleteMany();
  await prisma.resumeDocument.deleteMany();
  await prisma.careerCredential.deleteMany();
  await prisma.workHistoryEntry.deleteMany();
  await prisma.educationEntry.deleteMany();
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.screeningAnswer.deleteMany();
  await prisma.application.deleteMany();
  await prisma.savedJob.deleteMany();
  await prisma.jobView.deleteMany();
  await prisma.screeningQuestion.deleteMany();
  await prisma.job.deleteMany();
  console.log("  ✓ cleared existing jobs & applications");

  // ── Admin user ──
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@suncurejobs.com";
  const adminHash =
    process.env.ADMIN_SEED_PASSWORD_HASH ??
    "$2b$12$wZhRRe.IX3tn5cYTwPwwquFWf1sZHResozGr1AzpBzgHTXxcTVrqy"; // "admin1234"

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      isAdmin: true,
      emailVerified: new Date(),
      name: "Site Admin",
    },
  });
  console.log(`  ✓ admin user (${adminEmail})`);

  // ── Companies, facilities, employer users, jobs ──
  let jobCount = 0;
  for (let c = 0; c < COMPANIES.length; c++) {
    const co = COMPANIES[c];
    const companySlug = slugify(co.name, { lower: true, strict: true });

    const employerEmail = `employer${c + 1}@suncurejobs.com`;
    const employer = await prisma.user.upsert({
      where: { email: employerEmail },
      update: {},
      create: {
        email: employerEmail,
        passwordHash: adminHash, // reuse hash for dev convenience
        emailVerified: new Date(),
        name: `${co.name} Hiring`,
      },
    });

    const company = await prisma.company.upsert({
      where: { slug: companySlug },
      update: {},
      create: {
        slug: companySlug,
        name: co.name,
        description: co.blurb,
        contactEmail: employerEmail,
        phone: "(555) 010-0" + (100 + c),
        website: `https://${companySlug}.example.com`,
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        facilities: {
          create: {
            name: `${co.name} — ${co.city}`,
            type: co.type,
            address: `${100 + c * 11} Wellness Way`,
            city: co.city,
            state: co.state,
            zip: "00000",
          },
        },
      },
      include: { facilities: true },
    });

    const companyUser = await prisma.companyUser.upsert({
      where: { userId_companyId: { userId: employer.id, companyId: company.id } },
      update: {},
      create: {
        userId: employer.id,
        companyId: company.id,
        role: "OWNER",
      },
    });

    const facility = company.facilities[0];

    // Give each company a rotating subset of job templates
    const templates = JOB_TEMPLATES.filter((_, i) => (i + c) % 2 === 0).concat(
      JOB_TEMPLATES.filter((_, i) => (i + c) % 5 === 0),
    );

    for (let j = 0; j < templates.length; j++) {
      const t = templates[j];
      const daysAgo = Math.floor(Math.random() * 20);
      const publishedAt = new Date(Date.now() - daysAgo * 86400000);
      const expiresAt = new Date(publishedAt.getTime() + 30 * 86400000);

      const description = `<h2>About the role</h2><p>${t.summary}</p><h2>What you'll do</h2><ul><li>Deliver compassionate, resident-first care every shift</li><li>Collaborate with an interdisciplinary care team</li><li>Document care accurately and communicate with families</li></ul><h2>Why ${co.name}</h2><p>${co.blurb}</p>`;

      const createdJob = await prisma.job.create({
        data: {
          slug: slug(`${t.title}-${co.city}`, `${c}${j}${daysAgo}`),
          companyId: company.id,
          facilityId: facility.id,
          postedById: companyUser.id,
          title: t.title,
          description,
          requirements:
            "<ul><li>Genuine compassion for older adults</li><li>Reliable, team-oriented, and dependable</li><li>Required licenses and certifications current</li></ul>",
          benefits:
            "<ul><li>Health, dental, and vision insurance</li><li>Paid time off and paid training</li><li>401(k) with match</li></ul>",
          category: t.category,
          facilityType: co.type,
          jobType: t.jobType,
          shifts: t.shifts,
          city: co.city,
          state: co.state,
          isRemote: false,
          salaryMinCents: t.min,
          salaryMaxCents: t.max,
          payType: t.payType,
          showSalary: true,
          signOnBonusCents: t.signOn ?? null,
          requiredLicenses: t.licenses ?? [],
          requiredCertifications: t.certs ?? [],
          bgCheckRequired: true,
          eeoStatement: DEFAULT_EEO_STATEMENT,
          status: "ACTIVE",
          moderationStatus: "COMPLETE",
          publishedAt,
          expiresAt,
          termsAcceptedAt: publishedAt,
        },
      });
      createdJobs.push({ id: createdJob.id, title: createdJob.title, companyName: co.name });
      jobCount++;
    }
    console.log(`  ✓ ${co.name} (+ employer, facility, jobs)`);
  }

  // ── Demo job seeker with profile, applications, and saved jobs ──
  const seekerEmail = "seeker@suncurejobs.com";
  const seekerUser = await prisma.user.upsert({
    where: { email: seekerEmail },
    update: {},
    create: {
      email: seekerEmail,
      passwordHash: adminHash, // "admin1234" for dev convenience
      emailVerified: new Date(),
      name: "Maria Delgado",
    },
  });

  const seeker = await prisma.seekerProfile.upsert({
    where: { userId: seekerUser.id },
    update: {
      firstName: "Maria",
      lastName: "Delgado",
      phone: "(555) 200-1188",
      city: "Tampa",
      state: "FL",
      bio: "Compassionate CNA with 6 years in assisted living and memory care. Passionate about resident dignity and family communication.",
      skills: ["Activities of Daily Living", "Dementia Care", "Vitals", "Charting"],
      licenses: ["CNA"],
      certifications: ["CPR", "BLS"],
      preferredCategories: ["Certified Nursing Assistant (CNA)", "Memory Care"],
      preferredJobTypes: ["FULL_TIME", "PART_TIME"],
      preferredStates: ["FL", "GA"],
      preferredShifts: ["DAY", "EVENING"],
      desiredPayMinCents: 2000_0 / 10,
      willingToRelocate: false,
      profileComplete: true,
    },
    create: {
      userId: seekerUser.id,
      firstName: "Maria",
      lastName: "Delgado",
      phone: "(555) 200-1188",
      city: "Tampa",
      state: "FL",
      bio: "Compassionate CNA with 6 years in assisted living and memory care. Passionate about resident dignity and family communication.",
      skills: ["Activities of Daily Living", "Dementia Care", "Vitals", "Charting"],
      licenses: ["CNA"],
      certifications: ["CPR", "BLS"],
      preferredCategories: ["Certified Nursing Assistant (CNA)", "Memory Care"],
      preferredJobTypes: ["FULL_TIME", "PART_TIME"],
      preferredStates: ["FL", "GA"],
      preferredShifts: ["DAY", "EVENING"],
      desiredPayMinCents: 2000_0 / 10,
      willingToRelocate: false,
      profileComplete: true,
    },
  });

  await prisma.careerCredential.createMany({
    data: [
      {
        seekerId: seeker.id,
        kind: "LICENSE",
        name: "Certified Nursing Assistant",
        issuer: "Florida Board of Nursing",
        state: "FL",
        status: "ACTIVE",
        licenseNumber: "CNA-245817",
        issuedAt: new Date("2018-06-01"),
        expiresAt: new Date("2027-05-31"),
      },
      {
        seekerId: seeker.id,
        kind: "CERTIFICATION",
        name: "CPR",
        issuer: "American Heart Association",
        status: "ACTIVE",
        issuedAt: new Date("2025-02-01"),
        expiresAt: new Date("2027-02-01"),
      },
      {
        seekerId: seeker.id,
        kind: "CERTIFICATION",
        name: "BLS",
        issuer: "American Heart Association",
        status: "ACTIVE",
        issuedAt: new Date("2025-02-01"),
        expiresAt: new Date("2027-02-01"),
      },
    ],
  });

  await prisma.workHistoryEntry.createMany({
    data: [
      {
        seekerId: seeker.id,
        employer: "Sunrise Gardens Senior Living",
        title: "Certified Nursing Assistant",
        facilityType: "Assisted Living",
        city: "Tampa",
        state: "FL",
        startDate: new Date("2021-04-01"),
        current: true,
        description:
          "Provide hands-on resident care, monitor vitals, and coordinate family updates across a 48-bed assisted living wing.",
        highlights: [
          "Reduced missed charting items by helping standardize end-of-shift notes.",
          "Recognized for calm redirection and family communication in memory care.",
        ],
        skills: ["Activities of Daily Living", "Vitals", "Charting", "Family Communication"],
      },
      {
        seekerId: seeker.id,
        employer: "Magnolia Trace Memory Care",
        title: "Memory Care Aide",
        facilityType: "Memory Care",
        city: "Austin",
        state: "TX",
        startDate: new Date("2018-07-01"),
        endDate: new Date("2021-03-01"),
        description:
          "Supported residents living with dementia through daily routines, mobility support, and structured activities.",
        highlights: [
          "Partnered with nurses to track behavior changes and fall-risk concerns.",
          "Mentored three new caregivers on dementia care routines.",
        ],
        skills: ["Dementia Care", "Mobility Support", "Resident Engagement"],
      },
    ],
  });

  await prisma.educationEntry.create({
    data: {
      seekerId: seeker.id,
      school: "Hillsborough Community College",
      degree: "Certified Nursing Assistant Program",
      field: "Patient Care",
      endDate: new Date("2018-05-01"),
      description: "Completed CNA coursework, clinical rotation, and state exam preparation.",
    },
  });

  const baseResumeSections = [
    {
      type: "SUMMARY" as const,
      title: "Professional Summary",
      content:
        "Compassionate Certified Nursing Assistant with 6 years of experience across assisted living and memory care. Known for resident dignity, clear family communication, and reliable charting.",
      syncStatus: "SYNCED" as const,
      linkedEntityType: "SeekerProfile",
    },
    {
      type: "LICENSES" as const,
      title: "Licenses & Certifications",
      content:
        "Certified Nursing Assistant — Florida Board of Nursing\nCPR — American Heart Association\nBLS — American Heart Association",
      syncStatus: "SYNCED" as const,
      linkedEntityType: "CareerCredential",
    },
    {
      type: "EXPERIENCE" as const,
      title: "Experience",
      content:
        "Certified Nursing Assistant, Sunrise Gardens Senior Living — Tampa, FL\n• Provide hands-on resident care across assisted living and memory care.\n• Monitor vitals, document care notes, and escalate changes to nursing staff.\n• Support family communication with calm, timely updates.\n\nMemory Care Aide, Magnolia Trace Memory Care — Austin, TX\n• Supported dementia care routines, mobility, engagement, and family-centered care.",
      syncStatus: "SYNCED" as const,
      linkedEntityType: "WorkHistoryEntry",
    },
    {
      type: "SKILLS" as const,
      title: "Skills",
      content: "Activities of Daily Living · Dementia Care · Vitals · Charting · Family Communication",
      syncStatus: "SYNCED" as const,
      linkedEntityType: "SeekerProfile.skills",
    },
  ];

  const resumeText = baseResumeSections
    .map((section) => `${section.title}\n${section.content}`)
    .join("\n\n");

  const primaryResume = await prisma.resumeDocument.create({
    data: {
      seekerId: seeker.id,
      title: "Maria Delgado — Live Résumé",
      targetRole: "Certified Nursing Assistant",
      status: "ACTIVE",
      variantLabel: "Primary",
    },
  });

  await Promise.all(
    baseResumeSections.map((section, order) =>
      prisma.resumeSection.create({
        data: {
          documentId: primaryResume.id,
          type: section.type,
          title: section.title,
          content: section.content,
          order,
          linkedEntityType: section.linkedEntityType,
          syncStatus: section.syncStatus,
        },
      }),
    ),
  );

  const primaryVersion = await prisma.resumeVersion.create({
    data: {
      documentId: primaryResume.id,
      versionNumber: 1,
      contentJson: { sections: baseResumeSections },
      renderedText: resumeText,
      renderedHtml: baseResumeSections
        .map((section) => `<section><h2>${section.title}</h2><p>${section.content.replaceAll("\n", "<br />")}</p></section>`)
        .join(""),
      sourceType: "seed",
      createdById: seekerUser.id,
    },
  });

  await prisma.resumeDocument.update({
    where: { id: primaryResume.id },
    data: { activeVersionId: primaryVersion.id },
  });

  const npVariant = await prisma.resumeDocument.create({
    data: {
      seekerId: seeker.id,
      title: "Maria Delgado — NP Transition Draft",
      targetRole: "Nurse Practitioner",
      status: "DRAFT",
      variantLabel: "NP-targeted",
      baseDocumentId: primaryResume.id,
    },
  });

  const npSections = [
    ...baseResumeSections.slice(0, 3),
    {
      type: "CUSTOM" as const,
      title: "Role Targeting Notes",
      content:
        "Draft variant for future NP-track applications. Credential claims require confirmation before profile sync or export.",
      syncStatus: "AI_DRAFT" as const,
      linkedEntityType: "ResumeVariant",
    },
  ];

  await Promise.all(
    npSections.map((section, order) =>
      prisma.resumeSection.create({
        data: {
          documentId: npVariant.id,
          type: section.type,
          title: section.title,
          content: section.content,
          order,
          linkedEntityType: section.linkedEntityType,
          syncStatus: section.syncStatus,
        },
      }),
    ),
  );

  const npVersion = await prisma.resumeVersion.create({
    data: {
      documentId: npVariant.id,
      versionNumber: 1,
      contentJson: { sections: npSections },
      renderedText: npSections.map((section) => `${section.title}\n${section.content}`).join("\n\n"),
      renderedHtml: npSections
        .map((section) => `<section><h2>${section.title}</h2><p>${section.content.replaceAll("\n", "<br />")}</p></section>`)
        .join(""),
      sourceType: "seed_variant",
      aiGenerated: true,
      createdById: seekerUser.id,
    },
  });

  await prisma.resumeDocument.update({
    where: { id: npVariant.id },
    data: { activeVersionId: npVersion.id },
  });

  const aiInteraction = await prisma.aiInteraction.create({
    data: {
      seekerId: seeker.id,
      task: "DETECT_RESUME_CHANGES",
      model: "demo-rules",
      fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.2",
      status: "SUCCEEDED",
      inputMetadata: {
        documentId: npVariant.id,
        previousVersionId: primaryVersion.id,
        currentVersionId: npVersion.id,
      },
      parsedOutput: {
        proposals: [
          "Review NP license claim before profile update",
          "Keep NP-targeting note resume-only",
          "Consider adding Nursing category preference",
        ],
      },
      completedAt: new Date(),
    },
  });

  await prisma.resumeSyncProposal.createMany({
    data: [
      {
        seekerId: seeker.id,
        documentId: npVariant.id,
        versionId: npVersion.id,
        aiInteractionId: aiInteraction.id,
        target: "LICENSES",
        scope: "PROFILE_UPDATE",
        title: "Review NP license before profile sync",
        summary:
          "The NP-targeted variant references future nurse practitioner positioning. Confirm an active credential before adding it to the structured profile.",
        reason: "CareersRX does not add credentials without explicit user confirmation and supporting details.",
        confidence: 52,
        beforeValue: { licenses: ["CNA"] },
        proposedValue: {
          credential: {
            kind: "LICENSE",
            name: "Nurse Practitioner",
            state: "FL",
            status: "REVIEW_REQUIRED",
          },
        },
      },
      {
        seekerId: seeker.id,
        documentId: npVariant.id,
        versionId: npVersion.id,
        aiInteractionId: aiInteraction.id,
        target: "PREFERENCES",
        scope: "PREFERENCES_UPDATE",
        title: "Add nursing roles to preferences",
        summary:
          "The variant targets a nursing pathway. Add Nursing (RN/LPN) to preferred categories without removing CNA or Memory Care.",
        confidence: 78,
        beforeValue: { preferredCategories: ["Certified Nursing Assistant (CNA)", "Memory Care"] },
        proposedValue: { preferredCategories: ["Nursing (RN/LPN)"] },
      },
      {
        seekerId: seeker.id,
        documentId: npVariant.id,
        versionId: npVersion.id,
        aiInteractionId: aiInteraction.id,
        target: "RESUME_VARIANT",
        scope: "RESUME_ONLY",
        title: "Keep NP transition note résumé-only",
        summary:
          "This wording is useful for the draft variant but should not change the public profile or job preferences.",
        confidence: 90,
        proposedValue: { resumeOnly: true, sectionTitle: "Role Targeting Notes" },
      },
    ],
  });

  const packetJob = createdJobs.find((job) => job.title.includes("Registered Nurse")) ?? createdJobs[0];
  if (packetJob) {
    await prisma.applicationPacket.create({
      data: {
        seekerId: seeker.id,
        jobId: packetJob.id,
        resumeDocumentId: primaryResume.id,
        resumeVersionId: primaryVersion.id,
        status: "READY",
        title: `${packetJob.title} packet`,
        coverLetter:
          "I’m excited to bring reliable resident care, documentation discipline, and family communication strengths to your team.",
        fitSummary:
          "Strong match for resident care, CPR/BLS, and senior-care experience. Missing RN license should be reviewed before applying.",
        supportedMatches: {
          skills: ["Activities of Daily Living", "Dementia Care", "Vitals", "Charting"],
          certifications: ["CPR", "BLS"],
        },
        missingRequirements: {
          licenses: ["RN"],
          note: "Do not add RN to profile unless Maria confirms an active license.",
        },
        snapshotMetadata: {
          resumeVersionId: primaryVersion.id,
          jobTitle: packetJob.title,
          companyName: packetJob.companyName,
        },
      },
    });
  }

  await prisma.careerSyncAuditLog.create({
    data: {
      seekerId: seeker.id,
      actorId: seekerUser.id,
      action: "RESUME_VERSION_CREATED",
      source: "seed",
      target: "ResumeDocument",
      entityId: primaryResume.id,
      afterValue: { activeVersionId: primaryVersion.id, variantId: npVariant.id },
    },
  });

  // Apply to the first few jobs with varied statuses
  const appStatuses = ["PENDING", "REVIEWED", "INTERVIEW", "REJECTED"] as const;
  const appJobs = createdJobs.slice(0, 4);
  for (let i = 0; i < appJobs.length; i++) {
    await prisma.application.upsert({
      where: { jobId_seekerId: { jobId: appJobs[i].id, seekerId: seeker.id } },
      update: {},
      create: {
        jobId: appJobs[i].id,
        seekerId: seeker.id,
        status: appStatuses[i],
        coverLetter:
          "I'd love to bring my caregiving experience to your community and support your residents with warmth and reliability.",
        source: "direct",
        createdAt: new Date(Date.now() - i * 2 * 86400000),
        statusHistory: {
          create: {
            toStatus: appStatuses[i],
            changedById: seekerUser.id,
            note: "Application submitted",
          },
        },
      },
    });
  }

  // Save a few other jobs
  const savedJobs = createdJobs.slice(5, 8);
  for (const sj of savedJobs) {
    await prisma.savedJob.upsert({
      where: { seekerId_jobId: { seekerId: seeker.id, jobId: sj.id } },
      update: {},
      create: { seekerId: seeker.id, jobId: sj.id },
    });
  }
  console.log(`  ✓ demo seeker (${seekerEmail}) with ${appJobs.length} applications, ${savedJobs.length} saved`);

  console.log(`Done. Seeded ${COMPANIES.length} companies and ${jobCount} active jobs.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
