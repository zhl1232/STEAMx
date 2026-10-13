-- Service-only rolling 60-second budget, shared across all speech endpoints/users.
create table if not exists public.tutor_speech_budget (
  kind text primary key check (kind in ('tts', 'asr')),
  requests timestamptz[] not null default '{}'
);
alter table public.tutor_speech_budget enable row level security;
revoke all on public.tutor_speech_budget from public, anon, authenticated;

create or replace function public.reserve_tutor_speech_request(p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_requests timestamptz[];
  v_now timestamptz;
  v_limit integer;
begin
  if p_kind not in ('tts', 'asr') or p_kind is null then
    raise exception 'Invalid speech kind';
  end if;
  v_limit := case when p_kind = 'tts' then 180 else 600 end;
  insert into public.tutor_speech_budget(kind) values (p_kind) on conflict do nothing;
  select requests into v_requests from public.tutor_speech_budget where kind = p_kind for update;
  v_now := clock_timestamp();
  select coalesce(array_agg(t), '{}'::timestamptz[]) into v_requests
    from unnest(v_requests) t where t > v_now - interval '60 seconds';
  if cardinality(v_requests) >= v_limit then return false; end if;
  update public.tutor_speech_budget set requests = array_append(v_requests, v_now) where kind = p_kind;
  return true;
end;
$$;
revoke all on function public.reserve_tutor_speech_request(text) from public, anon, authenticated;
grant execute on function public.reserve_tutor_speech_request(text) to service_role;
