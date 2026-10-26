-- Keep previous messages and read positions in platform support; new store conversations are independent.
-- Coordinate application rollout: pre-channel clients upserted on user_id and cannot serve this schema.
alter table public.support_conversations
  add column channel text not null default 'platform' check (channel in ('platform','store'));
alter table public.support_conversations drop constraint support_conversations_user_id_key;
alter table public.support_conversations add constraint support_conversations_user_channel_key unique(user_id,channel);
create index support_conversations_channel_inbox on public.support_conversations(channel,updated_at desc,id);

create function public.support_ensure_conversation(p_user uuid,p_channel text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.support_conversations;
begin
  if p_channel is null or p_channel not in ('platform','store') then raise exception 'Invalid support channel'; end if;
  insert into public.support_conversations(user_id,channel) values(p_user,p_channel)
  on conflict(user_id,channel) do update set user_id=excluded.user_id returning * into c;
  return to_jsonb(c);
end $$;
revoke all on function public.support_ensure_conversation(uuid,text) from public,anon,authenticated;
grant execute on function public.support_ensure_conversation(uuid,text) to service_role;

create function public.support_user_unread(p_user uuid)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'platform',count(m.seq) filter(where c.channel='platform'),
    'store',count(m.seq) filter(where c.channel='store'))
  from public.support_conversations c left join public.support_messages m
    on m.conversation_id=c.id and m.sender_role='admin' and m.seq>c.user_read_seq
  where c.user_id=p_user;
$$;
revoke all on function public.support_user_unread(uuid) from public,anon,authenticated;
grant execute on function public.support_user_unread(uuid) to service_role;

create function public.support_inbox_channel(p_channel text,p_offset integer)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_channel is null or p_channel not in ('platform','store') then raise exception 'Invalid support channel'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('unreadCount',
      (select count(*) from public.support_messages m where m.conversation_id=c.id and m.sender_role='user' and m.seq>c.staff_read_seq)) order by c.updated_at desc,c.id),'[]'::jsonb)
    from (select * from public.support_conversations where channel=p_channel order by updated_at desc,id offset least(greatest(p_offset,0),100000) limit 50) c
  );
end $$;
revoke all on function public.support_inbox_channel(text,integer) from public,anon,authenticated;
grant execute on function public.support_inbox_channel(text,integer) to service_role;

-- Guard the write boundary even if a service-side caller forgets to validate the selected channel.
-- Only new inserts are checked so old mixed-context records remain readable and unchanged.
create function public.support_check_commerce_context()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.context ?| array['productId','productName','orderId','orderStatus']
    and not exists(select 1 from public.support_conversations c where c.id=new.conversation_id and c.channel='store') then
    raise exception 'Commerce context requires store support';
  end if;
  return new;
end $$;
revoke all on function public.support_check_commerce_context() from public,anon,authenticated;
create trigger support_messages_commerce_channel before insert on public.support_messages
  for each row execute function public.support_check_commerce_context();
