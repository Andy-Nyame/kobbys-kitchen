import { prisma } from "../src/lib/prisma.js";
import { verifyDevelopmentDatabase } from "./database-safety.js";

await verifyDevelopmentDatabase();
const email = process.env.PRIMARY_CHEF_EMAIL?.trim().toLowerCase();
if (!email) throw new Error("PRIMARY_CHEF_EMAIL is required.");

try {
  const users = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
    take: 2,
  });
  if (users.length !== 1) throw new Error(users.length ? "Refusing duplicated chef identity." : "The chef Auth.js user does not exist. Sign in normally first.");
  if (users[0].role === "ADMIN") throw new Error("Refusing to replace an ADMIN role with CHEF.");
  if (users[0].role === "CHEF") {
    console.log(JSON.stringify({ ok: true, status: "already_chef", role: "CHEF" }));
  } else {
    const updated = await prisma.user.update({ where: { id: users[0].id }, data: { role: "CHEF" }, select: { role: true } });
    console.log(JSON.stringify({ ok: true, status: "provisioned", role: updated.role }));
  }
} finally {
  await prisma.$disconnect();
}
