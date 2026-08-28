export const PRODUCTION_ADMIN_CONFIRMATION = "--confirm-production-admin";

function required(environment, name) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseNeonUrl(value, name, { pooled }) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} must use PostgreSQL.`);
  }

  if (!parsed.hostname.endsWith(".neon.tech")) {
    throw new Error(`${name} must target Neon PostgreSQL.`);
  }

  const isPooled = parsed.hostname.includes("-pooler");

  if (isPooled !== pooled) {
    throw new Error(`${name} must use the ${pooled ? "pooled" : "direct"} Neon host.`);
  }

  if (parsed.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(`${name} must use sslmode=verify-full.`);
  }

  return parsed;
}

function normalizedNeonHost(parsed) {
  return parsed.hostname.replace("-pooler", "");
}

export function requireProductionConfirmation(argumentsList) {
  if (
    argumentsList.length !== 1 ||
    argumentsList[0] !== PRODUCTION_ADMIN_CONFIRMATION
  ) {
    throw new Error(
      `Refusing Production provisioning without exactly ${PRODUCTION_ADMIN_CONFIRMATION}.`
    );
  }
}

export function validateProductionEnvironment(environment) {
  if (environment.APP_ENV !== "production") {
    throw new Error("Production provisioning requires APP_ENV=production.");
  }

  const databaseUrl = required(environment, "DATABASE_URL");
  const directDatabaseUrl = required(environment, "DATABASE_URL_UNPOOLED");
  const expectedProjectId = required(environment, "NEON_PROJECT_ID");
  const expectedBranchId = required(environment, "NEON_BRANCH_ID");
  const developmentBranchId = required(environment, "NEON_DEVELOPMENT_BRANCH_ID");
  const primaryAdminEmail = required(environment, "PRIMARY_ADMIN_EMAIL").toLowerCase();
  const runtimeUrl = parseNeonUrl(databaseUrl, "DATABASE_URL", { pooled: true });
  const directUrl = parseNeonUrl(directDatabaseUrl, "DATABASE_URL_UNPOOLED", {
    pooled: false,
  });

  if (expectedBranchId === developmentBranchId) {
    throw new Error("The expected Production branch must differ from Development.");
  }

  if (
    normalizedNeonHost(runtimeUrl) !== normalizedNeonHost(directUrl) ||
    runtimeUrl.pathname !== directUrl.pathname ||
    runtimeUrl.username !== directUrl.username
  ) {
    throw new Error("The pooled and direct URLs must identify the same Neon database.");
  }

  return {
    directDatabaseUrl,
    expectedProjectId,
    expectedBranchId,
    developmentBranchId,
    primaryAdminEmail,
  };
}

export async function verifyProductionDatabase({ environment, createClient }) {
  const configuration = validateProductionEnvironment(environment);
  const client = createClient(configuration.directDatabaseUrl);

  await client.connect();

  try {
    const result = await client.query(`
      select
        current_setting('neon.project_id', true) as project_id,
        current_setting('neon.branch_id', true) as branch_id
    `);
    const fingerprint = result.rows[0];

    if (fingerprint?.branch_id === configuration.developmentBranchId) {
      throw new Error("Refusing to provision ADMIN on the Development branch.");
    }

    if (
      fingerprint?.project_id !== configuration.expectedProjectId ||
      fingerprint?.branch_id !== configuration.expectedBranchId
    ) {
      throw new Error("The Neon project/branch fingerprint does not match Production.");
    }

    return configuration;
  } finally {
    await client.end();
  }
}

export async function provisionPrimaryAdminProduction({
  argumentsList,
  environment,
  prismaClient,
  verifyDatabase,
  audit = console.log,
}) {
  requireProductionConfirmation(argumentsList);
  const configuration = await verifyDatabase(environment);
  const users = await prismaClient.user.findMany({
    where: {
      email: {
        equals: configuration.primaryAdminEmail,
        mode: "insensitive",
      },
    },
    select: { id: true, role: true },
    take: 2,
  });

  if (users.length === 0) {
    throw new Error(
      "The primary admin Auth.js user does not exist. Create the account normally first."
    );
  }

  if (users.length !== 1) {
    throw new Error("Refusing to provision a duplicated primary admin identity.");
  }

  const [user] = users;

  if (user.role === "ADMIN") {
    audit(JSON.stringify({ ok: true, status: "already_admin", role: "ADMIN" }));
    return { status: "already_admin", role: "ADMIN" };
  }

  const updated = await prismaClient.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: { role: true },
  });

  audit(JSON.stringify({ ok: true, status: "provisioned", role: updated.role }));
  return { status: "provisioned", role: updated.role };
}
