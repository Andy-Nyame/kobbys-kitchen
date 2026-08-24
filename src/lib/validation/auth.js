export const AUTH_VALIDATION_MESSAGE = "Please check the highlighted information.";
export const AUTH_INVALID_JSON_MESSAGE = "The request could not be read.";
export const AUTH_SERVER_ERROR_MESSAGE =
  "The operation could not be completed right now. Please try again later.";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

export function normalizeDisplayName(value) {
  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
    return "";
  }

  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeGhanaPhone(value) {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return "";
  }

  const normalizedInput = value.normalize("NFKC").trim();

  if (!/^[+\d\s().-]+$/.test(normalizedInput)) {
    return "";
  }

  let compactPhone = normalizedInput.replace(/[\s().-]/g, "");

  if (compactPhone.startsWith("+2330")) {
    compactPhone = `+233${compactPhone.slice(5)}`;
  } else if (compactPhone.startsWith("2330")) {
    compactPhone = `233${compactPhone.slice(4)}`;
  }

  let nationalNumber;

  if (/^\+233\d{9}$/.test(compactPhone)) {
    nationalNumber = compactPhone.slice(4);
  } else if (/^233\d{9}$/.test(compactPhone)) {
    nationalNumber = compactPhone.slice(3);
  } else if (/^0\d{9}$/.test(compactPhone)) {
    nationalNumber = compactPhone.slice(1);
  } else if (/^\d{9}$/.test(compactPhone)) {
    nationalNumber = compactPhone;
  } else {
    return "";
  }

  return `+233${nationalNumber}`;
}

function validateDisplayName(value, errors) {
  if (typeof value === "string" && CONTROL_CHARACTER_PATTERN.test(value)) {
    errors.displayName = "Display name cannot contain control characters.";
    return "";
  }

  const displayName = normalizeDisplayName(value);

  if (!displayName || displayName.length < 2) {
    errors.displayName = "Please enter a display name with at least 2 characters.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display name must be 80 characters or fewer.";
  } else if (!/\p{L}/u.test(displayName)) {
    errors.displayName = "Display name must include at least one letter.";
  }

  return displayName;
}

function validatePhone(value, errors) {
  const phone = normalizeGhanaPhone(value);

  if (!phone) {
    errors.phone =
      "Enter a Ghana phone number such as 020 123 4567 or +233 20 123 4567.";
  }

  return phone;
}

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
  const displayName = validateDisplayName(payload?.displayName, errors);
  const phone = validatePhone(payload?.phone, errors);

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

  const displayName = validateDisplayName(payload?.displayName, errors);
  const phone = validatePhone(payload?.phone, errors);

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }

  return {
    data: { displayName, phone },
    errors: {},
  };
}
