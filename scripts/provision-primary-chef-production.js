import pg from "pg";

import { provisionPrimaryChefProduction, requireProductionChefConfirmation, verifyChefProductionDatabase } from "./production-chef-provisioning.js";

const argumentsList = process.argv.slice(2);
requireProductionChefConfirmation(argumentsList);
const { prisma } = await import("../src/lib/prisma.js");
try {
  await provisionPrimaryChefProduction({
    argumentsList,
    environment: process.env,
    prismaClient: prisma,
    verifyDatabase: (environment) => verifyChefProductionDatabase({ environment, createClient: (connectionString) => new pg.Client({ connectionString }) }),
  });
} finally {
  await prisma.$disconnect();
}
