export const THEME_STORAGE_KEY = "kobbys-kitchen-theme";

export const THEME_PREFERENCES = Object.freeze([
  "system",
  "light",
  "dark",
]);

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "system";
}

export function resolveTheme(preference, systemPrefersDark) {
  const normalizedPreference = normalizeThemePreference(preference);

  if (normalizedPreference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return normalizedPreference;
}

export function getNextThemePreference(preference) {
  const normalizedPreference = normalizeThemePreference(preference);
  const currentIndex = THEME_PREFERENCES.indexOf(normalizedPreference);

  return THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length];
}
