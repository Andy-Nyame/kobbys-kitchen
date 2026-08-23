export const AUTH_VALIDATION_MESSAGE = "Please check the highlighted information.";
export const AUTH_INVALID_JSON_MESSAGE = "The request could not be read.";
export const AUTH_SERVER_ERROR_MESSAGE =
  "The operation could not be completed right now. Please try again later.";

export function sanitizeTextValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

export function validateSignupPayload(payload) {
  const errors = {};

  const email = sanitizeTextValue(payload?.email);
  const password = typeof payload?.password === "string" ? payload.password : "";
  const displayName = sanitizeTextValue(payload?.displayName);
  const phone = sanitizeTextValue(payload?.phone);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  } else if (email.length > 120) {
    errors.email = "Email must be 120 characters or fewer.";
  }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (password.length > 128) {
    errors.password = "Password must be 128 characters or fewer.";
  }

  if (!displayName || displayName.length < 2) {
    errors.displayName = "Please enter a display name with at least 2 characters.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display name must be 80 characters or fewer.";
  }

  if (!phone || phone.length < 7) {
    errors.phone = "Please enter a valid phone number.";
  } else if (phone.length > 20) {
    errors.phone = "Phone number must be 20 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { email, password, displayName, phone },
    errors: {},
  };
}

export function validateLoginPayload(payload) {
  const errors = {};

  const email = sanitizeTextValue(payload?.email);
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!password) {
    errors.password = "Please enter your password.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { email, password },
    errors: {},
  };
}

export function validateForgotPasswordPayload(payload) {
  const errors = {};

  const email = sanitizeTextValue(payload?.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { email },
    errors: {},
  };
}

export function validateResetPasswordPayload(payload) {
  const errors = {};

  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (password.length > 128) {
    errors.password = "Password must be 128 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { password },
    errors: {},
  };
}

export function validateProfileUpdatePayload(payload) {
  const errors = {};

  const displayName = sanitizeTextValue(payload?.displayName);
  const phone = sanitizeTextValue(payload?.phone);

  if (!displayName || displayName.length < 2) {
    errors.displayName = "Please enter a display name with at least 2 characters.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display name must be 80 characters or fewer.";
  }

  if (!phone || phone.length < 7) {
    errors.phone = "Please enter a valid phone number.";
  } else if (phone.length > 20) {
    errors.phone = "Phone number must be 20 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { displayName, phone },
    errors: {},
  };
}
