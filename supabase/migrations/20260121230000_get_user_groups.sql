create or replace function public.get_user_groups()
returns table (
  id uuid,
  name text,
  city text,
  is_private boolean,
  image_url text,
  owner_id uuid,
  role public.app_role,
  created_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    g.id,
    g.name,
    g.city,
    g.is_private,
    g.image_url,
    g.owner_id,
    gm.role,
    g.created_at
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id = auth.uid();
$$;
