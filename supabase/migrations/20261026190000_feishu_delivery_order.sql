-- Preserve source order per recipient and conversation/order while independent streams run in parallel.
create or replace function public.feishu_claim_deliveries(p_limit integer)
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
      left join public.store_order_events se on se.id=e.order_event_id
      where d.delivered_at is null and d.available_at<=now() and (d.lease_until is null or d.lease_until<now())
        and t.enabled and e.kind=any(t.events) and coalesce(c.channel,'store')=any(t.channels)
        -- A leased or delayed earlier message still owns the queue head for this group and conversation.
        -- Include unexpanded source events: another worker may hold their expansion lock.
        and not exists (
          select 1 from public.support_messages previous_message
          join public.feishu_events previous_event on previous_event.support_message_id=previous_message.id
          left join public.feishu_deliveries previous_delivery on previous_delivery.event_id=previous_event.id and previous_delivery.target_id=t.target_id
          where m.id is not null and previous_message.conversation_id=m.conversation_id and previous_message.seq<m.seq
            and previous_event.kind=any(t.events)
            and not exists(select 1 from public.feishu_reply_origins origin where origin.support_message_id=previous_message.id and origin.target_id=t.target_id)
            and (previous_event.expanded_at is null or (previous_delivery.event_id is not null and previous_delivery.delivered_at is null))
        )
        and not exists (
          select 1 from public.store_order_events previous_order_event
          join public.feishu_events previous_event on previous_event.order_event_id=previous_order_event.id
          left join public.feishu_deliveries previous_delivery on previous_delivery.event_id=previous_event.id and previous_delivery.target_id=t.target_id
          where se.id is not null and previous_order_event.order_id=se.order_id and previous_order_event.id<se.id
            and previous_event.kind=any(t.events)
            and (previous_event.expanded_at is null or (previous_delivery.event_id is not null and previous_delivery.delivered_at is null))
        )
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


-- Preserve the order accepted by the durable inbox for each known website conversation.
-- An unavailable or ambiguous anchor stays independent so it cannot block unrelated replies in its group.
create or replace function public.feishu_claim_inbound(p_limit integer)
returns jsonb language sql security definer set search_path=public as $$
  with resolved as materialized (
    select i.message_id,i.created_at,
      (select case when count(distinct (a.conversation_id,a.target_id))=1 and bool_and(a.chat_id=i.chat_id)
        then min(a.conversation_id::text)::uuid end
       from public.feishu_reply_anchors a where a.message_id in (i.parent_id,i.root_id)) as conversation_id
    from public.feishu_inbound i where i.completed_at is null and i.rejected_at is null
  ), due as (
    select i.message_id from public.feishu_inbound i join resolved r on r.message_id=i.message_id
    where i.completed_at is null and i.rejected_at is null and i.available_at<=now() and (i.lease_until is null or i.lease_until<now())
      and (r.conversation_id is null or not exists (
        select 1 from resolved previous where previous.conversation_id=r.conversation_id
          and (previous.created_at,previous.message_id)<(r.created_at,r.message_id)
      ))
    order by i.created_at,i.message_id for update of i skip locked limit least(greatest(p_limit,1),20)
  ), claimed as (
    update public.feishu_inbound i set lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds',attempts=i.attempts+1
      from due where i.message_id=due.message_id returning i.*
  ) select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from claimed c;
$$;
revoke all on function public.feishu_claim_inbound(integer) from public,anon,authenticated;
grant execute on function public.feishu_claim_inbound(integer) to service_role;

-- Recheck inbound ordering at write time when previously unknown anchors have become available.
create or replace function public.feishu_apply_reply(p_message_id text,p_chat_id text,p_actor uuid,p_parent_id text,p_root_id text,p_content text)
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
  select * into c from public.support_conversations where id=anchor.conversation_id for update;
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
  sent=public.support_send_message(c.id,p_actor,'admin',md5('feishu:'||p_message_id)::uuid,trim(p_content),'{}'::jsonb,'{}'::uuid[]);
  insert into public.feishu_reply_origins(message_id,support_message_id,target_id,actor_id) values(p_message_id,(sent->>'id')::uuid,anchor.target_id,p_actor);
  return jsonb_build_object('message_id',sent->>'id','conversation_id',c.id,'target_id',anchor.target_id,'duplicate',false);
end $$;
revoke all on function public.feishu_apply_reply(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.feishu_apply_reply(text,text,uuid,text,text,text) to service_role;
