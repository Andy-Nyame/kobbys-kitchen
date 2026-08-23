"use client";

import { useSyncExternalStore } from "react";

import {
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

const THEME_CHANGE_EVENT = "kobbys-kitchen-theme-change";
const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";

const LABELS = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function getPreferenceSnapshot() {
  return normalizeThemePreference(
    document.documentElement.dataset.themePreference
  );
}

function getServerPreferenceSnapshot() {
  return "system";
}

function applyThemePreference(preference) {
  const normalizedPreference = normalizeThemePreference(preference);
  const resolvedTheme = resolveTheme(
    normalizedPreference,
    window.matchMedia(DARK_THEME_QUERY).matches
  );
  const root = document.documentElement;

  root.dataset.themePreference = normalizedPreference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

function subscribeToTheme(onStoreChange) {
  const mediaQuery = window.matchMedia(DARK_THEME_QUERY);

  function handleThemeChange() {
    onStoreChange();
  }

  function handleSystemChange() {
    if (getPreferenceSnapshot() === "system") {
      applyThemePreference("system");
      onStoreChange();
    }
  }

  function handleStorage(event) {
    if (event.key === THEME_STORAGE_KEY) {
      applyThemePreference(event.newValue);
      onStoreChange();
    }
  }

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);
  mediaQuery.addEventListener("change", handleSystemChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", handleSystemChange);
  };
}

function ThemeIcon({ preference }) {
  if (preference === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (preference === "dark") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.5 8.5 0 1 0 11.4 11.4Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export default function ThemeControl({ compact = false, className = "" }) {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot
  );
  const nextPreference = getNextThemePreference(preference);
  const classes = [
    "theme-control",
    compact ? "theme-control--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleClick() {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The preference still applies for this page when storage is unavailable.
    }

    applyThemePreference(nextPreference);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      aria-label={`Theme preference: ${LABELS[preference]}. Change to ${LABELS[nextPreference]}.`}
      title={`Theme: ${LABELS[preference]}`}
    >
      <span className="theme-control__icon">
        <ThemeIcon preference={preference} />
      </span>
      <span className="theme-control__label">{LABELS[preference]}</span>
    </button>
  );
}
