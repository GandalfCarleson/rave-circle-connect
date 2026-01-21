alter table public.group_members
  add column if not exists status text default 'active';

update public.group_members
set status = 'active'
where status is null;
