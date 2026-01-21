alter table public.groups enable row level security;

drop policy if exists "Members can view groups" on public.groups;
create policy "Members can view groups"
on public.groups
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = id
      and gm.user_id = auth.uid()
  )
);
