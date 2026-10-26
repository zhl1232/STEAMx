-- Durable service-only Feishu delivery and replies. Transport credentials remain in server configuration.
create table public.feishu_targets (
  target_id text primary key check (target_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  chat_id text not null check (length(chat_id) between 1 and 128),
  enabled boolean not null default true,
  channels text[] not null check (cardinality(channels)>0 and channels <@ array['platform','store']),
  events text[] not null check (cardinality(events)>0 and events <@ array['support.user_message','support.admin_message','order.created','order.paid','order.refund_requested','order.refunded']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.feishu_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('support.user_message','support.admin_message','order.created','order.paid','order.refund_requested','order.refunded')),
  support_message_id uuid unique references public.support_messages(id) on delete cascade,
  order_event_id bigint unique references public.store_order_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  expanded_at timestamptz,
  check ((kind like 'support.%' and support_message_id is not null and order_event_id is null) or (kind like 'order.%' and support_message_id is null and order_event_id is not null))
);
create index feishu_events_unexpanded on public.feishu_events(created_at,id) where expanded_at is null;
create table public.feishu_deliveries (
  event_id uuid not null references public.feishu_events(id) on delete cascade,
  target_id text not null references public.feishu_targets(target_id),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  last_error text,
  primary key(event_id,target_id)
);
create index feishu_deliveries_due on public.feishu_deliveries(available_at,event_id,target_id) where delivered_at is null;
create table public.feishu_reply_anchors (
  message_id text primary key check (length(message_id) between 1 and 128),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  target_id text not null references public.feishu_targets(target_id),
  chat_id text not null,
  event_id uuid not null references public.feishu_events(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index feishu_reply_anchors_conversation on public.feishu_reply_anchors(conversation_id,target_id);
create table public.feishu_reply_origins (
  message_id text primary key,
  support_message_id uuid not null unique references public.support_messages(id) on delete cascade,
  target_id text not null references public.feishu_targets(target_id),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index feishu_reply_origins_actor_time on public.feishu_reply_origins(actor_id,created_at);
create table public.feishu_inbound (
  message_id text primary key check (length(message_id) between 1 and 128),
  chat_id text not null check (length(chat_id) between 1 and 128),
  sender_open_id text not null check (length(sender_open_id) between 1 and 128),
  parent_id text check (length(parent_id) between 1 and 128),
  root_id text check (length(root_id) between 1 and 128),
  text text not null check (length(trim(text)) between 1 and 2000),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index feishu_inbound_due on public.feishu_inbound(available_at,message_id) where completed_at is null and rejected_at is null;

alter table public.feishu_targets enable row level security;
alter table public.feishu_events enable row level security;
alter table public.feishu_deliveries enable row level security;
alter table public.feishu_reply_anchors enable row level security;
alter table public.feishu_reply_origins enable row level security;
alter table public.feishu_inbound enable row level security;
revoke all on public.feishu_targets,public.feishu_events,public.feishu_deliveries,public.feishu_reply_anchors,public.feishu_reply_origins,public.feishu_inbound from public,anon,authenticated;
grant all on public.feishu_targets,public.feishu_events,public.feishu_deliveries,public.feishu_reply_anchors,public.feishu_reply_origins,public.feishu_inbound to service_role;

create function public.feishu_preserve_target_chat()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.chat_id is distinct from old.chat_id then raise exception 'Feishu target chat is immutable; use a new target ID'; end if;
  return new;
end $$;
revoke all on function public.feishu_preserve_target_chat() from public,anon,authenticated;
create trigger feishu_targets_preserve_chat before update on public.feishu_targets for each row execute function public.feishu_preserve_target_chat();

create function public.feishu_sync_targets(p_targets jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; ids text[]='{}'; channels_value text[]; events_value text[];
begin
  if jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets)>50 then raise exception 'Invalid Feishu targets'; end if;
  for item in select value from jsonb_array_elements(p_targets) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'target_id') is distinct from 'string'
      or jsonb_typeof(item->'chat_id') is distinct from 'string' or jsonb_typeof(item->'enabled') is distinct from 'boolean'
      or jsonb_typeof(item->'channels') is distinct from 'array' or jsonb_typeof(item->'events') is distinct from 'array'
      or (item->>'target_id')=any(ids) then raise exception 'Invalid Feishu target'; end if;
    select coalesce(array_agg(value),'{}') into channels_value from jsonb_array_elements_text(item->'channels');
    select coalesce(array_agg(value),'{}') into events_value from jsonb_array_elements_text(item->'events');
    insert into public.feishu_targets(target_id,chat_id,enabled,channels,events)
      values(item->>'target_id',item->>'chat_id',(item->>'enabled')::boolean,channels_value,events_value)
    on conflict(target_id) do update set chat_id=excluded.chat_id,enabled=excluded.enabled,channels=excluded.channels,events=excluded.events,updated_at=now();
    ids=array_append(ids,item->>'target_id');
  end loop;
  update public.feishu_targets set enabled=false,updated_at=now() where not(target_id=any(ids)) and enabled;
end $$;
revoke all on function public.feishu_sync_targets(jsonb) from public,anon,authenticated;
grant execute on function public.feishu_sync_targets(jsonb) to service_role;

create function public.feishu_enqueue_support_event()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.feishu_events(kind,support_message_id)
    values(case when new.sender_role='user' then 'support.user_message' else 'support.admin_message' end,new.id)
    on conflict(support_message_id) do nothing;
  return new;
end $$;
revoke all on function public.feishu_enqueue_support_event() from public,anon,authenticated;
create trigger support_messages_feishu_event after insert on public.support_messages for each row execute function public.feishu_enqueue_support_event();
create function public.feishu_enqueue_order_event()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.event_type in ('created','paid','refund_requested','refunded') then
    insert into public.feishu_events(kind,order_event_id) values('order.'||new.event_type,new.id) on conflict(order_event_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.feishu_enqueue_order_event() from public,anon,authenticated;
create trigger store_order_events_feishu_event after insert on public.store_order_events for each row execute function public.feishu_enqueue_order_event();

-- No content or amount snapshot: the sender reads the committed support message / final order separately.
create function public.feishu_claim_deliveries(p_limit integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source record; result jsonb;
begin
  -- Expand once when a matching recipient exists. Adding a group later does not replay expanded history.
  for source in
    select e.id,e.kind,coalesce(c.channel,'store') as channel,e.support_message_id
    from public.feishu_events e left join public.support_messages m on m.id=e.support_message_id
    left join public.support_conversations c on c.id=m.conversation_id
    where e.expanded_at is null and exists(select 1 from public.feishu_targets t
      where t.enabled and e.kind=any(t.events) and coalesce(c.channel,'store')=any(t.channels))
    order by e.created_at,e.id for update of e skip locked limit 200
  loop
    insert into public.feishu_deliveries(event_id,target_id)
      select source.id,t.target_id from public.feishu_targets t
      where t.enabled and source.kind=any(t.events) and source.channel=any(t.channels)
        and not exists(select 1 from public.feishu_reply_origins o where o.support_message_id=source.support_message_id and o.target_id=t.target_id)
      on conflict(event_id,target_id) do nothing;
    update public.feishu_events set expanded_at=now() where id=source.id;
  end loop;
  with due as (
      select d.event_id,d.target_id from public.feishu_deliveries d
      join public.feishu_events e on e.id=d.event_id join public.feishu_targets t on t.target_id=d.target_id
      left join public.support_messages m on m.id=e.support_message_id left join public.support_conversations c on c.id=m.conversation_id
      where d.delivered_at is null and d.available_at<=now() and (d.lease_until is null or d.lease_until<now())
        and t.enabled and e.kind=any(t.events) and coalesce(c.channel,'store')=any(t.channels)
      order by d.available_at,d.event_id,d.target_id for update of d skip locked limit least(greatest(p_limit,1),20)
    ), claimed as (
      update public.feishu_deliveries d set lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds',attempts=d.attempts+1
      from due where d.event_id=due.event_id and d.target_id=due.target_id returning d.*
    )
    select coalesce(jsonb_agg(jsonb_build_object('event_id',d.event_id,'target_id',d.target_id,'lease_id',d.lease_id,'attempts',d.attempts,
      'kind',e.kind,'support_message_id',e.support_message_id,'order_event_id',e.order_event_id,'chat_id',t.chat_id)),'[]'::jsonb) into result
    from claimed d join public.feishu_events e on e.id=d.event_id join public.feishu_targets t on t.target_id=d.target_id;
  return result;
end $$;
revoke all on function public.feishu_claim_deliveries(integer) from public,anon,authenticated;
grant execute on function public.feishu_claim_deliveries(integer) to service_role;

create function public.feishu_complete_delivery(p_event uuid,p_target text,p_lease uuid,p_success boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.feishu_deliveries set delivered_at=case when p_success then now() else null end,
    available_at=case when p_success then available_at else now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::double precision) end,
    lease_id=null,lease_until=null,last_error=case when p_success then null else 'delivery_failed' end
    where event_id=p_event and target_id=p_target and lease_id=p_lease and lease_until>now() and delivered_at is null;
  if not found then return false; end if;
  if p_success then
    -- Serialize completion of different recipients before deciding that this generation is delivered.
    -- Without this lock, concurrent completions can each see the other's uncommitted row as pending.
    perform 1 from public.feishu_events where id=p_event for update;
    update public.support_notification_outbox o set delivered_at=now(),lease_id=null,lease_until=null,last_error=null
      from public.feishu_events e join public.support_messages m on m.id=e.support_message_id
      where e.id=p_event and e.kind='support.user_message' and o.conversation_id=m.conversation_id and o.message_seq=m.seq
        and not exists(select 1 from public.feishu_deliveries d where d.event_id=p_event and d.delivered_at is null);
  end if;
  return true;
end $$;
revoke all on function public.feishu_complete_delivery(uuid,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.feishu_complete_delivery(uuid,text,uuid,boolean,text) to service_role;

create function public.feishu_record_anchor(p_event uuid,p_target text,p_lease uuid,p_message_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare c_id uuid; chat text;
begin
  select m.conversation_id,t.chat_id into c_id,chat from public.feishu_deliveries d
    join public.feishu_events e on e.id=d.event_id join public.support_messages m on m.id=e.support_message_id
    join public.feishu_targets t on t.target_id=d.target_id
    where d.event_id=p_event and d.target_id=p_target and d.lease_id=p_lease and d.lease_until>now() and d.delivered_at is null and t.enabled;
  if not found then return false; end if;
  insert into public.feishu_reply_anchors(message_id,conversation_id,target_id,chat_id,event_id)
    values(p_message_id,c_id,p_target,chat,p_event) on conflict(message_id) do nothing;
  if exists(select 1 from public.feishu_reply_anchors where message_id=p_message_id and (conversation_id<>c_id or target_id<>p_target or chat_id<>chat or event_id<>p_event)) then
    raise exception 'Feishu anchor mismatch';
  end if;
  return true;
end $$;
revoke all on function public.feishu_record_anchor(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.feishu_record_anchor(uuid,text,uuid,text) to service_role;

create function public.feishu_enqueue_inbound(p_message_id text,p_chat_id text,p_sender_open_id text,p_parent_id text,p_root_id text,p_text text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  insert into public.feishu_inbound(message_id,chat_id,sender_open_id,parent_id,root_id,text)
    values(p_message_id,p_chat_id,p_sender_open_id,nullif(p_parent_id,''),nullif(p_root_id,''),trim(p_text)) on conflict(message_id) do nothing;
  return found;
end $$;
revoke all on function public.feishu_enqueue_inbound(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.feishu_enqueue_inbound(text,text,text,text,text,text) to service_role;
create function public.feishu_claim_inbound(p_limit integer)
returns jsonb language sql security definer set search_path=public as $$
  with due as (
    select message_id from public.feishu_inbound where completed_at is null and rejected_at is null and available_at<=now()
      and (lease_until is null or lease_until<now()) order by available_at,message_id for update skip locked limit least(greatest(p_limit,1),20)
  ), claimed as (
    update public.feishu_inbound i set lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds',attempts=i.attempts+1
      from due where i.message_id=due.message_id returning i.*
  ) select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from claimed c;
$$;
revoke all on function public.feishu_claim_inbound(integer) from public,anon,authenticated;
grant execute on function public.feishu_claim_inbound(integer) to service_role;
create function public.feishu_complete_inbound(p_message_id text,p_lease uuid,p_success boolean,p_error text default null,p_permanent boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.feishu_inbound set completed_at=case when p_success then now() else null end,
    rejected_at=case when not p_success and p_permanent then now() else null end,
    available_at=case when p_success or p_permanent then available_at else now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::double precision) end,
    lease_id=null,lease_until=null,last_error=case when p_success then null when p_permanent then 'reply_rejected' else 'reply_failed' end
    where message_id=p_message_id and lease_id=p_lease and lease_until>now() and completed_at is null and rejected_at is null;
  return found;
end $$;
revoke all on function public.feishu_complete_inbound(text,uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.feishu_complete_inbound(text,uuid,boolean,text,boolean) to service_role;

create function public.feishu_apply_reply(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text,p_content text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.feishu_reply_origins; anchor public.feishu_reply_anchors; c public.support_conversations; sent jsonb;
begin
  if p_message_id is null or length(p_message_id) not between 1 and 128 or p_chat_id is null or length(p_chat_id) not between 1 and 128
    or p_content is null or length(trim(p_content)) not between 1 and 2000 then raise exception 'Invalid Feishu reply'; end if;
  perform pg_advisory_xact_lock(hashtextextended('feishu-message:'||p_message_id,0));
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception 'Feishu reply administrator required'; end if;
  select * into anchor from public.feishu_reply_anchors where message_id in (p_parent_id,p_root_id) and chat_id=p_chat_id order by created_at limit 1;
  if not found then raise exception 'Feishu reply anchor unavailable'; end if;
  if exists(select 1 from public.feishu_reply_anchors where message_id in (p_parent_id,p_root_id) and (chat_id<>p_chat_id or conversation_id<>anchor.conversation_id or target_id<>anchor.target_id)) then
    raise exception 'Ambiguous Feishu reply anchor';
  end if;
  select * into c from public.support_conversations where id=anchor.conversation_id;
  perform 1 from public.feishu_targets t where t.target_id=anchor.target_id and t.chat_id=p_chat_id and t.enabled
    and c.channel=any(t.channels) and t.events && array['support.user_message','support.admin_message'] for share;
  if not found then raise exception 'Feishu reply target unavailable'; end if;
  select * into existing from public.feishu_reply_origins where message_id=p_message_id;
  if found then
    if existing.actor_id<>p_actor or existing.target_id<>anchor.target_id or not exists(select 1 from public.support_messages where id=existing.support_message_id and conversation_id=c.id) then
      raise exception 'Feishu duplicate reply identity mismatch';
    end if;
    return jsonb_build_object('message_id',existing.support_message_id,'conversation_id',c.id,'target_id',existing.target_id,'duplicate',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('feishu-actor:'||p_actor::text,0));
  if (select count(*) from public.feishu_reply_origins where actor_id=p_actor and created_at>now()-interval '1 minute')>=120 then raise exception 'Feishu reply rate limit'; end if;
  sent=public.support_send_message(c.id,p_actor,'admin',md5('feishu:'||p_message_id)::uuid,trim(p_content),'{}'::jsonb,'{}'::uuid[]);
  insert into public.feishu_reply_origins(message_id,support_message_id,target_id,actor_id) values(p_message_id,(sent->>'id')::uuid,anchor.target_id,p_actor);
  return jsonb_build_object('message_id',sent->>'id','conversation_id',c.id,'target_id',anchor.target_id,'duplicate',false);
end $$;
revoke all on function public.feishu_apply_reply(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.feishu_apply_reply(text,text,uuid,text,text,text) to service_role;
