import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for server database access.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__kobbysPrisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__kobbysPrisma = prisma;
}
