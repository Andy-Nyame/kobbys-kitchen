import pg from "pg";
import { getApprovedBackfillPriceStepMinor } from "../src/lib/menu/pricing.js";

import { prisma } from "../src/lib/prisma.js";
import { verifyDevelopmentDatabase } from "./database-safety.js";

function safeImage(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function displayNameFor(user) {
  const metadata = user.raw_user_meta_data || {};
  const candidate =
    user.display_name || metadata.full_name || metadata.name || user.email?.split("@")[0];
  return String(candidate || "Customer").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 80);
}

function imageFor(user) {
  const metadata = user.raw_user_meta_data || {};
  return safeImage(metadata.avatar_url) || safeImage(metadata.picture);
}

await verifyDevelopmentDatabase();

if (process.env.APP_ENV !== "development") {
  throw new Error("Supabase import may only run in development.");
}

const sourceUrl = process.env.SUPABASE_DB_URL;

if (!sourceUrl) {
  throw new Error("SUPABASE_DB_URL is required for the read-only source inventory.");
}

const source = new pg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
await source.connect();

let snapshot;

try {
  await source.query("begin read only");
  const users = await source.query(`
      select
        u.id::text,
        lower(u.email) as email,
        u.email_confirmed_at,
        u.created_at,
        u.updated_at,
        u.raw_user_meta_data,
        p.display_name,
        p.phone,
        coalesce(ur.role::text, 'CUSTOMER') as role
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      left join public.user_roles ur on ur.user_id = u.id
    `);
  const identities = await source.query(`
      select user_id::text, provider, provider_id, identity_data
      from auth.identities
      where provider = 'google'
    `);
  const categories = await source.query(`
      select id::text, name, slug, active, sort_order, created_at, updated_at
      from public.menu_categories
    `);
  const items = await source.query(`
      select id::text, category_id::text, slug, name, description, image_path,
        image_alt, price_minor, currency, available, featured, active, sort_order,
        created_at, updated_at
      from public.menu_items
    `);
  const reviews = await source.query(`
      select id::text, display_name, contact, category, rating, comment, status::text,
        featured, created_at, updated_at
      from public.reviews
    `);
  const settings = await source.query(`
      select accepting_orders, updated_at
      from public.ordering_settings
      limit 1
    `);

  snapshot = {
    users: users.rows,
    identities: identities.rows,
    categories: categories.rows,
    items: items.rows,
    reviews: reviews.rows,
    setting: settings.rows[0] || null,
  };
  await source.query("rollback");
} finally {
  await source.end();
}

const trustedAdminEmail = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase() || null;
const identityByUser = new Map(snapshot.identities.map((identity) => [identity.user_id, identity]));
const categoryIdBySourceId = new Map();

try {
  await prisma.$transaction(async (transaction) => {
    for (const sourceUser of snapshot.users) {
      const displayName = displayNameFor(sourceUser);
      const image = imageFor(sourceUser);
      const trustedRole =
        sourceUser.role === "ADMIN" && sourceUser.email === trustedAdminEmail
          ? "ADMIN"
          : "CUSTOMER";
      const user = await transaction.user.upsert({
        where: { email: sourceUser.email },
        create: {
          id: sourceUser.id,
          email: sourceUser.email,
          emailVerified: sourceUser.email_confirmed_at,
          name: displayName,
          image,
          role: trustedRole,
          createdAt: sourceUser.created_at,
          updatedAt: sourceUser.updated_at,
        },
        update: {
          name: displayName,
          image,
        },
      });

      if (trustedRole === "CUSTOMER") {
        await transaction.profile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            displayName,
            phone: sourceUser.phone || null,
            imageUrl: image,
          },
          update: {},
        });
      }

      const identity = identityByUser.get(sourceUser.id);

      if (identity?.provider_id) {
        await transaction.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: identity.provider_id,
            },
          },
          create: {
            userId: user.id,
            type: "oauth",
            provider: "google",
            providerAccountId: identity.provider_id,
          },
          update: { userId: user.id },
        });
      }
    }

    for (const category of snapshot.categories) {
      const target = await transaction.menuCategory.upsert({
        where: { slug: category.slug },
        create: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          active: category.active,
          sortOrder: category.sort_order,
          createdAt: category.created_at,
          updatedAt: category.updated_at,
        },
        update: {
          name: category.name,
          active: category.active,
          sortOrder: category.sort_order,
        },
      });
      categoryIdBySourceId.set(category.id, target.id);
    }

    for (const item of snapshot.items) {
      const categoryId = categoryIdBySourceId.get(item.category_id);

      if (!categoryId) {
        throw new Error(`Menu item ${item.slug} has no migrated category.`);
      }

      const values = {
        categoryId,
        name: item.name,
        description: item.description,
        imagePath: item.image_path,
        imageAlt: item.image_alt,
        priceMinor: item.price_minor,
        priceStepMinor: getApprovedBackfillPriceStepMinor(item.price_minor),
        currency: item.currency,
        available: item.available,
        featured: item.featured,
        active: item.active,
        sortOrder: item.sort_order,
      };
      if (!values.priceStepMinor) {
        throw new Error(
          `Menu item ${item.slug} does not match the approved variable-price backfill convention.`
        );
      }
      await transaction.menuItem.upsert({
        where: { slug: item.slug },
        create: {
          id: item.id,
          slug: item.slug,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          ...values,
        },
        update: values,
      });
    }

    for (const review of snapshot.reviews) {
      const status = review.status === "approved"
        ? "APPROVED"
        : review.status === "hidden"
          ? "REJECTED"
          : "PENDING";
      await transaction.review.upsert({
        where: { id: review.id },
        create: {
          id: review.id,
          displayName: review.display_name,
          contact: review.contact,
          category: review.category,
          rating: review.rating,
          content: review.comment,
          status,
          featured: status === "APPROVED" && review.featured,
          createdAt: review.created_at,
          updatedAt: review.updated_at,
        },
        update: {},
      });
    }

    await transaction.orderingSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        acceptingOrders: snapshot.setting?.accepting_orders === true,
      },
      update: {},
    });
  }, { maxWait: 10000, timeout: 120000 });

  console.log(JSON.stringify({
    migrated: true,
    users: snapshot.users.length,
    passwordResetRequired: snapshot.users.filter((user) => !identityByUser.has(user.id)).length,
    googleAccounts: snapshot.identities.length,
    profiles: snapshot.users.filter((user) => user.role !== "ADMIN").length,
    categories: snapshot.categories.length,
    items: snapshot.items.length,
    reviews: snapshot.reviews.length,
  }));
} finally {
  await prisma.$disconnect();
}
