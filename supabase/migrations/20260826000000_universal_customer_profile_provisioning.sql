-- Universal customer provisioning: every Auth user created by a supported
-- provider receives one customer profile and one CUSTOMER role. The same
-- profile routine is also available to the currently authenticated CUSTOMER
-- for a safe repair of legacy accounts that predate the Auth trigger.

create or replace function public.provision_customer_profile(
  target_user_id uuid,
  target_metadata jsonb,
  target_email text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_display_name text;
  profile_phone text;
  profile_row public.profiles;
begin
  profile_display_name := coalesce(
    nullif(trim(target_metadata ->> 'display_name'), ''),
    nullif(trim(target_metadata ->> 'full_name'), ''),
    nullif(trim(target_metadata ->> 'name'), ''),
    nullif(split_part(coalesce(target_email, ''), '@', 1), ''),
    'Customer'
  );
  profile_display_name := regexp_replace(profile_display_name, '[[:cntrl:]]', '', 'g');

  if char_length(profile_display_name) not between 2 and 80 then
    profile_display_name := 'Customer';
  end if;

  profile_phone := nullif(trim(target_metadata ->> 'phone'), '');

  if profile_phone is not null and profile_phone !~ '^\+233[0-9]{9}$' then
    profile_phone := null;
  end if;

  insert into public.profiles (user_id, display_name, phone)
  values (target_user_id, profile_display_name, profile_phone)
  on conflict (user_id) do nothing
  returning * into profile_row;

  if profile_row.user_id is null then
    select * into profile_row
    from public.profiles
    where user_id = target_user_id;
  end if;

  return profile_row;
end;
$$;

revoke all on function public.provision_customer_profile(uuid, jsonb, text) from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'CUSTOMER')
  on conflict (user_id) do nothing;

  perform public.provision_customer_profile(
    new.id,
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    new.email
  );

  return new;
end;
$$;

create or replace function public.ensure_current_customer_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_row auth.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'CUSTOMER'
  ) then
    raise exception 'Customer access is required.' using errcode = '42501';
  end if;

  select * into auth_user_row
  from auth.users
  where id = auth.uid();

  if not found then
    raise exception 'Authenticated user was not found.' using errcode = '42501';
  end if;

  return public.provision_customer_profile(
    auth_user_row.id,
    coalesce(auth_user_row.raw_user_meta_data, '{}'::jsonb),
    auth_user_row.email
  );
end;
$$;

revoke all on function public.ensure_current_customer_profile() from public;
grant execute on function public.ensure_current_customer_profile() to authenticated;

comment on function public.ensure_current_customer_profile() is
  'Idempotently creates the profile of the current authenticated CUSTOMER only.';
