import { prisma } from "@/lib/prisma";

/*
  Demo-mode data helpers.

  The auth backend is not wired yet (Phase 2). For the clickable demo, the
  dashboards read representative seeded records so every screen is populated
  with realistic content. When real auth lands, these are replaced by the
  authenticated session's user/company.
*/

export const DEMO = {
  seekerEmail: "seeker@suncurejobs.com",
  adminEmail: "admin@suncurejobs.com",
};

export async function getDemoSeeker() {
  return prisma.seekerProfile.findFirst({
    where: { user: { email: DEMO.seekerEmail } },
    include: { user: true },
  });
}

export async function getDemoCompany() {
  // The first verified community stands in for "the logged-in employer".
  return prisma.company.findFirst({
    where: { verificationStatus: "APPROVED" },
    orderBy: { createdAt: "asc" },
    include: { facilities: true },
  });
}
