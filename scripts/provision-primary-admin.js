import { prisma } from "../src/lib/prisma.js";
import { verifyDevelopmentDatabase } from "./database-safety.js";

await verifyDevelopmentDatabase();

const email = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase();

if (!email) {
  throw new Error("PRIMARY_ADMIN_EMAIL is required.");
}

try {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!existing) {
    throw new Error("The primary admin Auth.js user does not exist. Create the account through the normal signup flow first.");
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role: "ADMIN" },
    select: { role: true },
  });

  console.log(`Primary admin provisioned with role ${user.role}.`);
} finally {
  await prisma.$disconnect();
}
