-- Development activation: preserve the public review contract and add trusted
-- moderation without exposing direct public or customer table mutations.

create type public.review_status as enum (
  'pending',
  'approved',
  'hidden'
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  rating integer not null check (rating between 1 and 5),
  category text not null,
  comment text not null,
  contact text,
  status public.review_status not null default 'pending',
  featured boolean not null default false,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_display_name_valid check (
    char_length(trim(display_name)) between 2 and 80
    and display_name !~ '[[:cntrl:]]'
  ),
  constraint reviews_category_valid check (
    category in (
      'Food',
      'Customer Service',
      'Takeaway',
      'Event Order',
      'General Experience'
    )
  ),
  constraint reviews_comment_valid check (
    char_length(trim(comment)) between 10 and 1000
    and comment !~ '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]'
  ),
  constraint reviews_contact_valid check (
    contact is null or char_length(trim(contact)) between 1 and 120
  ),
  constraint reviews_featured_requires_approval check (
    featured = false or status = 'approved'
  ),
  constraint reviews_moderation_metadata_valid check (
    (moderated_at is null and moderated_by is null)
    or
    (moderated_at is not null and moderated_by is not null)
  )
);

create table public.review_moderation_history (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  previous_status public.review_status not null,
  next_status public.review_status not null,
  previous_featured boolean not null,
  next_featured boolean not null,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index reviews_status_created_at_idx
  on public.reviews(status, created_at desc);

create index reviews_featured_created_at_idx
  on public.reviews(created_at desc)
  where featured = true;

create index review_moderation_history_review_created_at_idx
  on public.review_moderation_history(review_id, created_at desc);

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.handle_updated_at();

create or replace function public.enforce_review_moderation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status::text <> 'approved' then
    new.featured = false;
  end if;

  if old.status is distinct from new.status
    or old.featured is distinct from new.featured then
    if new.moderated_by is null then
      raise exception 'review moderation requires a trusted actor'
        using errcode = 'check_violation';
    end if;

    new.moderated_at = now();
  end if;

  return new;
end;
$$;

create trigger enforce_review_moderation
  before update of status, featured on public.reviews
  for each row execute function public.enforce_review_moderation();

create or replace function public.record_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    or old.featured is distinct from new.featured then
    insert into public.review_moderation_history (
      review_id,
      previous_status,
      next_status,
      previous_featured,
      next_featured,
      moderated_by
    ) values (
      new.id,
      old.status,
      new.status,
      old.featured,
      new.featured,
      new.moderated_by
    );
  end if;

  return new;
end;
$$;

create trigger record_review_moderation
  after update of status, featured on public.reviews
  for each row execute function public.record_review_moderation();

alter table public.reviews enable row level security;
alter table public.review_moderation_history enable row level security;

revoke all on public.reviews from anon, authenticated;
revoke all on public.review_moderation_history from anon, authenticated;

grant select, insert, update, delete on public.reviews to service_role;
grant select, insert on public.review_moderation_history to service_role;

comment on table public.reviews is
  'Customer reviews. Public submissions and reads pass through validated server routes.';
comment on table public.review_moderation_history is
  'Append-only audit records for trusted review moderation state changes.';
