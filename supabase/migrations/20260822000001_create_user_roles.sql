-- V2A1: Create user_roles table for trusted role assignment

create type public.app_role as enum ('CUSTOMER', 'ADMIN');

create table if not exists public.user_roles (
  user_id uuid references auth.users on delete cascade primary key,
  role app_role not null,
  created_at timestamptz not null default now(),
  granted_by uuid references auth.users on delete set null
);

comment on table public.user_roles is 'Trusted role assignments. Public clients must not be able to insert or update admin roles.';
comment on column public.user_roles.user_id is 'References the auth.users ID. Primary key.';
comment on column public.user_roles.role is 'Assigned role: CUSTOMER or ADMIN.';
comment on column public.user_roles.created_at is 'Record creation timestamp.';
comment on column public.user_roles.granted_by is 'User ID who granted this role, if applicable.';
