import { bootstrapLocalAdmin } from "../lib/local-auth";

const email = process.env.ADMIN_SEED_EMAIL?.trim();

if (!email) {
  throw new Error("ADMIN_SEED_EMAIL must name an already registered user.");
}

const result = bootstrapLocalAdmin(email);
if (!result.ok) throw new Error(result.error);

console.log(`Bootstrapped local administrator: ${result.email}`);
