-- Live migration applied to Office-HQ's Supabase project on 2026-10-20.
-- Synchronized assignments and presence are private to the authenticated owner.
-- No service_role keys, public access, or third-party account permissions.
create table if not exists public.hq_device_sync_presence(
 owner_id uuid not null references auth.users(id) on delete cascade,
 device_id text not null check(length(device_id) between 8 and 100),
 device_type text not null check(device_type in ('mac','ios')),
 last_pull_at timestamptz not null default now(),
 last_push_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(owner_id,device_id)
);
alter table public.hq_device_sync_presence enable row level security;
revoke all on public.hq_device_sync_presence from anon;
grant select,insert,update,delete on public.hq_device_sync_presence to authenticated;
drop policy if exists "owner read device sync presence" on public.hq_device_sync_presence;
create policy "owner read device sync presence" on public.hq_device_sync_presence
 for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists "owner insert device sync presence" on public.hq_device_sync_presence;
create policy "owner insert device sync presence" on public.hq_device_sync_presence
 for insert to authenticated with check ((select auth.uid())=owner_id);
drop policy if exists "owner update device sync presence" on public.hq_device_sync_presence;
create policy "owner update device sync presence" on public.hq_device_sync_presence
 for update to authenticated using ((select auth.uid())=owner_id)
 with check ((select auth.uid())=owner_id);
drop policy if exists "owner delete device sync presence" on public.hq_device_sync_presence;
create policy "owner delete device sync presence" on public.hq_device_sync_presence
 for delete to authenticated using ((select auth.uid())=owner_id);

create table if not exists public.hq_device_synced_assignments(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 client_task_key text not null check(length(client_task_key) between 5 and 100),
 source_device_id text not null check(length(source_device_id) between 8 and 100),
 company_label text not null default 'Office HQ' check(length(company_label) between 1 and 150),
 employee_role text not null check(length(employee_role) between 1 and 100),
 employee_label text not null default '' check(length(employee_label)<=160),
 title text not null check(length(title) between 3 and 140),
 description text not null check(length(description) between 8 and 4000),
 owner_confirmed boolean not null default false,
 status text not null default 'queued' check(status in ('queued','in_progress','review','blocked','done')),
 draft text not null default '' check(length(draft)<=16000),
 worker_device_id text,
 note text not null default '' check(length(note)<=350),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,client_task_key)
);
create index if not exists hq_device_assignments_pending on
 public.hq_device_synced_assignments(owner_id,status,created_at);
alter table public.hq_device_synced_assignments enable row level security;
revoke all on public.hq_device_synced_assignments from anon;
grant select,insert,update on public.hq_device_synced_assignments to authenticated;
drop policy if exists "owner read synced assignments" on public.hq_device_synced_assignments;
create policy "owner read synced assignments" on public.hq_device_synced_assignments
 for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists "owner insert synced assignments" on public.hq_device_synced_assignments;
create policy "owner insert synced assignments" on public.hq_device_synced_assignments
 for insert to authenticated with check ((select auth.uid())=owner_id);
drop policy if exists "owner update synced assignments" on public.hq_device_synced_assignments;
create policy "owner update synced assignments" on public.hq_device_synced_assignments
 for update to authenticated using ((select auth.uid())=owner_id)
 with check ((select auth.uid())=owner_id);
