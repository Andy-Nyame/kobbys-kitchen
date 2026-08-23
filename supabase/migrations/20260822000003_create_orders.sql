-- V2A1: Create order schema foundation (pickup-only)

create type public.order_fulfillment_type as enum ('PICKUP');
create type public.order_status as enum (
  'PENDING',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED'
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default gen_random_uuid()::text,
  user_id uuid references auth.users on delete set null,
  fulfillment_type order_fulfillment_type not null default 'PICKUP',
  status order_status not null default 'PENDING',
  customer_name_snapshot text not null,
  phone_snapshot text not null,
  pickup_mode text not null default 'PICKUP',
  notes text,
  subtotal_minor integer not null default 0,
  total_minor integer not null default 0,
  currency text not null default 'GHS',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is 'Order headers. Pickup-only in V2A1.';
comment on column public.orders.id is 'Order unique identifier.';
comment on column public.orders.reference is 'Human-readable random order reference.';
comment on column public.orders.user_id is 'Customer user ID, nullable for guest orders in future.';
comment on column public.orders.fulfillment_type is 'PICKUP only in V2A1.';
comment on column public.orders.status is 'Current order status.';
comment on column public.orders.customer_name_snapshot is 'Snapshot of customer name at order time.';
comment on column public.orders.phone_snapshot is 'Snapshot of customer phone at order time.';
comment on column public.orders.pickup_mode is 'Pickup mode identifier.';
comment on column public.orders.notes is 'Customer order notes.';
comment on column public.orders.subtotal_minor is 'Subtotal in minor units.';
comment on column public.orders.total_minor is 'Total in minor units.';
comment on column public.orders.currency is 'Currency code.';
comment on column public.orders.idempotency_key is 'Idempotency key to prevent duplicate orders.';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  menu_item_id uuid,
  item_name_snapshot text not null,
  unit_price_minor_snapshot integer not null,
  quantity integer not null check (quantity > 0),
  line_total_minor_snapshot integer not null,
  created_at timestamptz not null default now()
);

comment on table public.order_items is 'Immutable order line items.';
comment on column public.order_items.id is 'Line item unique identifier.';
comment on column public.order_items.order_id is 'References the parent order.';
comment on column public.order_items.menu_item_id is 'Nullable reference to menu item.';
comment on column public.order_items.item_name_snapshot is 'Snapshot of item name at order time.';
comment on column public.order_items.unit_price_minor_snapshot is 'Snapshot of unit price at order time.';
comment on column public.order_items.quantity is 'Quantity ordered.';
comment on column public.order_items.line_total_minor_snapshot is 'Snapshot of line total at order time.';

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  status order_status not null,
  changed_by uuid references auth.users on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.order_status_history is 'Audit trail for order status changes.';
comment on column public.order_status_history.id is 'History entry unique identifier.';
comment on column public.order_status_history.order_id is 'References the parent order.';
comment on column public.order_status_history.status is 'Status that was set.';
comment on column public.order_status_history.changed_by is 'User who changed the status.';
comment on column public.order_status_history.notes is 'Optional notes about the change.';

create trigger orders_updated_at
  before update on public.orders
  for each row
  execute function public.handle_updated_at();
