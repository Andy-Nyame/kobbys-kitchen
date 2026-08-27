import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCustomerAvatar,
  getCustomerDisplayName,
} from "../lib/auth/customer-avatar.js";

describe("provider-independent customer presentation", () => {
  it("uses the same profile name for password and OAuth identities", () => {
    const profile = { displayName: "Ama Mensah" };

    assert.equal(
      getCustomerDisplayName({ email: "password@example.com" }, profile),
      "Ama Mensah"
    );
    assert.equal(
      getCustomerDisplayName({ email: "google@example.com", image: "https://example.com/a.png" }, profile),
      "Ama Mensah"
    );
  });

  it("uses a safe provider image and otherwise falls back to initials", () => {
    assert.deepEqual(
      getCustomerAvatar(
        { image: "https://images.example.test/ama.png" },
        { displayName: "Ama Mensah" }
      ),
      { imageUrl: "https://images.example.test/ama.png", initials: "AM" }
    );
    assert.deepEqual(
      getCustomerAvatar({}, { displayName: "Ama Mensah" }),
      { imageUrl: null, initials: "AM" }
    );
  });

  it("rejects non-HTTPS image metadata", () => {
    assert.equal(
      getCustomerAvatar(
        { image: "javascript:alert(1)" },
        { displayName: "Ama Mensah" }
      ).imageUrl,
      null
    );
  });
});
