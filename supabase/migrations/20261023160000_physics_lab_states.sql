-- Private, account-scoped portable physics lab backups. No progress rewards.
create table public.physics_lab_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint physics_lab_states_backup_shape check (
    (jsonb_typeof(data) = 'object'
    and data @> '{"kind":"steamx-physics-backup","version":1}'::jsonb
    and jsonb_typeof(data->'exportedAt') = 'string'
    and jsonb_typeof(data->'experiments') = 'array'
    and jsonb_typeof(data->'notebook') = 'object'
    and jsonb_typeof(data->'observations') = 'array') is true
  ),
  -- jsonb text includes formatting spaces; application enforces the exact 8 MiB
  -- compact UTF-8 limit. This bounded representation permits that formatting.
  constraint physics_lab_states_backup_size check (octet_length(data::text) <= 16 * 1024 * 1024)
);

alter table public.physics_lab_states enable row level security;
revoke all on public.physics_lab_states from public, anon;
grant select, insert, update, delete on public.physics_lab_states to authenticated;
grant all on public.physics_lab_states to service_role;

-- The primary key indexes every owner lookup and CAS update.
create policy physics_lab_states_select on public.physics_lab_states
  for select to authenticated using ((select auth.uid()) = user_id);
create policy physics_lab_states_insert on public.physics_lab_states
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy physics_lab_states_update on public.physics_lab_states
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy physics_lab_states_delete on public.physics_lab_states
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Apply the existing account restriction contract to direct Supabase writes as
-- well as the authenticated route. Read access remains available for backups.
create trigger trg_interaction_access_physics_lab_states
  before insert or update on public.physics_lab_states
  for each row execute function public.enforce_interaction_access('save_progress');
