-- The application accesses tenant data exclusively through server-side database
-- connections. Deny direct PostgREST access by default, then reopen the one
-- recipient-filtered Realtime stream used by the mobile app.
do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_record.schemaname,
      table_record.tablename
    );
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      table_record.schemaname,
      table_record.tablename
    );
  end loop;
end
$$;

revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant select on public.vehicle_transfer_events to authenticated;

-- Vehicle images contain fleet-specific identifiers and must never be public.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/heic', 'image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'vehicle-thumbnails';

-- One physical Expo token must belong to only the most recently registered
-- account. Keeping a token active for two users can leak operational alerts
-- across organizations after a shared device changes hands.
delete from public.mobile_push_tokens older
using public.mobile_push_tokens newer
where older.expo_push_token = newer.expo_push_token
  and (
    older.updated_at < newer.updated_at
    or (older.updated_at = newer.updated_at and older.id < newer.id)
  );

alter table public.mobile_push_tokens
  drop constraint if exists mobile_push_tokens_user_token_unique;
drop index if exists public.mobile_push_tokens_user_token_unique;
create unique index if not exists mobile_push_tokens_token_unique
  on public.mobile_push_tokens(expo_push_token);
