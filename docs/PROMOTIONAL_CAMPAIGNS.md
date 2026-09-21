# Promotional Campaigns

Kobby's Kitchen promotions use one trusted `Campaign` database record for both
the homepage slideshow and promotional popup. Admins manage the current records
at `/admin/campaigns`; normal customers cannot mutate campaign settings.

## Placements and scheduling

- `slideshowEnabled` includes an eligible campaign in the homepage hero slideshow.
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

The evergreen **Homepage Food Showcase** uses the existing food collage, has no
expiry, remains popup-disabled, and follows the promotion at lower priority. It
becomes the single clean hero image automatically after the promotion expires.

## Popup frequency

The current campaign uses `ONCE_PER_SESSION`. The browser marks the campaign as
seen in `sessionStorage` only when the dialog opens, so dismissal and navigation
do not cause repeated interruptions during that session. The domain also
recognizes `EVERY_VISIT` and browser-local `ONCE_PER_CUSTOMER` policies for
future campaigns; no cross-device tracking infrastructure is part of this brick.

The dialog is delayed briefly, traps keyboard focus, closes with Escape when
dismissible, restores focus, and is suppressed on Cart, Checkout, payment,
customer order-detail, Admin, and Kitchen paths.

## Promo codes (Campaign Brick 2)

Promo codes are a separate reusable discount domain managed at `/admin/promos`.
An order may snapshot zero or one canonical promo code; codes never stack and
item quantity does not multiply a code. Supported discounts are percentage
(stored as integer basis points) and fixed amount (stored in integer pesewas).
Percentage discounts may have a cap. Both types may set a minimum subtotal,
schedule, total usage limit, per-customer limit, and optional customer account
restriction.

Cart application is a server-authoritative preview and consumes no usage.
Order creation revalidates the authenticated customer, current menu prices,
current time, schedule, limits, and authoritative subtotal inside the order
transaction. The Order snapshots the code, discount type/value, actual discount,
pre-promo subtotal, and final total. Paystack initializes only from that final
server total. A fully discounted order uses the internal `PROMO` payment method
and does not make a zero-value Paystack request.

Usage is reserved atomically when the order is created. Verified Paystack
payment finalizes the reservation; Cash orders finalize it when Admin accepts
the order. Payment expiry or cancellation before Cash acceptance releases the
reservation. A later cancellation/refund after redemption retains usage as an
auditable historical redemption. A rare verified late Paystack success is never
discarded: its released reservation is restored as redeemed and the existing
manual-reconciliation order policy remains authoritative.

## Explicitly out of scope

Campaign Brick 2 does **not** implement campaign leaderboards, winner selection,
challenge reports, or automatic reward creation. Brick 3 may use the optional
customer restriction to issue the challenge reward after the winner is
determined. Poster wording does not change authoritative order qualification.
