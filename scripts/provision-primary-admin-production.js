import pg from "pg";

import {
  provisionPrimaryAdminProduction,
  requireProductionConfirmation,
  validateProductionEnvironment,
  verifyProductionDatabase,
} from "./production-admin-provisioning.js";

const argumentsList = process.argv.slice(2);

requireProductionConfirmation(argumentsList);
validateProductionEnvironment(process.env);

const { prisma } = await import("../src/lib/prisma.js");

try {
  await provisionPrimaryAdminProduction({
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
