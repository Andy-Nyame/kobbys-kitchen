import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  getAdminPresentation,
  prepareAdminProfileUpdate,
} from "../lib/admin/profile.js";

describe("administrator profile", () => {
  it("uses trusted profile identity with provider image and initials fallbacks", () => {
    const withImage = getAdminPresentation(
      { email: "admin@example.test", image: "https://images.example.test/admin.png", role: "ADMIN" },
      { display_name: "Ama Mensah" }
    );
    assert.equal(withImage.displayName, "Ama Mensah");
    assert.equal(withImage.avatar.imageUrl, "https://images.example.test/admin.png");
    assert.equal(withImage.role, "ADMIN");

    const initials = getAdminPresentation(
      { email: "admin@example.test", role: "ADMIN" },
      { display_name: "Ama Mensah" }
    );
    assert.equal(initials.avatar.initials, "AM");
  });

  it("allows only the authenticated ADMIN to update approved own-profile fields", () => {
    const result = prepareAdminProfileUpdate({
      user: { id: "admin" },
      role: "ADMIN",
      payload: { displayName: "Ama Mensah", phone: "024 123 4567" },
    });
    assert.equal(result.ok, true);
    assert.equal(result.targetUserId, "admin");
    assert.equal(result.values.phone, "+233241234567");

    assert.equal(
      prepareAdminProfileUpdate({ user: { id: "customer" }, role: "CUSTOMER", payload: {} }).status,
      403
    );
    assert.equal(
      prepareAdminProfileUpdate({ user: { id: "admin" }, role: "ADMIN", payload: { role: "ADMIN" } }).status,
      400
    );
  });

  it("renders the profile action and a safe new-tab public-site action", async () => {
    const source = await readFile("src/components/admin/AdminAccountMenu.jsx", "utf8");
    assert.match(source, /href="\/admin\/profile"/);
    assert.match(source, /target="_blank"/);
    assert.match(source, /rel="noopener noreferrer"/);
  });
});
