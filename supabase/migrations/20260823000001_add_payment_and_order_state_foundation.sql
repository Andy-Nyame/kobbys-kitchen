-- V2A1.1: Add payment and order-state foundations without enabling ordering.

alter type public.order_status
  add value if not exists 'AWAITING_PAYMENT' before 'PENDING';

-- Repeat the stabilization boundary defensively because deployment history for
-- the preceding corrective migration is not known. Order creation and mutation
-- remain trusted-server responsibilities while ordering is disabled.
drop policy if exists "customers_create_own_orders" on public.orders;
drop policy if exists "customers_update_own_pending_orders" on public.orders;

create type public.payment_method as enum (
  'CASH',
  'MOBILE_MONEY',
  'CARD'
);

create type public.payment_status as enum (
  'UNPAID',
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);

create type public.payment_attempt_status as enum (
  'PENDING',
  'SUCCEEDED',
  'FAILED'
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_method_status_valid check (
    (method = 'CASH' and status in ('UNPAID', 'PAID', 'REFUNDED'))
    or
    (
      method in ('MOBILE_MONEY', 'CARD')
      and status in ('PENDING', 'PAID', 'FAILED', 'REFUNDED')
    )
  ),
  constraint payments_paid_at_valid check (
    (status in ('PAID', 'REFUNDED') and paid_at is not null)
    or
    (status not in ('PAID', 'REFUNDED') and paid_at is null)
  ),
  constraint payments_provider_valid check (
    provider is null or char_length(trim(provider)) > 0
  ),
  constraint payments_provider_reference_valid check (
    provider_reference is null or char_length(trim(provider_reference)) > 0
  )
);

create unique index payments_provider_reference_unique
  on public.payments (provider, provider_reference)
  where provider is not null and provider_reference is not null;

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider text not null check (char_length(trim(provider)) > 0),
  provider_reference text,
  idempotency_key text not null unique
    check (char_length(trim(idempotency_key)) > 0),
  status public.payment_attempt_status not null default 'PENDING',
  failure_code text,
  failure_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_attempts_provider_reference_valid check (
    provider_reference is null or char_length(trim(provider_reference)) > 0
  ),
  constraint payment_attempts_completion_valid check (
    (status = 'PENDING' and completed_at is null)
    or
    (status in ('SUCCEEDED', 'FAILED') and completed_at is not null)
  ),
  constraint payment_attempts_failure_valid check (
    status = 'FAILED'
    or (failure_code is null and failure_message is null)
  )
);

create unique index payment_attempts_provider_reference_unique
  on public.payment_attempts (provider, provider_reference)
  where provider_reference is not null;

comment on table public.payments is
  'One logical payment per order. Only a PAID logical payment is revenue.';
comment on column public.payments.amount_minor is
  'Payment amount in integer minor units (pesewas for GHS).';
comment on column public.payments.provider is
  'Neutral electronic payment provider identifier; null for cash.';
comment on column public.payments.provider_reference is
  'Canonical provider reference after trusted verification.';
comment on table public.payment_attempts is
  'Retry-safe history of payment attempts. Attempts are not revenue.';
comment on column public.payment_attempts.idempotency_key is
  'Server-generated key preventing duplicate attempt creation.';

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status::text = 'AWAITING_PAYMENT' and new.status::text in ('PENDING', 'CANCELLED'))
    or (old.status::text = 'PENDING' and new.status::text in ('PREPARING', 'CANCELLED'))
    or (old.status::text = 'PREPARING' and new.status::text in ('READY_FOR_PICKUP', 'CANCELLED'))
    or (old.status::text = 'READY_FOR_PICKUP' and new.status::text in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'invalid order status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_orders_status_transition
  before update of status on public.orders
  for each row execute function public.enforce_order_status_transition();

create or replace function public.enforce_payment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_id <> old.order_id
    or new.method <> old.method
    or new.amount_minor <> old.amount_minor
    or new.currency <> old.currency then
    raise exception 'payment order, method, amount, and currency are immutable'
      using errcode = 'check_violation';
  end if;

  if old.status <> new.status and not (
    (old.status::text = 'UNPAID' and new.status::text = 'PAID')
    or (old.status::text = 'PENDING' and new.status::text in ('PAID', 'FAILED'))
    or (old.status::text = 'FAILED' and new.status::text = 'PENDING')
    or (old.status::text = 'PAID' and new.status::text = 'REFUNDED')
  ) then
    raise exception 'invalid payment status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_payments_update
  before update on public.payments
  for each row execute function public.enforce_payment_update();

alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;

create policy "customers_read_own_payments"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = payments.order_id
        and orders.user_id = auth.uid()
    )
  );

-- Intentionally no customer insert, update, or delete policies on payments.
-- Intentionally no customer policies on payment_attempts. Trusted server-side
-- workflows will create orders, mutate logical payments, and record attempts.
