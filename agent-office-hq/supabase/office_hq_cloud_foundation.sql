-- Applied to Office-HQ Supabase as migration office_hq_cloud_foundation.
-- Reproducible fresh-project schema. Do not rerun against an existing project.
create table public.hq_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  industry text not null default 'General business' check (char_length(industry) <= 100),
  created_at timestamptz not null default now(),
  unique (owner_id, id)
);
create table public.hq_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  role_scope text not null default 'operations' check (char_length(role_scope) between 1 and 100),
  status text not null default 'queued' check (status in ('queued','in_progress','review','blocked','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, company_id) references public.hq_companies(owner_id, id) on delete cascade
);
create index hq_tasks_company_index on public.hq_tasks(owner_id,company_id,created_at desc);
create table public.hq_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 140),
  detail text not null default '' check (char_length(detail) <= 2000),
  requested_amount numeric(12,2) check (requested_amount is null or requested_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  foreign key (owner_id, company_id) references public.hq_companies(owner_id, id) on delete cascade
);
create index hq_approvals_company_index on public.hq_approvals(owner_id,company_id,created_at desc);
create table public.hq_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null,
  sender text not null default 'CEO' check (char_length(sender) between 1 and 100),
  body text not null check (char_length(trim(body)) between 1 and 1600),
  created_at timestamptz not null default now(),
  foreign key (owner_id, company_id) references public.hq_companies(owner_id, id) on delete cascade
);
create index hq_messages_company_index on public.hq_messages(owner_id,company_id,created_at desc);
alter table public.hq_companies enable row level security;
alter table public.hq_tasks enable row level security;
alter table public.hq_approvals enable row level security;
alter table public.hq_messages enable row level security;
create policy hq_companies_read on public.hq_companies for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_companies_add on public.hq_companies for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy hq_companies_edit on public.hq_companies for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy hq_tasks_read on public.hq_tasks for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_tasks_add on public.hq_tasks for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy hq_tasks_edit on public.hq_tasks for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy hq_approvals_read on public.hq_approvals for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_approvals_add on public.hq_approvals for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy hq_approvals_edit on public.hq_approvals for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy hq_messages_read on public.hq_messages for select to authenticated using ((select auth.uid()) = owner_id);
create policy hq_messages_add on public.hq_messages for insert to authenticated with check ((select auth.uid()) = owner_id);
revoke all on public.hq_companies,public.hq_tasks,public.hq_approvals,public.hq_messages from anon,authenticated;
grant usage on schema public to authenticated;
grant select,insert on public.hq_companies,public.hq_tasks,public.hq_approvals,public.hq_messages to authenticated;
grant update(name,industry) on public.hq_companies to authenticated;
grant update(title,description,role_scope,status,updated_at) on public.hq_tasks to authenticated;
grant update(status,decided_at) on public.hq_approvals to authenticated;
