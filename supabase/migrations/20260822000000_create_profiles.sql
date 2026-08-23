-- V2A1: Create profiles table linked to auth.users

create table if not exists public.profiles (
  user_id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Customer profile data linked to Supabase Auth user ID.';
comment on column public.profiles.user_id is 'References the auth.users ID. Primary key.';
comment on column public.profiles.display_name is 'Customer display name.';
comment on column public.profiles.phone is 'Customer phone number.';
comment on column public.profiles.created_at is 'Record creation timestamp.';
comment on column public.profiles.updated_at is 'Record last update timestamp.';

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();
