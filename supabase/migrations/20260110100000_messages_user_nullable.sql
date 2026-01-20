do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'user_id'
  ) then
    alter table public.messages
      alter column user_id drop not null;
  end if;
end $$;

alter table public.messages
  drop constraint if exists messages_user_id_fkey;

alter table public.messages
  add constraint messages_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;
