import pg from "pg";

import {
  cleanupProductionDummyCustomers,
  requireCustomerCleanupConfirmation,
} from "./production-customer-cleanup.js";
import { verifyProductionDatabase } from "./production-admin-provisioning.js";

const argumentsList = process.argv.slice(2);
requireCustomerCleanupConfirmation(argumentsList);

const { prisma } = await import("../src/lib/prisma.js");

try {
  await cleanupProductionDummyCustomers({
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
