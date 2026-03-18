-- P0 Safety: reports table, message_privacy, age_confirmed_at
-- Addresses issues #9 (content reporting), #10 (message access control), #11 (age verification)

--------------------------------------------------------------------------------
-- 1. reports table (#9)
--------------------------------------------------------------------------------

create table if not exists public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null
    check (content_type in ('project','discussion','discussion_reply','comment','message','completion_comment')),
  content_id bigint not null,
  reason text not null
    check (reason in ('spam','harassment','inappropriate','illegal','other')),
  description text check (char_length(description) <= 500),
  status text not null default 'pending'
    check (status in ('pending','resolved','dismissed')),
  reviewer_id uuid references public.profiles(id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  constraint reports_unique_per_user unique (reporter_id, content_type, content_id)
);

create index if not exists idx_reports_status_created
  on public.reports (status, created_at desc);

create index if not exists idx_reports_content
  on public.reports (content_type, content_id);

alter table public.reports enable row level security;

-- Authenticated users can create reports (own reporter_id only)
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Users can view their own reports
create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

-- Moderators/admins can view all reports
create policy "reports_select_mod"
  on public.reports for select
  to authenticated
  using (is_moderator_or_admin());

-- Moderators/admins can update reports (review)
create policy "reports_update_mod"
  on public.reports for update
  to authenticated
  using (is_moderator_or_admin())
  with check (is_moderator_or_admin());

grant select, insert on public.reports to authenticated;
grant update (status, reviewer_id, reviewer_note, reviewed_at) on public.reports to authenticated;
grant usage on sequence public.reports_id_seq to authenticated;

--------------------------------------------------------------------------------
-- 2. profiles.message_privacy (#10)
--------------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'message_privacy'
  ) then
    alter table public.profiles
      add column message_privacy text not null default 'everyone';
    alter table public.profiles
      add constraint profiles_message_privacy_check
      check (message_privacy in ('everyone','followers_only','nobody'));
  end if;
end $$;

--------------------------------------------------------------------------------
-- 3. profiles.age_confirmed_at (#11)
--------------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'age_confirmed_at'
  ) then
    alter table public.profiles
      add column age_confirmed_at timestamptz;
  end if;
end $$;

--------------------------------------------------------------------------------
-- 4. Update handle_new_user trigger to set age_confirmed_at (#11)
--    Front-end blocks sign-up without age confirmation, so reaching
--    the trigger means the user already confirmed.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_avatar text;
BEGIN
  default_avatar := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'avatar_url'), ''),
    '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 8)) || '.svg'
  );

  INSERT INTO public.profiles (id, username, display_name, avatar_url, age_confirmed_at)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    default_avatar,
    now()
  );
  RETURN new;
END;
$$;
