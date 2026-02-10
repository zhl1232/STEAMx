-- ============================================
-- 私信系统：messages 表
-- ============================================
-- 用户间 1v1 文本私信，用于协作沟通
-- ============================================

create table if not exists public.messages (
  id bigserial primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint no_self_message check (sender_id != receiver_id)
);

-- 索引：按发送方 + 时间、按接收方 + 时间，便于会话列表与对话查询
create index if not exists idx_messages_sender_created on public.messages(sender_id, created_at desc);
create index if not exists idx_messages_receiver_created on public.messages(receiver_id, created_at desc);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies: 仅参与者可读，仅发送方可写
drop policy if exists "Users can read own messages" on public.messages;
create policy "Users can read own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages as sender" on public.messages;
create policy "Users can send messages as sender"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- 不开放 update/delete（首版不支持撤回）
-- Grants
grant select, insert on table public.messages to authenticated;
grant select, insert, update, delete on table public.messages to service_role;

comment on table public.messages is '1v1 私信消息，用于用户协作沟通';
