import { config } from "dotenv";
import pg from "pg";

import { verifyProductionDatabase } from "./production-admin-provisioning.js";
import { cleanupProductionTestOrders } from "./production-test-order-cleanup.js";

config({ path: ".env.admin-production.local", override: true, quiet: true });

const argumentsList = process.argv.slice(2);
const { prisma } = await import("../src/lib/prisma.js");

try {
  await cleanupProductionTestOrders({
    argumentsList,
    environment: process.env,
    prismaClient: prisma,
    verifyDatabase: (environment) =>
      verifyProductionDatabase({
        environment,
        createClient: (connectionString) => new pg.Client({ connectionString }),
      }),
  });
} finally {
  await prisma.$disconnect();
}
