-- Official support is deliberately independent from social messages and interaction eligibility.
create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved')),
  user_read_seq bigint not null default 0,
  staff_read_seq bigint not null default 0,
  last_message_seq bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index support_conversations_inbox on public.support_conversations(status, updated_at desc);
create table public.support_messages (
  seq bigint generated always as identity primary key,
  id uuid not null unique default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  sender_role text not null check (sender_role in ('user','admin')),
  client_id uuid not null,
  content text not null check (length(content) <= 2000),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(conversation_id, actor_id, client_id)
);
create index support_messages_conversation_seq on public.support_messages(conversation_id, seq desc);
create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  message_id uuid references public.support_messages(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);
create index support_attachments_message on public.support_attachments(message_id);
create index support_attachments_conversation on public.support_attachments(conversation_id);
create table public.support_notification_outbox (
  conversation_id uuid primary key references public.support_conversations(id) on delete cascade,
  message_seq bigint not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now() + interval '30 seconds',
  lease_id uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
create index support_outbox_due on public.support_notification_outbox(available_at) where delivered_at is null;
-- Read APIs authorize explicitly using the session identity; no browser has direct table access.
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_notification_outbox enable row level security;
revoke all on public.support_conversations, public.support_messages, public.support_attachments, public.support_notification_outbox from anon, authenticated;
grant all on public.support_conversations, public.support_messages, public.support_attachments, public.support_notification_outbox to service_role;
grant usage, select on sequence public.support_messages_seq_seq to service_role;

create function public.support_send_message(p_conversation uuid, p_actor uuid, p_role text, p_client uuid, p_content text, p_context jsonb, p_attachments uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.support_conversations; m public.support_messages; attachment_count integer;
begin
  select * into c from public.support_conversations where id=p_conversation for update;
  if not found then raise exception 'Conversation unavailable'; end if;
  if (p_role='user' and c.user_id<>p_actor) or (p_role='admin' and not exists(select 1 from public.profiles where id=p_actor and role='admin')) or p_role not in ('user','admin') then
    raise exception 'Permission denied';
  end if;
  select * into m from public.support_messages where conversation_id=p_conversation and actor_id=p_actor and client_id=p_client;
  if found then return to_jsonb(m); end if;
  if length(trim(p_content))=0 and cardinality(p_attachments)=0 then raise exception 'Empty message'; end if;
  if cardinality(p_attachments)>3 then raise exception 'Too many attachments'; end if;
  select count(*) into attachment_count from public.support_attachments where id=any(p_attachments) and conversation_id=p_conversation and uploader_id=p_actor and message_id is null;
  if attachment_count<>cardinality(p_attachments) then raise exception 'Invalid attachments'; end if;
  insert into public.support_messages(conversation_id,actor_id,sender_role,client_id,content,context)
    values(p_conversation,p_actor,p_role,p_client,p_content,p_context) returning * into m;
  update public.support_attachments set message_id=m.id where id=any(p_attachments);
  update public.support_conversations set status='open', last_message_seq=m.seq, updated_at=now() where id=p_conversation;
  if p_role='user' then
    insert into public.support_notification_outbox(conversation_id,message_seq) values(p_conversation,m.seq)
    on conflict(conversation_id) do update set message_seq=m.seq, delivered_at=null, attempts=0, last_error=null,
      available_at=case when support_notification_outbox.delivered_at is null then support_notification_outbox.available_at else now()+interval '30 seconds' end, updated_at=now();
  end if;
  return to_jsonb(m);
end $$;
revoke all on function public.support_send_message(uuid,uuid,text,uuid,text,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.support_send_message(uuid,uuid,text,uuid,text,jsonb,uuid[]) to service_role;

create function public.support_claim_notifications(p_limit integer)
returns setof public.support_notification_outbox language sql security definer set search_path=public as $$
  update public.support_notification_outbox o set lease_id=gen_random_uuid(), lease_until=now()+interval '60 seconds', attempts=o.attempts+1
  where o.conversation_id in (select conversation_id from public.support_notification_outbox where delivered_at is null and available_at<=now() and (lease_until is null or lease_until<now()) order by available_at for update skip locked limit least(greatest(p_limit,1),20)) returning o.*;
$$;
revoke all on function public.support_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.support_claim_notifications(integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('support-private','support-private',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive denial also protects this bucket from unrelated permissive global storage policies.
create policy support_private_server_only on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'support-private') with check (bucket_id <> 'support-private');

-- Aggregate the inbox on the server rather than sending a count request per conversation.
create function public.support_inbox(p_offset integer)
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('unreadCount',
    (select count(*) from public.support_messages m where m.conversation_id=c.id and m.sender_role='user' and m.seq>c.staff_read_seq)) order by c.updated_at desc,c.id),'[]'::jsonb)
  from (select * from public.support_conversations order by updated_at desc,id offset least(greatest(p_offset,0),100000) limit 50) c;
$$;
revoke all on function public.support_inbox(integer) from public,anon,authenticated;
grant execute on function public.support_inbox(integer) to service_role;
