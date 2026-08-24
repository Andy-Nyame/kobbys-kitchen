-- Customer profile completion: limit direct updates to approved columns and
-- align new/updated rows with application-level Ghana phone normalization.

revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_display_name_no_control_characters
  check (display_name !~ '[[:cntrl:]]') not valid;

alter table public.profiles
  add constraint profiles_phone_ghana_canonical
  check (phone ~ '^\+233[0-9]{9}$') not valid;

comment on constraint profiles_phone_ghana_canonical on public.profiles is
  'New and updated phone values use canonical Ghana +233 followed by nine digits.';
