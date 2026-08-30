import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "../lib/theme.js";

const controlSource = readFileSync(
  new URL("../components/theme/ThemeControl.jsx", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("theme preference resolution", () => {
  it("uses the documented persistent storage key", () => {
    assert.equal(THEME_STORAGE_KEY, "kobbys-kitchen-theme");
  });

  it("treats missing, invalid, and legacy system values as no explicit preference", () => {
    assert.equal(normalizeThemePreference(null), null);
    assert.equal(normalizeThemePreference(undefined), null);
    assert.equal(normalizeThemePreference("sepia"), null);
    assert.equal(normalizeThemePreference("system"), null);
  });

  it("resolves a new visitor against the system preference", () => {
    assert.equal(resolveTheme(null, false), "light");
    assert.equal(resolveTheme(null, true), "dark");
  });

  it("keeps explicit light and dark preferences independent of the system", () => {
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
  });

  it("resolves a legacy system value using the current device appearance", () => {
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("system", true), "dark");
  });

  it("removes obsolete stored values before first-paint system resolution", () => {
    assert.match(layoutSource, /\["light", "dark"\]\.includes\(savedPreference\)/);
    assert.match(layoutSource, /localStorage\.removeItem/);
    assert.match(layoutSource, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
    assert.match(layoutSource, /themeSource = preference \? "manual" : "system"/);
  });
});

describe("theme control cycle", () => {
  it("toggles only between light and dark", () => {
    assert.equal(getNextThemePreference("light"), "dark");
    assert.equal(getNextThemePreference("dark"), "light");
  });

  it("exposes only familiar sun/moon actions with accessible labels", () => {
    assert.doesNotMatch(controlSource, />System</);
    assert.doesNotMatch(controlSource, /<rect x="3" y="4"/);
    assert.match(controlSource, /Switch to dark mode/);
    assert.match(controlSource, /Switch to light mode/);
    assert.match(controlSource, /<button[\s\S]*type="button"/);
  });

  it("uses hydration-stable markup and existing data-theme CSS on every shared surface", () => {
    assert.doesNotMatch(controlSource, /useSyncExternalStore|getServerPreferenceSnapshot/);
    assert.match(cssSource, /:root\[data-theme="dark"\] \.theme-control__option--light/);
    for (const relativePath of [
      "../components/layout/SiteHeader.jsx",
      "../components/admin/AdminWorkspace.jsx",
      "../app/kitchen/page.js",
    ]) {
      assert.match(readFileSync(new URL(relativePath, import.meta.url), "utf8"), /<ThemeControl/);
    }
  });
});
