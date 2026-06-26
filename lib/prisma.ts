import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

// Singleton pattern to avoid exhausting connections during dev hot-reload.
// Prisma 7's client requires a driver adapter. Locally we use the pg adapter
// against the Prisma local Postgres server. For production, swap PrismaPg for
// `@prisma/adapter-neon` (already installed) pointed at the Neon connection.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
