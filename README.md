# Kobby’s Kitchen

Next.js App Router website for Kobby’s Kitchen, built with JavaScript, JSX, and plain CSS.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PRIMARY_ADMIN_EMAIL=
NEXT_PUBLIC_SITE_URL=
```

3. Run the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Required Supabase setup

- Reviews are submitted through the server-only Supabase admin client.
- Public reviews are loaded through the Next.js API routes.

## Primary admin bootstrap

First create the trusted owner through the normal signup flow and confirm the
email address. Confirm that the target Supabase project is the intended
environment and that the repository migrations have been applied there. Then
set `PRIMARY_ADMIN_EMAIL` in `.env.local` to that existing user's email and run:

```bash
npm run provision:primary-admin
```

The command runs only from the server-side development environment. It uses the
Supabase secret key to locate the existing Auth user, fails if that user does
not exist, verifies that `public.user_roles` is available, and idempotently
assigns the existing `ADMIN` role. It does not create an Auth user or accept a
password. Remove `PRIMARY_ADMIN_EMAIL` from the environment after provisioning
if it is no longer needed.

## Checks

Run these before deployment:

```bash
npm run lint
npm run build
```

## Vercel environment variables

Add these variables in Vercel for preview and production deployments:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
