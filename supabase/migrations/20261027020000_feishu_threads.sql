-- Independent topics per target and website conversation/order. Existing messages stay untouched.
create table public.feishu_threads (
  target_id text not null references public.feishu_targets(target_id),
  subject_kind text not null check (subject_kind in ('conversation','order')),
  subject_id uuid not null,
  root_event_id uuid not null,
  root_message_id text check (length(root_message_id) between 1 and 128),
  created_at timestamptz not null default now(),
  primary key(target_id,subject_kind,subject_id)
);
alter table public.feishu_threads enable row level security;
revoke all on public.feishu_threads from public,anon,authenticated;
grant all on public.feishu_threads to service_role;

-- Queue ordering already serializes a subject. Lock and recheck the current lease before reserving a root.
create function public.feishu_prepare_thread(p_event uuid,p_target text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare subject uuid; kind text; topic public.feishu_threads;
begin
  perform 1 from public.feishu_deliveries d join public.feishu_targets t on t.target_id=d.target_id
    join public.feishu_events e on e.id=d.event_id
    left join public.support_messages m on m.id=e.support_message_id
    left join public.support_conversations c on c.id=m.conversation_id
    where d.event_id=p_event and d.target_id=p_target and d.lease_id=p_lease and d.lease_until>now()
      and d.delivered_at is null and t.enabled and e.kind=any(t.events) and coalesce(c.channel,'store')=any(t.channels)
    for update of d;
  if not found then raise exception 'Feishu thread lease unavailable'; end if;
  select case when e.support_message_id is not null then 'conversation' else 'order' end,
    coalesce(m.conversation_id,se.order_id) into kind,subject
    from public.feishu_events e left join public.support_messages m on m.id=e.support_message_id
    left join public.store_order_events se on se.id=e.order_event_id where e.id=p_event;
  if subject is null then raise exception 'Feishu thread source unavailable'; end if;
  insert into public.feishu_threads(target_id,subject_kind,subject_id,root_event_id)
    values(p_target,kind,subject,p_event) on conflict do nothing;
  select * into topic from public.feishu_threads
    where target_id=p_target and subject_kind=kind and subject_id=subject for update;
  if topic.root_message_id is null and topic.root_event_id<>p_event then raise exception 'Feishu thread root unavailable'; end if;
  -- Only the reserved first event may create a root. Retries of that event keep the create API + stable UUID.
  return jsonb_build_object('root_message_id',case when topic.root_event_id=p_event then null else topic.root_message_id end);
end $$;
revoke all on function public.feishu_prepare_thread(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.feishu_prepare_thread(uuid,text,uuid) to service_role;

-- Root registration, every support reply anchor, and delivery acknowledgement commit together.
create function public.feishu_finish_thread_delivery(p_event uuid,p_target text,p_lease uuid,p_message_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare topic public.feishu_threads; prepared jsonb;
begin
  if p_message_id is null or length(p_message_id) not between 1 and 128 then raise exception 'Invalid Feishu thread message'; end if;
  prepared:=public.feishu_prepare_thread(p_event,p_target,p_lease);
  select th.* into topic from public.feishu_threads th
    join public.feishu_events e on e.id=p_event
    left join public.support_messages m on m.id=e.support_message_id
    left join public.store_order_events se on se.id=e.order_event_id
    where th.target_id=p_target and th.subject_kind=case when e.support_message_id is not null then 'conversation' else 'order' end
      and th.subject_id=coalesce(m.conversation_id,se.order_id) for update of th;
  if topic.root_event_id=p_event then
    if topic.root_message_id is not null and topic.root_message_id<>p_message_id then raise exception 'Feishu thread root mismatch'; end if;
    update public.feishu_threads set root_message_id=p_message_id
      where target_id=p_target and subject_kind=topic.subject_kind and subject_id=topic.subject_id;
  elsif topic.root_message_id=p_message_id then raise exception 'Feishu thread reply mismatch';
  end if;
  if topic.subject_kind='conversation' and not public.feishu_record_anchor(p_event,p_target,p_lease,p_message_id) then
    raise exception 'Feishu thread anchor unavailable';
  end if;
  if not public.feishu_complete_delivery(p_event,p_target,p_lease,true) then raise exception 'Feishu thread lease unavailable'; end if;
  return true;
end $$;
revoke all on function public.feishu_finish_thread_delivery(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.feishu_finish_thread_delivery(uuid,text,uuid,text) to service_role;
