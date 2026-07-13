# Kobby’s Kitchen

Next.js App Router website for Kobby’s Kitchen, built with JavaScript, JSX, and plain CSS.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
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
