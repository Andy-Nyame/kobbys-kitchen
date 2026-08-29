import {
  getCustomerAvatar,
  getCustomerDisplayName,
} from "../auth/customer-avatar.js";
import { validateProfileUpdatePayload } from "../validation/auth.js";

const ALLOWED_PROFILE_FIELDS = new Set(["displayName", "phone"]);

export function getAdminPresentation(user, profile = null) {
  return {
    displayName: getCustomerDisplayName(user, profile),
    email: user?.email || "",
    role: "ADMIN",
    avatar: getCustomerAvatar(user, profile),
  };
}

export function prepareAdminProfileUpdate({ user, role, payload }) {
  if (!user) {
    return { ok: false, status: 401, message: "Authentication required.", errors: {} };
  }

  if (role !== "ADMIN") {
    return { ok: false, status: 403, message: "Access denied.", errors: {} };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, message: "The request could not be read.", errors: {} };
  }

  if (Object.keys(payload).some((field) => !ALLOWED_PROFILE_FIELDS.has(field))) {
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
    values: validation.data,
  };
}
