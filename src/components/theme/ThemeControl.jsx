"use client";

import { useEffect } from "react";

import {
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";

function applyThemePreference(preference) {
  const normalizedPreference = normalizeThemePreference(preference);
  const resolvedTheme = resolveTheme(
    normalizedPreference,
    window.matchMedia(DARK_THEME_QUERY).matches
  );
  const root = document.documentElement;

  root.dataset.themePreference = resolvedTheme;
  root.dataset.themeSource = normalizedPreference ? "manual" : "system";
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

function ThemeIcon({ theme }) {
  if (theme === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.5 8.5 0 1 0 11.4 11.4Z" />
    </svg>
  );
}

export default function ThemeControl({ compact = false, className = "" }) {
  const classes = [
    "theme-control",
    compact ? "theme-control--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_THEME_QUERY);

    function handleSystemChange() {
      if (document.documentElement.dataset.themeSource === "system") {
        applyThemePreference(null);
      }
    }

    function handleStorage(event) {
      if (event.key === THEME_STORAGE_KEY) {
        applyThemePreference(event.newValue);
      }
    }

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function handleClick() {
    const nextPreference = getNextThemePreference(
      document.documentElement.dataset.theme
    );

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The preference still applies for this page when storage is unavailable.
    }

    applyThemePreference(nextPreference);
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
    >
      <span className="theme-control__option theme-control__option--dark">
        <span className="theme-control__icon">
          <ThemeIcon theme="dark" />
        </span>
        <span aria-hidden="true" className="theme-control__label">Dark</span>
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="theme-control__option theme-control__option--light">
        <span className="theme-control__icon">
          <ThemeIcon theme="light" />
        </span>
        <span aria-hidden="true" className="theme-control__label">Light</span>
        <span className="sr-only">Switch to light mode</span>
      </span>
    </button>
  );
}
