# Kobby's Kitchen V2 Release

## Release status

Kobby's Kitchen V2 is the maintained production release of the public restaurant,
customer ordering, Admin, and Kitchen applications. The application is deployed
at `https://kobbys-kitchen.vercel.app` through Vercel Git integration.

The source implementation, automated tests, and database migrations are the
authority for this document. Delivery and the other features listed under
Deferred scope are not part of V2.

## Scope status

| Area | Status | Implemented V2 scope |
| --- | --- | --- |
| Public website | Complete | Home, Menu, About and Meet the Chef content, Gallery, Reviews, Contact, Privacy, responsive navigation, Light/Dark themes, route loader, and live ordering status |
| Customer accounts | Complete | Credentials and Google sign-in, profile, persistent cart, checkout, order history/detail, Order Again, active-order home cards, and role-aware navigation |
| Menu and pricing | Complete | Prisma-backed categories/items, availability and visibility, multiple images, price tiers, and integer-pesewa server pricing |
| Online ordering | Complete | Pickup-only checkout, physical business hours, independent online schedule, overrides, emergency pause, Tuesday closed-day boundary, and authoritative submission guard |
| Payments | Complete; live acceptance pending | Paystack hosted Card/Mobile Money checkout, callback verification, signed webhook, retry attempts, Cash allowlist, Cash Received, refunds, and idempotent finalization |
| Receipts | Complete | One persisted receipt per paid Payment, customer web/PDF copy, Admin original copy, and retained refunded receipt history |
| Order operations | Complete | `AWAITING_PAYMENT` through `COMPLETED`, cancellation, centralized transitions, history, Admin acceptance, Chef preparation, and Ready workflow |
| Admin | Complete | Overview, Orders, Menu, Payments, Reviews, Analytics, Operations, Settings, profile, and guarded primary-Admin provisioning |
| Kitchen | Complete | CHEF authorization, Admin fallback, FIFO preparation queue, Start Preparing, Mark Ready, pickup verification, auto-refresh, and automatic visible-page wake lock |
| Pickup | Complete | Four-character server-generated credential at Ready, customer mask/show/copy, trusted verification, Cash amount due, payment-before-completion, and invalidation |
| Reviews | Complete | Submission, approved/featured public visibility, and Admin moderation history |
| Analytics | Complete | Account analytics, order/revenue/payment metrics, completed-paid top items, compact KPI cards, real trends, and empty states |
| Managed media upload | Partial | Admin manages image references to existing `/public/images` assets; hosted upload/storage is intentionally not integrated |
| Password-reset email delivery | Partial/optional | Secure reset-token and Resend delivery code exists; the current Production environment does not configure the optional Resend variables |
| Delivery | Deferred by design | Checkout is pickup-only and explicitly labels Delivery as Coming Soon |

## Customer experience

Visitors can browse all public content and menu prices without authentication.
Customers can create credentials accounts or use Google, manage a profile, keep a
browser-local cart, and submit pickup orders while online ordering is open.
Checkout revalidates the authenticated CUSTOMER, catalogue state, price tier,
integer-pesewa price, total, GHS currency, payment policy, and ordering state on
the server.

Signed-in customers receive an Orders navigation link and active-order count.
The homepage shows up to three active orders; My Orders separates active and past
orders; the detail page tracks status, exposes the pickup credential only when
Ready, links the persisted receipt after payment, and supports Order Again from
the current catalogue without changing historical snapshots.

## Roles and permissions

| Role | Intended access |
| --- | --- |
| `CUSTOMER` | Public routes and owned customer account, checkout, order, and receipt data |
| `ADMIN` | `/admin` and approved Kitchen operational fallback |
| `CHEF` | `/kitchen` operations only; no normal Admin configuration or financial access |

Roles are loaded from Prisma using the Auth.js user identity. Browser fields,
provider profile data, email text, local storage, and query parameters do not
assign authorization. `PRIMARY_ADMIN_EMAIL` and `PRIMARY_CHEF_EMAIL` are trusted
provisioning configuration for existing Auth.js users, not runtime browser
permissions.

## Ordering lifecycle

Electronic payments begin at `AWAITING_PAYMENT`; Cash allowlist orders begin at
`PENDING` with an unpaid Payment. The operational lifecycle is:

```text
AWAITING_PAYMENT -- verified Paystack payment --> PENDING
PENDING          -- Admin accepts -------------> CONFIRMED
CONFIRMED        -- Chef starts preparation ---> PREPARING
PREPARING        -- Chef marks ready ----------> READY_FOR_PICKUP
READY_FOR_PICKUP -- paid + pickup verified ----> COMPLETED
```

`CANCELLED` is terminal and is permitted only by the centralized policy. An
accepted order is not cancelled or mutated when business hours or online ordering
later closes. Order status changes made by trusted actors are recorded in
`OrderStatusHistory`.

## Business hours and online ordering

Physical Business Hours and Online Ordering Hours are separate domains.

- Physical hours describe the restaurant and the About page. The current
  schedule is 4:00 PM to midnight Monday and Wednesday-Sunday, with Tuesday
  closed. Overnight closing is represented explicitly as next-day midnight.
- Online hours determine when new website orders may be submitted and may start
  before the physical opening time.
- A configured physical closed day remains a hard online-order boundary.
- The master flag, emergency pause, forced Closed, forced Open, and weekly online
  schedule resolve through one server-side state service using `Africa/Accra`.
- Public messages use normal customer-facing times without unnecessary GMT text.

## Payment lifecycle

Paystack Card and Mobile Money use server-side Hosted Checkout. `POST /api/orders`
creates the trusted Order, Payment, and first PaymentAttempt before server-side
initialization. `POST /api/payments/paystack/initialize` creates a new retry
attempt for an owned failed electronic payment without creating another Order.

The callback at `GET /api/payments/paystack/callback` and the signed webhook at
`POST /api/payments/paystack/webhook` both require Paystack transaction
verification before finalization. The service verifies provider reference,
successful status, expected integer amount, GHS currency, channel, and provider
transaction identity. Finalization is transactional and idempotent. The webhook
validates the raw request body with HMAC-SHA512 using the server-only
`PAYSTACK_SECRET_KEY`; this hosted architecture has no public-key variable.

### Live acceptance status

The Production configuration is set to Paystack Live mode with payment and V2
ordering flags enabled. **The first controlled genuine/live Paystack transaction
has not yet been completed and remains PENDING LIVE ACCEPTANCE.** This external
acceptance gate does not make the implemented payment code incomplete.

## Cash allowlist

`CASH_ON_PICKUP_ALLOWED_EMAILS` is a server-only, comma-separated list. Parsing
trims whitespace, lowercases, drops invalid/empty values, and deduplicates. Missing
or empty configuration fails closed. Eligibility uses the authenticated Prisma
user email in both UI presentation and checkout service validation.

- Normal CUSTOMER: Paystack Card/Mobile Money required; Cash unavailable.
- Allowlisted CUSTOMER: Paystack remains available and Cash can also be chosen.
- Cash orders remain unpaid until Admin/Chef records Cash Received. Completion is
  rejected until payment is PAID.

Never put real allowlist values in source, examples, logs, or client state.

## Pickup and receipt lifecycle

The Ready transition creates a unique four-character code containing one letter
and three digits. The code is stored only for `READY_FOR_PICKUP`, masked by
default for the owning customer, and never exposed by arbitrary code lookup.
Admin/Chef may verify it. A successful paid pickup transition clears the active
code and makes the order `COMPLETED`.

A Receipt is issued only after a trusted PAID transition and is unique per
Payment. Paystack finalization issues it after verification; Cash issues it after
Cash Received. Customer and Admin documents render the same persisted Receipt as
Customer Copy or Original Copy. Refund status is shown without rewriting the
original paid amount or receipt identity.

## Operational refresh

Live surfaces use one reusable 10-second polling controller. It pauses while the
tab is hidden, refreshes immediately on visibility/focus return, coalesces nearby
events, prevents overlapping requests, cleans timers/listeners on unmount, and
keeps the last rendered state after transient failure.

- Public live ordering: Menu, Cart, Order, and Checkout.
- Customer: homepage active orders and badge, My Orders, and order detail.
- Admin: Overview and operational Orders views, excluding Analytics and editing
  forms.
- Kitchen: active and Ready queues.

Polling uses focused operational JSON where possible and `router.refresh()` for
server-owned order queues. It never calls `window.location.reload()` or invokes
the route-level spiral loader. Client component identity preserves pickup-code
show/hide and Kitchen input state during normal refreshes.

## Production architecture

- Vercel hosts the Next.js App Router application and deploys `main` through Git
  integration.
- Auth.js handles JWT sessions with a Prisma adapter and Credentials/Google
  providers.
- Prisma uses the pooled Production Neon PostgreSQL connection for application
  traffic; guarded migrations/admin tasks use the direct connection.
- The Production Neon branch is pinned by project/branch identifiers and the
  safety fingerprint `3213c801be7a`.
- Paystack credentials stay server-side. Hosted checkout keeps raw card and
  Mobile Money credentials outside the application.

## Development architecture

Development uses a separate Neon branch with fingerprint `4935952ad5c6`.
Development integration/seed/import commands validate `APP_ENV`, project, branch,
and fingerprint before writes. Production provisioning and cleanup commands use a
separate ignored `.env.admin-production.local`, require explicit confirmation,
require `sslmode=verify-full`, and reject Development/unknown branches.

## Environment overview

`.env.example` is the source checklist and classifies variables as required
Production runtime, optional Production runtime, local admin/provisioning,
Development/test, or platform-provided. Secrets and real email identities must
remain only in ignored local files or the deployment environment.

## Deployment and maintenance

1. Apply committed Prisma migrations with the direct target before deploying code
   that depends on them. Never use `prisma db push` in Production.
2. Run `npm test`, Development integration tests when safe, `npm run lint`,
   `npm run build`, and `git diff --check` before pushing `main`.
3. Let Vercel Git integration deploy; do not manually deploy unless Git
   deployment fails and the operator explicitly chooses that recovery path.
4. Monitor `/api/health/database`, Paystack webhook delivery, failed
   PaymentAttempts/refunds, Admin queues, and online-ordering operations.
5. Provision Admin/Chef only after normal first sign-in with the guarded npm
   commands documented in the README. Never manufacture Auth.js users.

## Known limitations and deferred scope

- Delivery, loyalty points, coupons, customer wallets, live map tracking,
  scheduled orders, complex customization/add-ons, customer chat, wishlists,
  multiple saved addresses, subscription meals, and advanced recommendations are
  deferred beyond V2.
- Menu media must already exist under `/public/images`; managed upload/object
  storage is deferred.
- Password-reset email delivery code is present, but `RESEND_API_KEY` and
  `AUTH_EMAIL_FROM` are not currently configured in Production. This optional
  integration does not block ordering or Google authentication.
- Polling is intentionally lightweight rather than WebSockets/SSE.
- The first genuine/live Paystack transaction and resulting callback/webhook/
  receipt observation remain the final operational acceptance step.
