import { validateProfileUpdatePayload } from "../validation/auth.js";

const ALLOWED_PROFILE_UPDATE_FIELDS = new Set(["displayName", "phone"]);

export function getCustomerProfileUpdateAuthorization(user, role) {
  if (!user) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
      errors: {},
    };
  }

  if (role !== "CUSTOMER") {
    return {
      ok: false,
      status: 403,
      message: "Access denied.",
      errors: {},
    };
  }

  return { ok: true, status: 200 };
}

export function prepareCustomerProfileUpdate({ user, role, payload }) {
  const authorization = getCustomerProfileUpdateAuthorization(user, role);

  if (!authorization.ok) {
    return authorization;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      message: "The request could not be read.",
      errors: {},
    };
  }

  const forbiddenFields = Object.keys(payload).filter(
    (field) => !ALLOWED_PROFILE_UPDATE_FIELDS.has(field)
  );

  if (forbiddenFields.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "Only display name and phone number can be updated here.",
      errors: {},
    };
  }

  const validation = validateProfileUpdatePayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return {
      ok: false,
      status: 400,
      message: "Please check the highlighted information.",
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    status: 200,
    targetUserId: user.id,
    values: {
      display_name: validation.data.displayName,
      phone: validation.data.phone,
    },
  };
}
