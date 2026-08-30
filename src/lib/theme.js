export const THEME_STORAGE_KEY = "kobbys-kitchen-theme";

export const THEME_PREFERENCES = Object.freeze(["light", "dark"]);

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : null;
}

export function resolveTheme(preference, systemPrefersDark) {
  const normalizedPreference = normalizeThemePreference(preference);

  return normalizedPreference || (systemPrefersDark ? "dark" : "light");
}

export function getNextThemePreference(theme) {
  return normalizeThemePreference(theme) === "dark" ? "light" : "dark";
}
