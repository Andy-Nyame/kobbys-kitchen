import pg from "pg";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export async function verifyDevelopmentDatabase() {
  if (process.env.APP_ENV !== "development" || process.env.NODE_ENV === "production") {
    throw new Error("This command may only run in the development environment.");
  }

  const url = required("DATABASE_URL_UNPOOLED");
  const expectedProjectId = required("NEON_PROJECT_ID");
  const expectedBranchId = required("NEON_BRANCH_ID");
  const parsedUrl = new URL(url);

  if (!parsedUrl.hostname.endsWith(".neon.tech")) {
    throw new Error("The database connection is not a Neon PostgreSQL target.");
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const result = await client.query(`
      select
        current_setting('neon.project_id', true) as project_id,
        current_setting('neon.branch_id', true) as branch_id
    `);
    const fingerprint = result.rows[0];

    if (
      fingerprint?.project_id !== expectedProjectId ||
      fingerprint?.branch_id !== expectedBranchId
    ) {
      throw new Error("The Neon project/branch fingerprint does not match the approved development target.");
    }
  } finally {
    await client.end();
  }

  return { projectMatched: true, branchMatched: true };
}
