import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { galleryItems } from "../data/galleryData.js";
import { primaryNavigation } from "../data/navigation.js";

describe("public V2 gallery", () => {
  it("is a discoverable public route backed only by repository media", async () => {
    assert.ok(
      primaryNavigation.some(
        (item) => item.label === "Gallery" && item.href === "/gallery"
      )
    );
    assert.ok(galleryItems.length > 0);

    for (const item of galleryItems) {
      assert.match(item.src, /^\/images\//);
      assert.ok(item.alt.length > 0);
      await access(`public${item.src}`);
    }
  });

  it("uses the existing responsive, accessible public-page structure", async () => {
    const page = await readFile("src/app/(marketing)/gallery/page.js", "utf8");

    assert.match(page, /<PageIntro/);
    assert.match(page, /<ul className="gallery-grid">/);
    assert.match(page, /<figure className="gallery-card">/);
    assert.match(page, /<figcaption>/);
    assert.match(page, /alt=\{item\.alt\}/);
  });
});
