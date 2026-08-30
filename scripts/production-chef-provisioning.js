import { verifyProductionDatabase } from "./production-admin-provisioning.js";

export const PRODUCTION_CHEF_CONFIRMATION = "--confirm-production-chef";

export function requireProductionChefConfirmation(argumentsList) {
  if (argumentsList.length !== 1 || argumentsList[0] !== PRODUCTION_CHEF_CONFIRMATION) {
    throw new Error(`Refusing Production CHEF provisioning without exactly ${PRODUCTION_CHEF_CONFIRMATION}.`);
  }
}

export async function provisionPrimaryChefProduction({ argumentsList, environment, prismaClient, verifyDatabase, audit = console.log }) {
  requireProductionChefConfirmation(argumentsList);
  const configuration = await verifyDatabase(environment);
  const chefEmail = environment.PRIMARY_CHEF_EMAIL?.trim().toLowerCase();
  if (!chefEmail) throw new Error("PRIMARY_CHEF_EMAIL is required.");
  if (chefEmail === configuration.primaryAdminEmail) throw new Error("PRIMARY_CHEF_EMAIL must not match PRIMARY_ADMIN_EMAIL.");
  const users = await prismaClient.user.findMany({ where: { email: { equals: chefEmail, mode: "insensitive" } }, select: { id: true, role: true }, take: 2 });
  if (users.length !== 1) throw new Error(users.length ? "Refusing to provision a duplicated chef identity." : "The chef Auth.js user does not exist. Sign in normally first.");
  const [user] = users;
  if (user.role === "ADMIN") throw new Error("Refusing to replace an ADMIN role with CHEF.");
  if (user.role === "CHEF") {
    audit(JSON.stringify({ ok: true, status: "already_chef", role: "CHEF" }));
    return { status: "already_chef", role: "CHEF" };
  }
  const updated = await prismaClient.user.update({ where: { id: user.id }, data: { role: "CHEF" }, select: { role: true } });
  audit(JSON.stringify({ ok: true, status: "provisioned", role: updated.role }));
  return { status: "provisioned", role: updated.role };
}

export function verifyChefProductionDatabase({ environment, createClient }) {
  return verifyProductionDatabase({ environment, createClient });
}
