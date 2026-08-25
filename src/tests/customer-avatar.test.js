import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCustomerAvatar,
  getCustomerInitials,
} from "../lib/auth/customer-avatar.js";

describe("customer avatar selection", () => {
  it("prefers a secure Google identity image over editable user metadata", () => {
    const avatar = getCustomerAvatar(
      {
        user_metadata: { avatar_url: "https://example.test/metadata.png" },
        identities: [
          {
            provider: "google",
            identity_data: { picture: "https://images.example.test/google.png" },
          },
        ],
      },
      { display_name: "King Nyame" }
    );

    assert.equal(avatar.imageUrl, "https://images.example.test/google.png");
    assert.equal(avatar.initials, "KN");
  });

  it("uses initials when no usable provider image exists", () => {
    assert.deepEqual(
      getCustomerAvatar(
        { user_metadata: { picture: "http://insecure.example.test/avatar.png" } },
        { display_name: "King Nyame" }
      ),
      { imageUrl: null, initials: "KN" }
    );
  });

  it("uses a generic icon state when there is neither an image nor a usable name", () => {
    assert.deepEqual(getCustomerAvatar({ user_metadata: {} }), {
      imageUrl: null,
      initials: null,
    });
  });

  it("limits initials to two visible characters", () => {
    assert.equal(getCustomerInitials("Ama Serwaa Mensah"), "AS");
  });
});
