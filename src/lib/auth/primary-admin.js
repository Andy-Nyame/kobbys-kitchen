const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 1000;

function createBootstrapError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createRoleAssignmentError(error) {
  if (["42P01", "PGRST205"].includes(error?.code)) {
    return createBootstrapError(
      "admin_role_storage_missing",
      "public.user_roles is unavailable. Apply the V2 role migrations to a confirmed safe environment first."
    );
  }

  if (["42704", "PGRST204"].includes(error?.code)) {
    return createBootstrapError(
      "admin_role_schema_incompatible",
      "The connected role schema is incomplete or incompatible with ADMIN provisioning."
    );
  }

  if (["42501", "PGRST301", "PGRST302"].includes(error?.code)) {
    return createBootstrapError(
      "admin_role_permission_denied",
      "The server credential is not authorized to assign trusted roles."
    );
  }

  return createBootstrapError(
    "admin_role_assignment_failed",
    `The ADMIN role could not be assigned${error?.code ? ` (${error.code})` : ""}.`
  );
}

export function normalizePrimaryAdminEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : "";
}

export async function provisionPrimaryAdmin({
  email,
  loadAuthUsersPage,
  inspectRoleStorage,
  assignAdminRole,
}) {
  const normalizedEmail = normalizePrimaryAdminEmail(email);

  if (!normalizedEmail) {
    throw createBootstrapError(
      "invalid_primary_admin_email",
      "PRIMARY_ADMIN_EMAIL must be a valid email address."
    );
  }

  let authUser = null;

  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { users, error } = await loadAuthUsersPage({
      page,
      perPage: USERS_PER_PAGE,
    });

    if (error) {
      throw createBootstrapError(
        "auth_user_lookup_failed",
        "The Supabase Auth user lookup failed."
      );
    }

    authUser = users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (authUser || users.length < USERS_PER_PAGE) {
      break;
    }
  }

  if (!authUser?.id) {
    throw createBootstrapError(
      "auth_user_not_found",
      "No existing Supabase Auth user matches PRIMARY_ADMIN_EMAIL."
    );
  }

  if (inspectRoleStorage) {
    const { error: storageError } = await inspectRoleStorage();

    if (storageError) {
      throw createRoleAssignmentError(storageError);
    }
  }

  const { error: assignmentError } = await assignAdminRole({
    user_id: authUser.id,
    role: "ADMIN",
    granted_by: authUser.id,
  });

  if (assignmentError) {
    throw createRoleAssignmentError(assignmentError);
  }

  return {
    email: normalizedEmail,
    role: "ADMIN",
    userId: authUser.id,
  };
}
