-- V2A1: Create menu_categories and menu_items tables

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menu_categories is 'Menu categories for organizing menu items.';
comment on column public.menu_categories.id is 'Category unique identifier.';
comment on column public.menu_categories.name is 'Category display name.';
comment on column public.menu_categories.slug is 'URL-friendly unique slug.';
comment on column public.menu_categories.active is 'Whether the category is currently active.';
comment on column public.menu_categories.sort_order is 'Display sort order.';

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories on delete restrict,
  slug text not null unique,
  name text not null,
  description text not null default '',
  image_path text,
  image_alt text,
  price_minor integer not null,
  currency text not null default 'GHS',
  available boolean not null default true,
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menu_items is 'Menu items with pricing in minor units (pesewas).';
comment on column public.menu_items.id is 'Item unique identifier.';
comment on column public.menu_items.category_id is 'References the menu category.';
comment on column public.menu_items.slug is 'URL-friendly unique slug.';
comment on column public.menu_items.name is 'Item display name.';
comment on column public.menu_items.description is 'Item description.';
comment on column public.menu_items.image_path is 'Path to item image.';
comment on column public.menu_items.image_alt is 'Alt text for item image.';
comment on column public.menu_items.price_minor is 'Price in minor units (pesewas for GHS).';
comment on column public.menu_items.currency is 'Currency code, default GHS.';
comment on column public.menu_items.available is 'Whether the item is currently available.';
comment on column public.menu_items.featured is 'Whether the item is featured.';
comment on column public.menu_items.active is 'Whether the item is active in the catalogue.';
comment on column public.menu_items.sort_order is 'Display sort order within category.';

create trigger menu_categories_updated_at
  before update on public.menu_categories
  for each row
  execute function public.handle_updated_at();

create trigger menu_items_updated_at
  before update on public.menu_items
  for each row
  execute function public.handle_updated_at();
