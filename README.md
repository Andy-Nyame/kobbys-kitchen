# Kobby’s Kitchen

Next.js App Router application built with JavaScript, JSX, and plain CSS. The
application backend uses Auth.js, Prisma, and Neon PostgreSQL.

Kobby's Kitchen V2 includes the public restaurant experience, CUSTOMER ordering,
Paystack Hosted Checkout, account/order tracking, Admin operations, and the CHEF
Kitchen workspace. See:

- [V2 release documentation](docs/KOBBYS_KITCHEN_V2_RELEASE.md)
- [System architecture](docs/SYSTEM_ARCHITECTURE.md)
- [Paystack setup and acceptance](docs/paystack-setup.md)

## Local development

1. Copy `.env.example` to `.env.local` and provide development-only values.
2. Use the pooled Neon URL for `DATABASE_URL` and the direct URL for
   `DATABASE_URL_UNPOOLED`.
3. Confirm `APP_ENV=development` and `V2_ORDERING_ENABLED=false`.
4. Apply repeatable migrations and seed the development catalogue:

```bash
npm run prisma:migrate:dev
npm run seed:development
```

5. Start the application:

```bash
npm run dev
```

The database commands validate the configured Neon project and branch against
`NEON_PROJECT_ID` and `NEON_BRANCH_ID` before writing.

`.env.example` documents the complete current environment contract. Keep real
credentials, primary-role emails, and Cash allowlist values only in ignored local
environment files or the deployment platform.

## Authentication

- Credentials accounts use an Argon2id password hash.
- Google OAuth is handled by Auth.js when `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` are configured.
- The local Google callback is
  `http://localhost:3000/api/auth/callback/google`. Add the equivalent HTTPS
  callback for each preview or production host in Google Cloud.
- Customer profiles and the `CUSTOMER` role are provisioned idempotently on the
  server. Provider metadata is never used for authorization.
- Password reset tokens are random, stored only as SHA-256 hashes, expire after
  30 minutes, and are single-use. Email delivery requires `RESEND_API_KEY` and
  `AUTH_EMAIL_FROM`.

## Primary admin

Create the owner through the normal signup flow, set `PRIMARY_ADMIN_EMAIL` to
that existing Auth.js user, and run:

```bash
npm run provision:primary-admin
```

The command is development-only, validates the Neon project and branch, and
idempotently changes only that existing user’s role to `ADMIN`. It never creates
credentials or accepts a password.

Production provisioning uses the ignored `.env.admin-production.local`, requires
the exact Production confirmation, and only updates an existing Auth.js user:

```bash
npm run provision:primary-admin:production -- --confirm-production-admin
npm run provision:primary-chef:production -- --confirm-production-chef
```

The configured primary Admin and Chef identities must be different. CUSTOMER,
ADMIN, and CHEF permissions are still enforced from the Prisma role on every
protected server boundary.

## Legacy development import

`npm run migrate:supabase-development` is a one-way, development-only import
tool for preserving customer identities, profiles, Google account links, menu
data, reviews, and ordering settings from the former Supabase development
database. Password hashes and provider secrets are intentionally not copied.
Imported password users must use the password-reset flow before signing in.

The `supabase/migrations` directory is retained as historical source-schema
documentation; it is not part of the application runtime.

## Verification

```bash
npm test
npm run test:development:integration
npm run test:development:backend
npm run lint
npm run build
```

The integration and acceptance commands must only be run against the confirmed
development Neon project. No deployment is performed by these scripts.
