-- Public visitors may browse all active menu items. Availability is a display
-- concern at this stage: unavailable items remain visible but cannot be added
-- to the browser cart. Catalogue mutations remain service/admin-only.

drop policy if exists "public_read_active_available_items" on public.menu_items;

create policy "public_read_active_menu_items"
  on public.menu_items
  for select
  to anon, authenticated
  using (active = true);

create index if not exists menu_categories_public_catalogue_idx
  on public.menu_categories (active, sort_order, name);

create index if not exists menu_items_public_catalogue_idx
  on public.menu_items (active, category_id, sort_order, name);
