export function isOrderingEnabled() {
  const flag = process.env.V2_ORDERING_ENABLED;

  if (typeof flag !== "string") {
    return false;
  }

  return flag.toLowerCase() === "true";
}
