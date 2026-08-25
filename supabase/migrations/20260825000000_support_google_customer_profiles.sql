-- Google identities may not include a phone number or a usable display name.
-- Keep public signup's strict validation intact while provisioning all Auth
-- users as safe CUSTOMER accounts through this trusted trigger.

alter table public.profiles
  alter column phone drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile_display_name text;
  profile_phone text;
begin
  profile_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Customer'
  );
  profile_display_name := regexp_replace(profile_display_name, '[[:cntrl:]]', '', 'g');

  if char_length(profile_display_name) not between 2 and 80 then
    profile_display_name := 'Customer';
  end if;

  profile_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  if profile_phone is not null and profile_phone !~ '^\+233[0-9]{9}$' then
    profile_phone := null;
  end if;

  insert into public.profiles (user_id, display_name, phone)
  values (new.id, profile_display_name, profile_phone)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'CUSTOMER')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
