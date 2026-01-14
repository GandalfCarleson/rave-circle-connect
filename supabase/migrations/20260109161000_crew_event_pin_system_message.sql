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
  inserted_event_id uuid;
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
    on conflict (crew_id, event_id) do nothing
    returning event_id into inserted_event_id;

    if inserted_event_id is not null then
      insert into public.messages (group_id, user_id, text, attached_event_id, message_type, created_at)
      values (new.crew_id, new.user_id, 'Event added to board', new.event_id, 'system', now());
    end if;
  end if;

  return new;
end;
$$;
