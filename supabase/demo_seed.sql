-- RaveCircle expo demo seed.
-- Run this in Supabase SQL Editor after creating/signing in at least two demo auth users.
-- Replace demo_owner and demo_friend with real auth.users.id values from Authentication > Users.

do $$
declare
  demo_owner uuid := '00000000-0000-0000-0000-000000000001';
  demo_friend uuid := '00000000-0000-0000-0000-000000000002';
  demo_crew uuid := '10000000-0000-0000-0000-000000000001';
  demo_event uuid := '20000000-0000-0000-0000-000000000001';
  demo_message_text uuid := '30000000-0000-0000-0000-000000000001';
  demo_message_event uuid := '30000000-0000-0000-0000-000000000002';
begin
  insert into public.profiles (
    user_id, email, name, username, city, latitude, longitude, radius_km, is_discoverable, show_events_on_profile
  ) values
    (demo_owner, 'demo-owner@ravecircle.local', 'Alex Demo', 'alex_demo', 'Malmö', 55.6050, 13.0038, 100, true, true),
    (demo_friend, 'demo-friend@ravecircle.local', 'Sam Demo', 'sam_demo', 'Malmö', 55.6050, 13.0038, 100, true, true)
  on conflict (user_id) do update set
    name = excluded.name,
    username = excluded.username,
    city = excluded.city,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    radius_km = excluded.radius_km;

  delete from public.user_preferences where user_id in (demo_owner, demo_friend);
  insert into public.user_preferences (user_id, genre, intensity) values
    (demo_owner, 'Techno', 3),
    (demo_owner, 'House', 3),
    (demo_friend, 'Techno', 3),
    (demo_friend, 'Electronic', 3);

  insert into public.groups (id, name, description, city, is_private, owner_id)
  values (
    demo_crew,
    'Malmö Warehouse Crew',
    'Demo crew for planning one night out from discovery to final plan.',
    'Malmö',
    false,
    demo_owner
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    city = excluded.city,
    is_private = excluded.is_private,
    owner_id = excluded.owner_id;

  insert into public.group_members (group_id, user_id, role, status) values
    (demo_crew, demo_owner, 'owner', 'active'),
    (demo_crew, demo_friend, 'member', 'active')
  on conflict do nothing;

  insert into public.events (
    id, external_id, source, name, description, city, venue_name, start_datetime, end_datetime,
    min_price, ticket_url, image_url, event_type, genres, latitude, longitude
  ) values (
    demo_event,
    'demo_malmo_warehouse_night',
    'demo',
    'Malmö Warehouse Night',
    'A demo-ready electronic event used to show discovery, sharing, voting, and crew planning.',
    'Malmö',
    'Inkonst',
    now() + interval '9 days',
    now() + interval '9 days 5 hours',
    0,
    'https://ravecircle.local/demo-ticket',
    null,
    'rave',
    array['Techno', 'House'],
    55.5960,
    13.0000
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    start_datetime = excluded.start_datetime,
    end_datetime = excluded.end_datetime,
    min_price = excluded.min_price,
    genres = excluded.genres;

  insert into public.messages (id, group_id, user_id, text, message_type, created_at) values
    (demo_message_text, demo_crew, demo_owner, 'Found a good option for next weekend. Sharing it here so we can vote.', 'text', now() - interval '10 minutes')
  on conflict (id) do update set text = excluded.text;

  insert into public.messages (id, group_id, user_id, text, attached_event_id, message_type, created_at) values
    (demo_message_event, demo_crew, demo_owner, null, demo_event, 'event', now() - interval '8 minutes')
  on conflict (id) do update set attached_event_id = excluded.attached_event_id;

  insert into public.crew_event_pins (crew_id, event_id, user_id) values
    (demo_crew, demo_event, demo_owner),
    (demo_crew, demo_event, demo_friend)
  on conflict do nothing;

  insert into public.crew_events (crew_id, event_id, created_by) values
    (demo_crew, demo_event, demo_owner)
  on conflict do nothing;
end $$;
