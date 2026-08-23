import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "../lib/theme.js";

describe("theme preference resolution", () => {
  it("uses the documented persistent storage key", () => {
    assert.equal(THEME_STORAGE_KEY, "kobbys-kitchen-theme");
  });

  it("defaults missing and invalid preferences to system", () => {
    assert.equal(normalizeThemePreference(null), "system");
    assert.equal(normalizeThemePreference(undefined), "system");
    assert.equal(normalizeThemePreference("sepia"), "system");
  });

  it("resolves a new visitor against the system preference", () => {
    assert.equal(resolveTheme(null, false), "light");
    assert.equal(resolveTheme(null, true), "dark");
  });

  it("keeps explicit light and dark preferences independent of the system", () => {
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
  });

  it("re-resolves system when the operating-system preference changes", () => {
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("system", true), "dark");
  });
});

describe("theme control cycle", () => {
  it("cycles System to Light to Dark to System", () => {
    assert.equal(getNextThemePreference("system"), "light");
    assert.equal(getNextThemePreference("light"), "dark");
    assert.equal(getNextThemePreference("dark"), "system");
  });
});
