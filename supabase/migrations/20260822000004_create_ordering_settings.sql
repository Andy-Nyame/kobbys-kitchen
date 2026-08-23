-- V2A1: Create ordering_settings table for operational control

create table if not exists public.ordering_settings (
  id integer primary key check (id = 1),
  accepting_orders boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

comment on table public.ordering_settings is 'Singleton table controlling whether online ordering is accepted.';
comment on column public.ordering_settings.id is 'Singleton row identifier, always 1.';
comment on column public.ordering_settings.accepting_orders is 'Whether the system is currently accepting orders.';
comment on column public.ordering_settings.updated_at is 'Last update timestamp.';
comment on column public.ordering_settings.updated_by is 'User who last updated the setting.';

insert into public.ordering_settings (id, accepting_orders)
values (1, false)
on conflict (id) do nothing;
