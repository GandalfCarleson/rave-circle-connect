create table if not exists public.crew_event_pins (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (crew_id, event_id, user_id)
);

create table if not exists public.crew_events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique (crew_id, event_id)
);

alter table public.crew_event_pins enable row level security;
alter table public.crew_events enable row level security;

drop policy if exists "Crew members can view crew event pins" on public.crew_event_pins;
create policy "Crew members can view crew event pins"
on public.crew_event_pins
for select
using (
  exists (
    select 1
    from public.group_members
    where group_id = crew_event_pins.crew_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Crew members can pin events" on public.crew_event_pins;
create policy "Crew members can pin events"
on public.crew_event_pins
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_members
    where group_id = crew_event_pins.crew_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Crew members can unpin events" on public.crew_event_pins;
create policy "Crew members can unpin events"
on public.crew_event_pins
for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_members
    where group_id = crew_event_pins.crew_id
      and user_id = auth.uid()
  )
);

drop policy if exists "Crew members can view crew events" on public.crew_events;
create policy "Crew members can view crew events"
on public.crew_events
for select
using (
  exists (
    select 1
    from public.group_members
    where group_id = crew_events.crew_id
      and user_id = auth.uid()
  )
);

create or replace function public.handle_crew_event_pin()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  member_count integer;
  required_pins integer;
  current_pins integer;
begin
  select count(*) into member_count
  from public.group_members
  where group_id = new.crew_id;

  required_pins := greatest(1, ceil(member_count * 0.6::numeric));

  select count(*) into current_pins
  from public.crew_event_pins
  where crew_id = new.crew_id
    and event_id = new.event_id;

  if current_pins >= required_pins then
    insert into public.crew_events (crew_id, event_id, created_by)
    values (new.crew_id, new.event_id, new.user_id)
    on conflict (crew_id, event_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists crew_event_pins_insert_trigger on public.crew_event_pins;
create trigger crew_event_pins_insert_trigger
after insert on public.crew_event_pins
for each row execute function public.handle_crew_event_pin();
