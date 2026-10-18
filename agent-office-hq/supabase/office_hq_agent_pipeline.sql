-- DRAFT / NOT DEPLOYED: owner-scoped metadata and durable work records for future real integrations.
-- Apply ONLY after reviewing and testing in a private Supabase staging environment.
-- Does not create or store provider secrets, perform OAuth, grant outside access, run agents,
-- send messages, post content, move money or change external systems.
-- Depends on the applied office_hq_cloud_foundation migration.
begin;

create table if not exists public.hq_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  provider text not null check (provider in
    ('gmail','icloud','x','instagram','shopify','etsy','tiktok','lemonade','chime','facebook','youtube')),
  public_label text not null check (char_length(trim(public_label)) between 1 and 120),
  provider_account_id text check (provider_account_id is null or char_length(provider_account_id) <= 240),
  connection_state text not null default 'not_connected'
    check (connection_state in ('not_connected','pending','connected','expired','revoked','unavailable')),
  capabilities text[] not null default '{}',
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint provider_account_company_fk foreign key (owner_id,company_id)
    references public.hq_companies(owner_id,id) on delete cascade,
  constraint provider_account_compound_key unique (owner_id,company_id,id),
  constraint provider_verified_state check (connection_state <> 'connected' or
    (provider_account_id is not null and verified_at is not null))
);
create index if not exists hq_provider_accounts_by_company
  on public.hq_provider_accounts(owner_id,company_id,provider);

create table if not exists public.hq_worker_account_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  provider_account_id uuid not null,
  worker_role_key text not null check (char_length(worker_role_key) between 1 and 110),
  allowed_actions text[] not null default '{}'
    check (cardinality(allowed_actions) > 0
      and allowed_actions <@ array['read','draft','send','publish','manage_inventory','manage_orders','respond_to_customers']::text[]),
  active boolean not null default false,
  expires_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint worker_grant_account_company_fk foreign key (owner_id,company_id,provider_account_id)
    references public.hq_provider_accounts(owner_id,company_id,id) on delete cascade,
  constraint worker_grant_company_fk foreign key (owner_id,company_id)
    references public.hq_companies(owner_id,id) on delete cascade,
  unique (owner_id,company_id,provider_account_id,worker_role_key),
  unique (owner_id,company_id,provider_account_id,id)
);
create index if not exists hq_worker_grants_by_company
  on public.hq_worker_account_grants(owner_id,company_id,active);

create table if not exists public.hq_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  provider_account_id uuid not null,
  grant_id uuid not null,
  worker_role_key text not null check (char_length(worker_role_key) between 1 and 110),
  action text not null check (char_length(action) between 1 and 100),
  request_reference text not null check (char_length(request_reference) between 1 and 180),
  risk_class text not null default 'read_only'
    check (risk_class in ('read_only','draft','outbound_message','publish','commerce','financial')),
  status text not null default 'queued'
    check (status in ('queued','awaiting_authorization','awaiting_approval','running','succeeded','failed','cancelled')),
  approval_state text not null default 'required'
    check (approval_state in ('not_required','required','approved','rejected')),
  approved_at timestamptz,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  provider_operation_id text,
  redacted_summary text not null default '' check (char_length(redacted_summary) <= 1600),
  error_summary text check (error_summary is null or char_length(error_summary) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hq_agent_jobs_company_fk foreign key (owner_id,company_id,provider_account_id)
    references public.hq_provider_accounts(owner_id,company_id,id) on delete restrict,
  constraint hq_agent_jobs_grant_company_fk foreign key (owner_id,company_id,provider_account_id,grant_id)
    references public.hq_worker_account_grants(owner_id,company_id,provider_account_id,id) on delete restrict,
  constraint hq_agent_jobs_company_owner_fk foreign key (owner_id,company_id)
    references public.hq_companies(owner_id,id) on delete cascade,
  constraint hq_agent_jobs_idempotency unique (owner_id,company_id,request_reference),
  constraint hq_agent_jobs_compound_key unique (owner_id,company_id,id)
);
create index if not exists hq_agent_jobs_company_status
  on public.hq_agent_jobs(owner_id,company_id,status,created_at desc);

create table if not exists public.hq_agent_job_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  job_id uuid not null,
  step_status text not null check (step_status in ('queued','checking','waiting','running','succeeded','failed','blocked')),
  detail_redacted text not null check (char_length(detail_redacted) between 1 and 1200),
  recorded_at timestamptz not null default now(),
  constraint hq_agent_event_company_fk foreign key (owner_id,company_id,job_id)
    references public.hq_agent_jobs(owner_id,company_id,id) on delete cascade
);
create index if not exists hq_agent_events_by_job on public.hq_agent_job_events(job_id,recorded_at desc);

-- Revoke default exposure: signed-in owners can VIEW their own records.
-- Mutations require a separately deployed server function that validates real OAuth tokens,
-- role grants, company tenancy, and per-action CEO approval, using server-side credentials.
-- NEVER embed service-role credentials in Office HQ static assets.
alter table public.hq_provider_accounts enable row level security;
alter table public.hq_worker_account_grants enable row level security;
alter table public.hq_agent_jobs enable row level security;
alter table public.hq_agent_job_events enable row level security;

create policy hq_provider_accounts_owner_read on public.hq_provider_accounts
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_worker_account_grants_owner_read on public.hq_worker_account_grants
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_agent_jobs_owner_read on public.hq_agent_jobs
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_agent_job_events_owner_read on public.hq_agent_job_events
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.hq_provider_accounts,public.hq_worker_account_grants,
  public.hq_agent_jobs,public.hq_agent_job_events from PUBLIC,anon,authenticated;
grant select on public.hq_provider_accounts,public.hq_worker_account_grants,
  public.hq_agent_jobs,public.hq_agent_job_events to authenticated;

commit;
