-- Executive Assistant's Gmail monitoring; single role, owner-controlled read-only access.
create table if not exists public.hq_exec_email_settings (
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null,
 role_key text not null default 'exec_assistant' check(role_key='exec_assistant'),
 enabled boolean not null default false,
 last_scan_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now(),
 primary key(owner_id,company_id),
 foreign key(owner_id,company_id) references public.hq_companies(owner_id,id) on delete cascade
);
create table if not exists public.hq_exec_email_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid not null,
 connection_id uuid not null references public.hq_connections(id) on delete cascade,
 gmail_id text not null check(length(gmail_id)<=100),
 thread_id text not null check(length(thread_id)<=100),
 sender text not null default '' check(length(sender)<=250),
 subject text not null default '' check(length(subject)<=300),
 snippet text not null default '' check(length(snippet)<=500),
 priority text not null check(priority in ('urgent','important','routine')),
 reason text not null default '' check(length(reason)<=250),
 received_at timestamptz,
 reviewed_at timestamptz not null default now(),
 unique(connection_id,gmail_id),
 foreign key(owner_id,company_id) references public.hq_companies(owner_id,id) on delete cascade
);
create index if not exists hq_exec_email_reviews_lookup on public.hq_exec_email_reviews(owner_id,company_id,priority,reviewed_at desc);
alter table public.hq_exec_email_settings enable row level security;
alter table public.hq_exec_email_reviews enable row level security;
revoke all on public.hq_exec_email_settings,public.hq_exec_email_reviews from public,anon,authenticated;
grant select on public.hq_exec_email_settings,public.hq_exec_email_reviews to authenticated;
grant all on public.hq_exec_email_settings,public.hq_exec_email_reviews to service_role;
create policy "owner reads executive inbox settings" on public.hq_exec_email_settings for select to authenticated using(owner_id=(select auth.uid()));
create policy "owner reads executive inbox reviews" on public.hq_exec_email_reviews for select to authenticated using(owner_id=(select auth.uid()));
comment on table public.hq_exec_email_reviews is 'Read-only Gmail message metadata and preliminary keyword triage, owned by Executive Assistant (exec_assistant) under CEO authorization. No sending, deleting or mailbox modification.';
