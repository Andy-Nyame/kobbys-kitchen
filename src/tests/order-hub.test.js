import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { businessData } from "../data/businessData.js";
import {
  authCrossLinks,
  orderingNavigation,
} from "../data/navigation.js";
import { getOrderingHubState } from "../lib/orders/hub.js";

describe("auth entry and ordering navigation", () => {
  it("links the primary Order Now action to the public ordering hub", () => {
    assert.deepEqual(orderingNavigation, {
      label: "Order Now",
      href: "/order",
    });
  });

  it("keeps account creation discoverable from login and vice versa", () => {
    assert.equal(authCrossLinks.login.href, "/signup");
    assert.equal(authCrossLinks.login.label, "Create one");
    assert.equal(authCrossLinks.signup.href, "/login");
    assert.equal(authCrossLinks.signup.label, "Log in");
  });
});

describe("truthful ordering hub state", () => {
  it("keeps the trusted WhatsApp ordering option available", () => {
    const state = getOrderingHubState(false);

    assert.equal(state.whatsappAvailable, true);
    assert.match(businessData.whatsapp.href, /^https:\/\/wa\.me\/[0-9]+$/);
  });

  it("does not expose online pickup checkout while the build flag is disabled", () => {
    assert.deepEqual(getOrderingHubState(false), {
      whatsappAvailable: true,
      onlinePickupAvailable: false,
      onlinePickupReason: "build_disabled",
    });
  });

  it("does not pretend checkout exists even if the build flag is changed early", () => {
    assert.deepEqual(getOrderingHubState(true), {
      whatsappAvailable: true,
      onlinePickupAvailable: false,
      onlinePickupReason: "checkout_not_implemented",
    });
  });
});
