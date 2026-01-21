alter table public.messages
  add column if not exists is_retracted boolean default false,
  add column if not exists expires_at timestamptz;

create index if not exists messages_retracted_expiry_idx
  on public.messages (expires_at)
  where is_retracted = true;

create or replace function public.cleanup_retracted_messages(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  deleted_count integer;
begin
  delete from public.messages
  where ctid in (
    select ctid
    from public.messages
    where is_retracted = true
      and expires_at is not null
      and expires_at <= now()
    order by expires_at asc
    limit p_limit
  );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
