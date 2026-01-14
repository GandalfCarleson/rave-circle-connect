do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_type') then
    create type public.message_type as enum ('text', 'event', 'system');
  end if;
end $$;

alter table public.messages
  add column if not exists message_type public.message_type default 'text',
  add column if not exists edited_at timestamptz,
  add column if not exists retracted_at timestamptz,
  add column if not exists retracted_by uuid references auth.users(id) on delete set null,
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create index if not exists messages_group_created_idx on public.messages (group_id, created_at desc);
create index if not exists messages_reply_to_idx on public.messages (reply_to_message_id);

alter table public.messages enable row level security;

drop policy if exists "Group members can update own messages" on public.messages;
create policy "Group members can update own messages"
on public.messages
for update
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.group_members
    where group_id = messages.group_id
      and user_id = auth.uid()
  )
);

create table if not exists public.group_reads (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz default now(),
  unique (group_id, user_id)
);

alter table public.group_reads enable row level security;

drop policy if exists "Group members can view read receipts" on public.group_reads;
create policy "Group members can view read receipts"
on public.group_reads
for select
using (
  exists (
    select 1 from public.group_members
    where group_id = group_reads.group_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Users can update own read receipts" on public.group_reads;
create policy "Users can update own read receipts"
on public.group_reads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
