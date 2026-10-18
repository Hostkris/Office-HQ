-- Office HQ OAuth connection records. Secrets and OAuth state never exposed via PostgREST.
create table if not exists public.hq_connections (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 company_id uuid not null,
 provider text not null check(provider in ('gmail','calendar','drive','youtube','x','tiktok','etsy','shopify','facebook','instagram')),
 remote_id text not null check(length(remote_id) between 1 and 255),
 display_name text not null check(length(display_name) between 1 and 255),
 granted_scopes text[] not null default '{}',
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,company_id,provider,remote_id),
 foreign key(owner_id,company_id) references public.hq_companies(owner_id,id) on delete cascade
);
create table if not exists public.hq_oauth_pending (
 state_hash text primary key check(length(state_hash)=64),
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null,
 provider text not null,
 code_verifier text not null,
 shop text,
 requested_scopes text[] not null default '{}',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '10 minutes'),
 foreign key(owner_id,company_id) references public.hq_companies(owner_id,id) on delete cascade
);
create index if not exists hq_oauth_pending_expires_idx on public.hq_oauth_pending(expires_at);
create table if not exists public.hq_connection_secrets (
 connection_id uuid primary key references public.hq_connections(id) on delete cascade,
 ciphertext text not null,
 updated_at timestamptz not null default now()
);
alter table public.hq_connections enable row level security;
alter table public.hq_oauth_pending enable row level security;
alter table public.hq_connection_secrets enable row level security;
revoke all on public.hq_oauth_pending from public, anon, authenticated;
revoke all on public.hq_connection_secrets from public, anon, authenticated;
revoke all on public.hq_connections from public, anon, authenticated;
grant select on public.hq_connections to authenticated;
grant all on public.hq_connections, public.hq_connection_secrets, public.hq_oauth_pending to service_role;
drop policy if exists "owner can view own connection metadata" on public.hq_connections;
create policy "owner can view own connection metadata" on public.hq_connections
 for select to authenticated using (owner_id = (select auth.uid()));
comment on table public.hq_oauth_pending is 'Private ephemeral OAuth state. Only trusted edge function may access via service role.';
comment on table public.hq_connection_secrets is 'AES-GCM encrypted third-party credentials. Never client-readable. Service-role only.';
comment on table public.hq_connections is 'Publicly scoped metadata only. Never contains provider tokens.';