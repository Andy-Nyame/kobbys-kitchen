import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  filterEligibleCampaigns,
  getCampaignCreative,
  isCampaignEligible,
  isSafeCampaignDestination,
} from "../lib/campaigns/domain.js";
import {
  getCampaignPopupStoragePolicy,
  isCampaignPopupSuppressedPath,
  shouldScheduleCampaignPopup,
} from "../lib/campaigns/popup.js";
import {
  CAMPAIGN_ADMIN_ACTION,
  prepareCampaignMutation,
} from "../lib/campaigns/admin-validation.js";
import { executeAdminCampaignMutation } from "../lib/campaigns/admin-mutations.js";

const campaignId = "52f3d24b-01c9-4f9a-8992-54f21b3d2647";
const now = new Date("2026-09-21T12:00:00.000Z");
const baseCampaign = {
  id: campaignId,
  name: "Online Order Challenge",
  active: true,
  startAt: "2026-09-21T00:00:00.000Z",
  endAt: "2026-09-26T23:59:59.999Z",
  priority: 100,
  slideshowEnabled: true,
  popupEnabled: true,
  popupFrequency: "ONCE_PER_SESSION",
  desktopImagePath: "/images/promotions/online-order-challenge.png",
  desktopImageWidth: 1254,
  desktopImageHeight: 1254,
  mobileImagePath: null,
  mobileImageWidth: null,
  mobileImageHeight: null,
  destinationPath: "/menu",
  createdAt: "2026-09-21T00:00:00.000Z",
};

function campaign(overrides = {}) {
  return { ...baseCampaign, ...overrides };
}

describe("campaign eligibility and ordering", () => {
  it("shows only active in-window campaigns for their enabled placement", () => {
    assert.equal(isCampaignEligible(campaign(), { now, placement: "slideshow" }), true);
    assert.equal(isCampaignEligible(campaign({ active: false }), { now }), false);
    assert.equal(isCampaignEligible(campaign({ startAt: "2026-10-01T00:00:00Z" }), { now }), false);
    assert.equal(isCampaignEligible(campaign({ endAt: "2026-09-20T23:59:59Z" }), { now }), false);
    assert.equal(isCampaignEligible(campaign({ slideshowEnabled: false }), { now, placement: "slideshow" }), false);
    assert.equal(isCampaignEligible(campaign({ popupEnabled: false }), { now, placement: "popup" }), false);
  });

  it("sorts eligible campaigns by priority and drops expired campaigns", () => {
    const eligible = filterEligibleCampaigns([
      campaign({ id: "low", priority: 2 }),
      campaign({ id: "expired", priority: 999, endAt: "2026-09-01T00:00:00Z" }),
      campaign({ id: "high", priority: 20 }),
    ], { now, placement: "slideshow" });
    assert.deepEqual(eligible.map(({ id }) => id), ["high", "low"]);
  });

  it("uses the desktop creative as a mobile fallback and accepts only safe internal destinations", () => {
    assert.deepEqual(getCampaignCreative(campaign(), { mobile: true }), {
      path: baseCampaign.desktopImagePath,
      width: 1254,
      height: 1254,
    });
    assert.equal(isSafeCampaignDestination("/menu?campaign=online-order"), true);
    assert.equal(isSafeCampaignDestination("javascript:alert(1)"), false);
    assert.equal(isSafeCampaignDestination("//attacker.example"), false);
    assert.equal(isSafeCampaignDestination("https://attacker.example"), false);
  });
});

describe("campaign popup policy", () => {
  it("uses campaign-scoped session persistence for the current frequency", () => {
    assert.deepEqual(getCampaignPopupStoragePolicy(campaign()), {
      storage: "session",
      key: `kobbys-campaign-popup:${campaignId}`,
    });
    assert.equal(shouldScheduleCampaignPopup({ campaign: campaign(), pathname: "/", hasBeenSeen: false }), true);
    assert.equal(shouldScheduleCampaignPopup({ campaign: campaign(), pathname: "/", hasBeenSeen: true }), false);
  });

  it("supports reusable every-visit/customer policies without exposing customer data", () => {
    assert.deepEqual(getCampaignPopupStoragePolicy(campaign({ popupFrequency: "EVERY_VISIT" })), {
      storage: null,
      key: null,
    });
    assert.deepEqual(
      getCampaignPopupStoragePolicy(campaign({ popupFrequency: "ONCE_PER_CUSTOMER" }), "opaque-user-id"),
      {
        storage: "local",
        key: `kobbys-campaign-popup:${campaignId}:viewer:opaque-user-id`,
      }
    );
  });

  it("does not interrupt cart, checkout, payment, order detail, Admin or Kitchen flows", () => {
    for (const pathname of [
      "/cart",
      "/checkout",
      "/payment/callback",
      "/api/payments/paystack/callback",
      "/account/orders/KK-TEST",
      "/admin/orders",
      "/kitchen",
    ]) {
      assert.equal(isCampaignPopupSuppressedPath(pathname), true, pathname);
    }
    assert.equal(isCampaignPopupSuppressedPath("/menu"), false);
  });
});

describe("campaign Admin boundary", () => {
  const validPayload = {
    action: CAMPAIGN_ADMIN_ACTION.UPDATE,
    id: campaignId,
    active: true,
    slideshowEnabled: true,
    popupEnabled: true,
    startAt: "2026-09-21T00:00",
    endAt: "2026-09-26T23:59",
    priority: 100,
    destinationPath: "/menu",
    popupFrequency: "ONCE_PER_SESSION",
  };

  it("normalizes trusted settings and rejects unsafe/browser-owned authority", () => {
    const mutation = prepareCampaignMutation(validPayload);
    assert.equal(mutation.data.endAt.toISOString(), "2026-09-26T23:59:00.000Z");
    assert.equal(mutation.data.destinationPath, "/menu");
    assert.throws(() => prepareCampaignMutation({ ...validPayload, role: "ADMIN" }), /Authorization context/);
    assert.throws(() => prepareCampaignMutation({ ...validPayload, destinationPath: "javascript:alert(1)" }), /safe internal path/);
    assert.throws(() => prepareCampaignMutation({ ...validPayload, endAt: "2026-09-20T00:00" }), /after its start/);
  });

  it("re-checks the database role before changing only the requested campaign", async () => {
    const state = {
      updated: null,
      orders: [{ id: "preserved-order" }],
      users: [{ id: "preserved-user" }],
    };
    const fakePrisma = (role) => ({
      $transaction: async (callback) => callback({
        user: { findUnique: async () => ({ role }) },
        campaign: {
          findUnique: async () => ({ id: campaignId }),
          update: async (args) => {
            state.updated = args;
            return { id: campaignId, ...args.data };
          },
        },
      }),
    });
    const mutation = prepareCampaignMutation(validPayload);

    await assert.rejects(executeAdminCampaignMutation({
      prismaClient: fakePrisma("CUSTOMER"),
      adminUserId: "customer",
      mutation,
    }), /Admin authorization/);
    await executeAdminCampaignMutation({
      prismaClient: fakePrisma("ADMIN"),
      adminUserId: "admin",
      mutation,
    });

    assert.equal(state.updated.where.id, campaignId);
    assert.deepEqual(state.orders, [{ id: "preserved-order" }]);
    assert.deepEqual(state.users, [{ id: "preserved-user" }]);
  });
});

describe("campaign presentation integration", () => {
  it("keeps single-slide UI clean while enabling multi-slide rotation, swipe and reduced motion", async () => {
    const slideshow = await readFile("src/components/campaigns/CampaignSlideshow.jsx", "utf8");
    assert.match(slideshow, /campaigns\.length > 1/);
    assert.match(slideshow, /hasMultipleSlides \?/);
    assert.match(slideshow, /setInterval/);
    assert.match(slideshow, /prefers-reduced-motion/);
    assert.match(slideshow, /onTouchStart/);
    assert.match(slideshow, /href=\{campaign\.destinationPath\}/);
  });

  it("uses a delayed accessible dismissible dialog and the same campaign destination", async () => {
    const popup = await readFile("src/components/campaigns/CampaignPopup.jsx", "utf8");
    assert.match(popup, /POPUP_DELAY_MS = 2200/);
    assert.match(popup, /role="dialog"/);
    assert.match(popup, /aria-modal="true"/);
    assert.match(popup, /event\.key === "Escape"/);
    assert.match(popup, /FOCUSABLE_SELECTOR/);
    assert.match(popup, /sessionStorage/);
    assert.match(popup, /href=\{campaign\.destinationPath\}/);
  });

  it("ships the approved artwork and one current campaign migration without promo-code or leaderboard models", async () => {
    await access("public/images/promotions/online-order-challenge.png");
    const [migration, schema] = await Promise.all([
      readFile("prisma/migrations/20260921120000_add_promotional_campaigns/migration.sql", "utf8"),
      readFile("prisma/schema.prisma", "utf8"),
    ]);
    assert.match(migration, /Online Order Challenge/);
    assert.match(migration, /2026-09-26 23:59:59\.999/);
    assert.match(migration, /'\/menu'/);
    assert.match(schema, /model Campaign/);
    assert.doesNotMatch(schema, /model PromoCode|model CampaignLeaderboard|model ChallengeEntry/);
  });

  it("authorizes both the Admin page and mutation route through existing trusted Admin guards", async () => {
    const [page, route, service] = await Promise.all([
      readFile("src/app/admin/campaigns/page.js", "utf8"),
      readFile("src/app/api/admin/campaigns/route.js", "utf8"),
      readFile("src/lib/campaigns/admin-mutations.js", "utf8"),
    ]);
    assert.match(page, /requireAdmin\("\/admin\/campaigns"\)/);
    assert.match(route, /getAdminAuthorization/);
    assert.match(service, /actor\?\.role !== "ADMIN"/);
  });
});
