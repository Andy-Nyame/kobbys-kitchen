-- V2A1 stabilization: provision trusted customer records and keep ordering read-only.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, phone)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'display_name'),
    trim(new.raw_user_meta_data ->> 'phone')
  ) on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'CUSTOMER')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_v2a1
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recover users created through the V2 endpoint before the trigger existed,
-- but only when its validated metadata is complete.
insert into public.profiles (user_id, display_name, phone)
select
  users.id,
  trim(users.raw_user_meta_data ->> 'display_name'),
  trim(users.raw_user_meta_data ->> 'phone')
from auth.users as users
where char_length(trim(users.raw_user_meta_data ->> 'display_name')) between 2 and 80
  and char_length(trim(users.raw_user_meta_data ->> 'phone')) between 7 and 20
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
select profiles.user_id, 'CUSTOMER'
from public.profiles as profiles
on conflict (user_id) do nothing;

-- Ordering has no server-side creation or transition workflow yet. Do not
-- expose direct table mutations merely because a feature flag is disabled.
drop policy if exists "customers_create_own_orders" on public.orders;
drop policy if exists "customers_update_own_pending_orders" on public.orders;

alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(trim(display_name)) between 2 and 80) not valid;

alter table public.profiles
  add constraint profiles_phone_length
  check (char_length(trim(phone)) between 7 and 20) not valid;

alter table public.menu_items
  add constraint menu_items_price_nonnegative
  check (price_minor >= 0) not valid;

alter table public.menu_items
  add constraint menu_items_currency_ghs
  check (currency = 'GHS') not valid;

alter table public.orders
  add constraint orders_amounts_nonnegative
  check (subtotal_minor >= 0 and total_minor >= 0) not valid;

alter table public.orders
  add constraint orders_currency_ghs
  check (currency = 'GHS') not valid;

alter table public.order_items
  add constraint order_items_amounts_nonnegative
  check (
    unit_price_minor_snapshot >= 0
    and line_total_minor_snapshot >= 0
    and line_total_minor_snapshot = unit_price_minor_snapshot * quantity
  ) not valid;

alter table public.order_items
  add constraint order_items_menu_item_id_fkey
  foreign key (menu_item_id) references public.menu_items(id) on delete set null
  not valid;
