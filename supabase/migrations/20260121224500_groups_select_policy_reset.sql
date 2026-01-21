alter table public.groups enable row level security;

drop policy if exists "Users can view groups they are members of or public groups" on public.groups;
drop policy if exists "Members can view groups" on public.groups;
drop policy if exists "Groups visible to members or public" on public.groups;

create policy "Groups visible to members or public"
on public.groups
for select
using (
  not is_private
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = id
      and gm.user_id = auth.uid()
  )
);
