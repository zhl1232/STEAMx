-- Add media without changing the existing text RPC signatures or accepted queue payloads.
alter table public.feishu_inbound add column image_keys text[] not null default '{}'::text[];
alter table public.feishu_inbound drop constraint feishu_inbound_text_check;
-- A helper keeps array validation available to both the table constraint and enqueue RPC.
create function public.feishu_valid_image_keys(p_keys text[])
returns boolean language sql immutable set search_path=public as $$
  select p_keys is not null and cardinality(p_keys)<=3
    and not exists(select 1 from unnest(p_keys) k where k is null or k !~ '^img_[A-Za-z0-9_-]{1,240}$')
    and cardinality(p_keys)=(select count(distinct k) from unnest(p_keys) k);
$$;
revoke all on function public.feishu_valid_image_keys(text[]) from public,anon,authenticated;
grant execute on function public.feishu_valid_image_keys(text[]) to service_role;
alter table public.feishu_inbound add constraint feishu_inbound_content_check check (
  length(trim(text))<=2000 and (length(trim(text))>0 or cardinality(image_keys)>0)
  and public.feishu_valid_image_keys(image_keys));

create function public.feishu_enqueue_inbound_media(p_message_id text,p_chat_id text,p_sender_open_id text,p_parent_id text,p_root_id text,p_text text,p_image_keys text[])
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_text is null or length(trim(p_text))>2000 or not public.feishu_valid_image_keys(p_image_keys)
    or (length(trim(p_text))=0 and cardinality(p_image_keys)=0) then raise exception 'Invalid Feishu media content'; end if;
  insert into public.feishu_inbound(message_id,chat_id,sender_open_id,parent_id,root_id,text,image_keys)
    values(p_message_id,p_chat_id,p_sender_open_id,nullif(p_parent_id,''),nullif(p_root_id,''),trim(p_text),p_image_keys)
    on conflict(message_id) do nothing;
  return found;
end $$;
revoke all on function public.feishu_enqueue_inbound_media(text,text,text,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.feishu_enqueue_inbound_media(text,text,text,text,text,text,text[]) to service_role;

create table public.feishu_inbound_attachments (
  message_id text not null references public.feishu_inbound(message_id) on delete cascade,
  image_key text not null,
  attachment_id uuid not null unique references public.support_attachments(id),
  primary key(message_id,image_key)
);
alter table public.feishu_inbound_attachments enable row level security;
revoke all on public.feishu_inbound_attachments from public,anon,authenticated;
grant all on public.feishu_inbound_attachments to service_role;

-- Preflight also owns the transaction locks used by reservation and final application.
create function public.feishu_prepare_reply(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.feishu_reply_origins; anchor public.feishu_reply_anchors; c public.support_conversations; queued public.feishu_inbound;
begin
  if p_message_id is null or length(p_message_id) not between 1 and 128 or p_chat_id is null or length(p_chat_id) not between 1 and 128 then raise exception 'Invalid Feishu reply'; end if;
  perform pg_advisory_xact_lock(hashtextextended('feishu-message:'||p_message_id,0));
  perform 1 from public.profiles where id=p_actor and role='admin' for share;
  if not found then raise exception 'Feishu reply administrator required'; end if;
  select * into queued from public.feishu_inbound where message_id=p_message_id;
  if found and (queued.chat_id is distinct from p_chat_id or queued.parent_id is distinct from nullif(p_parent_id,'') or queued.root_id is distinct from nullif(p_root_id,'')) then
    raise exception 'Feishu queued reply identity mismatch';
  end if;
  select * into anchor from public.feishu_reply_anchors where message_id in (p_parent_id,p_root_id) and chat_id=p_chat_id order by created_at limit 1;
  if not found then raise exception 'Feishu reply anchor unavailable'; end if;
  if exists(select 1 from public.feishu_reply_anchors where message_id in (p_parent_id,p_root_id) and (chat_id<>p_chat_id or conversation_id<>anchor.conversation_id or target_id<>anchor.target_id)) then
    raise exception 'Ambiguous Feishu reply anchor';
  end if;
  select * into c from public.support_conversations where id=anchor.conversation_id for update;
  perform 1 from public.feishu_targets t where t.target_id=anchor.target_id and t.chat_id=p_chat_id and t.enabled
    and c.channel=any(t.channels) and t.events && array['support.user_message','support.admin_message'] for share;
  if not found then raise exception 'Feishu reply target unavailable'; end if;
  if exists(select 1 from public.feishu_inbound_attachments f join public.support_attachments a on a.id=f.attachment_id
    where f.message_id=p_message_id and (a.uploader_id is distinct from p_actor or a.conversation_id<>c.id)) then
    raise exception 'Feishu image attachment identity mismatch';
  end if;
  select * into existing from public.feishu_reply_origins where message_id=p_message_id;
  if found then
    if existing.actor_id is distinct from p_actor or existing.target_id<>anchor.target_id or not exists(select 1 from public.support_messages where id=existing.support_message_id and conversation_id=c.id) then
      raise exception 'Feishu duplicate reply identity mismatch';
    end if;
    return jsonb_build_object('message_id',existing.support_message_id,'conversation_id',c.id,'target_id',existing.target_id,'duplicate',true);
  end if;
  return jsonb_build_object('conversation_id',c.id,'target_id',anchor.target_id,'duplicate',false);
end $$;
revoke all on function public.feishu_prepare_reply(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.feishu_prepare_reply(text,text,uuid,text,text) to service_role;

create function public.feishu_prepare_image_attachment(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text,p_image_key text,p_mime_type text,p_size_bytes integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prepared jsonb; attachment public.support_attachments; attachment_id uuid; queued public.feishu_inbound;
begin
  prepared=public.feishu_prepare_reply(p_message_id,p_chat_id,p_actor,p_parent_id,p_root_id);
  select * into queued from public.feishu_inbound where message_id=p_message_id;
  if not found or p_image_key is null or not (p_image_key=any(queued.image_keys)) then raise exception 'Invalid Feishu queued image'; end if;
  if p_mime_type is null or p_mime_type not in ('image/png','image/jpeg','image/webp') or p_size_bytes is null or p_size_bytes not between 1 and 5242880 then raise exception 'Invalid Feishu image metadata'; end if;
  select a.* into attachment from public.feishu_inbound_attachments f join public.support_attachments a on a.id=f.attachment_id
    where f.message_id=p_message_id and f.image_key=p_image_key for update of a;
  if found then
    if attachment.conversation_id is distinct from (prepared->>'conversation_id')::uuid or attachment.uploader_id is distinct from p_actor
      or attachment.mime_type<>p_mime_type or attachment.size_bytes<>p_size_bytes
      or (attachment.message_id is not null and attachment.message_id is distinct from (prepared->>'message_id')::uuid) then
      raise exception 'Feishu image attachment identity or metadata mismatch';
    end if;
    return to_jsonb(attachment);
  end if;
  if (prepared->>'duplicate')::boolean then raise exception 'Feishu completed reply has no image mapping'; end if;
  attachment_id=gen_random_uuid();
  insert into public.support_attachments(id,conversation_id,uploader_id,storage_path,mime_type,size_bytes)
    values(attachment_id,(prepared->>'conversation_id')::uuid,p_actor,(prepared->>'conversation_id')||'/'||attachment_id::text,p_mime_type,p_size_bytes)
    returning * into attachment;
  insert into public.feishu_inbound_attachments(message_id,image_key,attachment_id) values(p_message_id,p_image_key,attachment.id);
  return to_jsonb(attachment);
end $$;
revoke all on function public.feishu_prepare_image_attachment(text,text,uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.feishu_prepare_image_attachment(text,text,uuid,text,text,text,text,integer) to service_role;

create function public.feishu_apply_reply_media(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text,p_content text,p_attachments uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare prepared jsonb; c public.support_conversations; sent jsonb; queued public.feishu_inbound; expected uuid[];
begin
  prepared=public.feishu_prepare_reply(p_message_id,p_chat_id,p_actor,p_parent_id,p_root_id);
  -- Committed retries return before requiring their already attached images to be unattached.
  if (prepared->>'duplicate')::boolean then return prepared; end if;
  if p_content is null or length(trim(p_content))>2000 or p_attachments is null or cardinality(p_attachments)>3
    or (length(trim(p_content))=0 and cardinality(p_attachments)=0) then raise exception 'Invalid Feishu reply'; end if;
  select * into queued from public.feishu_inbound where message_id=p_message_id;
  if found then
    select coalesce(array_agg(f.attachment_id order by k.ordinality),'{}'::uuid[]) into expected
      from unnest(queued.image_keys) with ordinality k(image_key,ordinality)
      join public.feishu_inbound_attachments f on f.message_id=p_message_id and f.image_key=k.image_key;
    if cardinality(expected)<>cardinality(queued.image_keys) or expected is distinct from p_attachments then
      raise exception 'Invalid Feishu image attachments';
    end if;
  elsif cardinality(p_attachments)>0 then raise exception 'Invalid Feishu image attachments'; end if;
  select * into c from public.support_conversations where id=(prepared->>'conversation_id')::uuid;
  -- Recheck after locking the website conversation: these jobs may have been claimed while their anchors were unavailable.
  -- A prior committed reply is already in website order even if its queue acknowledgement is still in flight.
  if exists (
    select 1 from public.feishu_inbound current_inbound join public.feishu_inbound previous on
      (previous.created_at,previous.message_id)<(current_inbound.created_at,current_inbound.message_id)
    where current_inbound.message_id=p_message_id and previous.completed_at is null and previous.rejected_at is null
      and not exists(select 1 from public.feishu_reply_origins origin where origin.message_id=previous.message_id)
      and c.id=(select case when count(distinct (a.conversation_id,a.target_id))=1 and bool_and(a.chat_id=previous.chat_id)
        then min(a.conversation_id::text)::uuid end
        from public.feishu_reply_anchors a where a.message_id in (previous.parent_id,previous.root_id))
  ) then raise exception 'Feishu reply waiting for prior message'; end if;
  perform pg_advisory_xact_lock(hashtextextended('feishu-actor:'||p_actor::text,0));
  if (select count(*) from public.feishu_reply_origins where actor_id=p_actor and created_at>now()-interval '1 minute')>=120 then raise exception 'Feishu reply rate limit'; end if;
  sent=public.support_send_message(c.id,p_actor,'admin',md5('feishu:'||p_message_id)::uuid,trim(p_content),'{}'::jsonb,p_attachments);
  insert into public.feishu_reply_origins(message_id,support_message_id,target_id,actor_id) values(p_message_id,(sent->>'id')::uuid,prepared->>'target_id',p_actor);
  return jsonb_build_object('message_id',sent->>'id','conversation_id',c.id,'target_id',prepared->>'target_id','duplicate',false);
end $$;
revoke all on function public.feishu_apply_reply_media(text,text,uuid,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.feishu_apply_reply_media(text,text,uuid,text,text,text,uuid[]) to service_role;

create or replace function public.feishu_apply_reply(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text,p_content text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_content is null or length(trim(p_content)) not between 1 and 2000 then raise exception 'Invalid Feishu reply'; end if;
  return public.feishu_apply_reply_media(p_message_id,p_chat_id,p_actor,p_parent_id,p_root_id,p_content,'{}'::uuid[]);
end $$;
revoke all on function public.feishu_apply_reply(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.feishu_apply_reply(text,text,uuid,text,text,text) to service_role;
