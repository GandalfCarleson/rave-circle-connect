create or replace function public.get_group_members(p_group_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role public.app_role,
  status text,
  joined_at timestamptz,
  name text,
  avatar_url text
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    gm.id,
    gm.user_id,
    gm.role,
    gm.status,
    gm.joined_at,
    p.name,
    p.avatar_url
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  left join public.profiles p on p.user_id = gm.user_id
  where gm.group_id = p_group_id
    and gm.status = 'active'
    and (
      g.owner_id = auth.uid()
      or g.is_private = false
      or exists (
        select 1
        from public.group_members gm2
        where gm2.group_id = g.id
          and gm2.user_id = auth.uid()
      )
    );
$$;
