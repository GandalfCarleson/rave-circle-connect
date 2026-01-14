create or replace function public.invite_user_to_group(p_group_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  target_user_id uuid;
  requester_role public.app_role;
begin
  if requester_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into requester_role
  from public.group_members
  where group_id = p_group_id
    and user_id = requester_id;

  if requester_role is null then
    if not exists (
      select 1 from public.groups
      where id = p_group_id
        and owner_id = requester_id
    ) then
      raise exception 'Not authorized';
    end if;
  elsif requester_role not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;

  select user_id into target_user_id
  from public.profiles
  where lower(username) = lower(p_username)
  limit 1;

  if target_user_id is null then
    raise exception 'User not found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (p_group_id, target_user_id, 'member')
  on conflict (group_id, user_id) do nothing;
end;
$$;
