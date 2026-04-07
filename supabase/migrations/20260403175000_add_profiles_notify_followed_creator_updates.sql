-- Add creator update notification preference to profiles

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'notify_followed_creator_updates'
  ) then
    alter table public.profiles
      add column notify_followed_creator_updates boolean default true;
  end if;
end $$;

update public.profiles
set notify_followed_creator_updates = true
where notify_followed_creator_updates is null;

alter table public.profiles
  alter column notify_followed_creator_updates set default true;

alter table public.profiles
  alter column notify_followed_creator_updates set not null;

comment on column public.profiles.notify_followed_creator_updates is '是否接收关注创作者的更新提醒';
