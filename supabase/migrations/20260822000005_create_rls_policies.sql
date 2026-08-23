-- V2A1: Enable RLS and create restrictive policies for all new tables

-- Enable RLS on all new tables
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.ordering_settings enable row level security;

-- ============================================
-- PROFILES
-- ============================================

-- Customers can read their own profile
create policy "customers_read_own_profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Customers can update their own profile (display_name, phone only)
create policy "customers_update_own_profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- USER_ROLES
-- ============================================

-- Users can read their own role
create policy "users_read_own_role"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No public insert/update policies - admin roles are provisioned separately
-- Only service_role can manage roles

-- ============================================
-- MENU_CATEGORIES
-- ============================================

-- Public and authenticated users can read active categories
create policy "public_read_active_categories"
  on public.menu_categories
  for select
  to anon, authenticated
  using (active = true);

-- ============================================
-- MENU_ITEMS
-- ============================================

-- Public and authenticated users can read active and available items
create policy "public_read_active_available_items"
  on public.menu_items
  for select
  to anon, authenticated
  using (active = true and available = true);

-- ============================================
-- ORDERS
-- ============================================

-- Customers can read their own orders
create policy "customers_read_own_orders"
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Customers can create their own orders (for future ordering)
create policy "customers_create_own_orders"
  on public.orders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Customers can update their own orders only while PENDING (for future cancellation)
create policy "customers_update_own_pending_orders"
  on public.orders
  for update
  to authenticated
  using (auth.uid() = user_id and status = 'PENDING')
  with check (auth.uid() = user_id and status = 'PENDING');

-- ============================================
-- ORDER_ITEMS
-- ============================================

-- Customers can read items for their own orders
create policy "customers_read_own_order_items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- ============================================
-- ORDER_STATUS_HISTORY
-- ============================================

-- Customers can read history for their own orders
create policy "customers_read_own_order_history"
  on public.order_status_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and orders.user_id = auth.uid()
    )
  );

-- ============================================
-- ORDERING_SETTINGS
-- ============================================

-- Public and authenticated users can read ordering settings
create policy "public_read_ordering_settings"
  on public.ordering_settings
  for select
  to anon, authenticated
  using (true);
