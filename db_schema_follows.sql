-- Create follows table
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

-- Enable RLS
alter table public.follows enable row level security;

-- Policies

-- Anyone can read follows (to see follower counts, lists)
drop policy if exists "Anyone can read follows" on public.follows;
create policy "Anyone can read follows"
  on public.follows for select
  using ( true );

-- Authenticated users can follow others
drop policy if exists "Authenticated users can create follows" on public.follows;
create policy "Authenticated users can create follows"
  on public.follows for insert
  with check ( auth.uid() = follower_id );

-- Users can unfollow (delete their own follow records)
drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows"
  on public.follows for delete
  using ( auth.uid() = follower_id );

-- 4. Grants (Permissions)
-- Ensure 'authenticated' and 'anon' roles have permission to access the table
grant select, insert, delete on table public.follows to authenticated;
grant select on table public.follows to anon;
grant select, insert, update, delete on table public.follows to service_role;
