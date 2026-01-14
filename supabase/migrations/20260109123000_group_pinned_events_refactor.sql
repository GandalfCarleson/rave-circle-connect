alter table public.group_pinned_events
  drop constraint if exists group_pinned_events_event_id_fkey;

alter table public.group_pinned_events
  alter column event_id type text using event_id::text;

alter table public.group_pinned_events
  drop constraint if exists group_pinned_events_group_id_event_id_key;

alter table public.group_pinned_events
  add column if not exists pinned_by uuid references auth.users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'group_pinned_events'
      and column_name = 'pinned_at'
  ) then
    alter table public.group_pinned_events rename column pinned_at to created_at;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'group_pinned_events'
      and column_name = 'created_at'
  ) then
    alter table public.group_pinned_events
      add column created_at timestamp with time zone default now();
  end if;
end $$;

alter table public.group_pinned_events
  alter column created_at set default now();

alter table public.group_pinned_events
  add constraint group_pinned_events_group_id_event_id_key unique (group_id, event_id);

drop policy if exists "Group members can view pinned events" on public.group_pinned_events;
create policy "Group members can view pinned events"
on public.group_pinned_events
for select
using (
  exists (
    select 1
    from public.group_members
    where group_id = group_pinned_events.group_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Group members can pin events" on public.group_pinned_events;
create policy "Group members can pin events"
on public.group_pinned_events
for insert
with check (
  exists (
    select 1
    from public.group_members
    where group_id = group_pinned_events.group_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Group members can unpin events" on public.group_pinned_events;
create policy "Group members can unpin events"
on public.group_pinned_events
for delete
using (
  exists (
    select 1
    from public.group_members
    where group_id = group_pinned_events.group_id
      and user_id = auth.uid()
  )
);
