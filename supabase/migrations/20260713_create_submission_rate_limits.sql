create table if not exists public.submission_rate_limits (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  action text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists submission_rate_limits_identifier_action_created_at_idx
  on public.submission_rate_limits (identifier_hash, action, created_at desc);

alter table public.submission_rate_limits enable row level security;
