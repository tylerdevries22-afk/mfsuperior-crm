alter table public.vehicles
  add column if not exists thumbnail_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-thumbnails',
  'vehicle-thumbnails',
  true,
  10485760,
  array['image/heic', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit,
  name = excluded.name,
  public = excluded.public;

create table if not exists public.vehicle_transfer_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_driver_id uuid references public.drivers(id) on delete set null,
  target_driver_id uuid not null references public.drivers(id) on delete cascade,
  target_auth_subject text not null,
  requested_by_user_id uuid not null references public.users(id) on delete cascade,
  vehicle_unit_number varchar(40) not null,
  from_driver_name varchar(200),
  target_driver_name varchar(200) not null,
  note varchar(1000) not null default '',
  created_at timestamptz not null default now()
);

create index if not exists vehicle_transfer_events_target_created_idx
  on public.vehicle_transfer_events(target_driver_id, created_at);
create index if not exists vehicle_transfer_events_org_created_idx
  on public.vehicle_transfer_events(organization_id, created_at);

alter table public.vehicle_transfer_events enable row level security;
revoke all on public.vehicle_transfer_events from anon;
grant select on public.vehicle_transfer_events to authenticated;
drop policy if exists "Drivers can read their own vehicle transfers" on public.vehicle_transfer_events;
create policy "Drivers can read their own vehicle transfers"
  on public.vehicle_transfer_events
  for select
  to authenticated
  using (target_auth_subject = (select auth.uid()::text));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicle_transfer_events'
  ) then
    alter publication supabase_realtime add table public.vehicle_transfer_events;
  end if;
end
$$;

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token varchar(255) not null,
  platform varchar(20) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_tokens_platform_check check (platform in ('ios', 'android')),
  constraint mobile_push_tokens_user_token_unique unique (organization_id, user_id, expo_push_token)
);

create index if not exists mobile_push_tokens_user_idx
  on public.mobile_push_tokens(organization_id, user_id);
alter table public.mobile_push_tokens enable row level security;
revoke all on public.mobile_push_tokens from anon, authenticated;
