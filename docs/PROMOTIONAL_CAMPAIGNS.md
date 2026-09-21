# Promotional Campaigns

Kobby's Kitchen promotions use one trusted `Campaign` database record for both
the homepage slideshow and promotional popup. Admins manage the current records
at `/admin/campaigns`; normal customers cannot mutate campaign settings.

## Placements and scheduling

- `slideshowEnabled` includes an eligible campaign in the homepage slideshow.
- `popupEnabled` makes the highest-priority eligible campaign available to the
  public-site popup.
- `active` is the master switch.
- `startAt` and `endAt` are enforced by server database queries. Null bounds are
  open-ended; an expired campaign is not sent to either placement.
- Higher `priority` records appear first. A single slide has no rotation or
  navigation controls; multiple slides rotate with reduced-motion support.
- Destinations are validated internal application paths. The current campaign
  points to `/menu`.

The **Online Order Challenge** uses the approved “ORDER ONLINE. WIN BIG!” artwork
and ends at 23:59:59 Ghana time on **Saturday, 26 September 2026**.

## Popup frequency

The current campaign uses `ONCE_PER_SESSION`. The browser marks the campaign as
seen in `sessionStorage` only when the dialog opens, so dismissal and navigation
do not cause repeated interruptions during that session. The domain also
recognizes `EVERY_VISIT` and browser-local `ONCE_PER_CUSTOMER` policies for
future campaigns; no cross-device tracking infrastructure is part of this brick.

The dialog is delayed briefly, traps keyboard focus, closes with Escape when
dismissible, restores focus, and is suppressed on Cart, Checkout, payment,
customer order-detail, Admin, and Kitchen paths.

## Explicitly out of scope

This foundation does **not** implement promotional codes, checkout discounts,
qualifying-order calculations, campaign leaderboards, winner selection, or
challenge reports. Those remain separate future campaign bricks. Poster wording
does not change the authoritative ordering, pricing, payment, or receipt rules.
