import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(
  new URL("../components/ui/KitchenLoader.jsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const loadingBoundaries = [
  "../app/(marketing)/loading.js",
  "../app/(customer)/loading.js",
  "../app/admin/loading.js",
  "../app/kitchen/loading.js",
];

test("shared kitchen loader provides an accessible loading state and decorative SVG", () => {
  assert.match(componentSource, /role="status"/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /aria-busy="true"/);
  assert.match(componentSource, /<svg[\s\S]*aria-hidden="true"/);
  assert.match(componentSource, /Loading…/);
});

test("loader artwork and theme styling use the shared currentColor strategy", () => {
  assert.match(componentSource, /fill="currentColor"/);
  assert.match(cssSource, /--color-loader-foreground:\s*#70401f/);
  assert.match(cssSource, /:root\[data-theme="dark"\][\s\S]*--color-loader-foreground:\s*var\(--color-text-strong\)/);
  assert.match(cssSource, /\.kitchen-loader\s*\{[\s\S]*color:\s*var\(--color-loader-foreground\)/);
});

test("loader animation rotates, pauses, and becomes static for reduced motion", () => {
  assert.match(cssSource, /@keyframes kitchen-loader-spin-pause/);
  assert.match(cssSource, /58%,\s*\n\s*100%\s*\{\s*\n\s*transform:\s*rotate\(360deg\)/);
  assert.match(cssSource, /transform-origin:\s*center/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.kitchen-loader__utensils\s*\{[\s\S]*animation:\s*none/);
});

test("public, account, admin, and kitchen loading boundaries share the loader", () => {
  for (const relativePath of loadingBoundaries) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /import KitchenLoader from "@\/components\/ui\/KitchenLoader"/);
    assert.match(source, /return <KitchenLoader \/>/);
    assert.doesNotMatch(source, /setTimeout|sleep|delay/);
  }
});
