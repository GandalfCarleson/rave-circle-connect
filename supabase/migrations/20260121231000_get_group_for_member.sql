create or replace function public.get_group_for_member(p_group_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  city text,
  is_private boolean,
  image_url text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    g.id,
    g.name,
    g.description,
    g.city,
    g.is_private,
    g.image_url,
    g.owner_id,
    g.created_at,
    g.updated_at
  from public.groups g
  where g.id = p_group_id
    and (
      g.owner_id = auth.uid()
      or exists (
        select 1
        from public.group_members gm
        where gm.group_id = g.id
          and gm.user_id = auth.uid()
      )
      or g.is_private = false
    );
$$;
