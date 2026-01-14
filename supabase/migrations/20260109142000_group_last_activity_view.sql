create or replace view public.group_last_activity as
with last_message as (
  select
    m.group_id,
    m.id as message_id,
    m.created_at,
    m.text,
    m.attached_event_id,
    m.user_id,
    m.retracted_at,
    p.name as sender_name,
    e.name as event_name
  from public.messages m
  left join public.profiles p on p.user_id = m.user_id
  left join public.events e on e.id = m.attached_event_id
),
ranked_messages as (
  select *,
    row_number() over (partition by group_id order by created_at desc) as rn
  from last_message
),
last_reaction as (
  select
    mr.message_id,
    mr.emoji,
    mr.created_at,
    m.group_id
  from public.message_reactions mr
  join public.messages m on m.id = mr.message_id
),
ranked_reactions as (
  select *,
    row_number() over (partition by group_id order by created_at desc) as rn
  from last_reaction
)
select
  g.id as group_id,
  case
    when rm.rn = 1 and (rr.rn is null or rm.created_at >= rr.created_at) then rm.created_at
    when rr.rn = 1 then rr.created_at
    else null
  end as last_activity_at,
  case
    when rm.rn = 1 and (rr.rn is null or rm.created_at >= rr.created_at) then
      case
        when rm.retracted_at is not null then 'system'
        when rm.attached_event_id is not null then 'event'
        when rm.text is not null and length(btrim(rm.text)) > 0 then 'text'
        else 'attachment'
      end
    when rr.rn = 1 then 'reaction'
    else null
  end as last_activity_type,
  case
    when rm.rn = 1 and (rr.rn is null or rm.created_at >= rr.created_at) then
      case
        when rm.retracted_at is not null then 'Message retracted'
        when rm.attached_event_id is not null then
          coalesce('Shared an event: ' || rm.event_name, 'Shared an event')
        when rm.text is not null and length(btrim(rm.text)) > 0 then
          coalesce(rm.sender_name || ': ', '') || rm.text
        else '📎 Attachment'
      end
    when rr.rn = 1 then
      coalesce(rr.emoji, '') || ' Reacted to a message'
    else null
  end as last_activity_preview
from public.groups g
left join (select * from ranked_messages where rn = 1) rm on rm.group_id = g.id
left join (select * from ranked_reactions where rn = 1) rr on rr.group_id = g.id;
