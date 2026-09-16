-- ===========================================================================
--  HaveStack shareholder portal
--  Run this in the Supabase SQL editor, after auth-schema.sql. It is safe to
--  run again: tables are only created when missing, policies are rebuilt from
--  scratch, and the seed only runs into empty tables.
--
--  Three ideas hold this file together.
--
--  1. The portal has its own identity. A portal account is a row in
--     portal_accounts tied to a Supabase Auth user of its own, with its own
--     password. The admin panel keeps using the Auth user for a person's real
--     address. The same person can therefore have both, with two different
--     passwords, and signing in to one never opens the other.
--
--  2. There are two kinds of portal account. A holder reads their own
--     position and what the company publishes. A portal administrator runs
--     the register: sets the share price, adds and removes shareholders,
--     records transactions, declares dividends, posts updates and documents.
--     Nothing on this file trusts the browser to enforce that: every rule is
--     a policy, a trigger or a check inside a function.
--
--  3. The register keeps itself consistent. One entry fans out: a new share
--     price revalues every holding and tells every holder; a declared dividend
--     works out what each holder is owed; a transfer moves the certificates
--     and the ledger together; everything an administrator changes is written
--     to an audit trail. See AUTOMATION further down.
--
--  The seed is a realistic but invented cap table so every screen has
--  something on it. Replace it with your real register before anyone relies
--  on the figures.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Share classes
-- ---------------------------------------------------------------------------
create table if not exists public.share_classes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text not null default '',
  votes_per_share numeric(10,2) not null default 1,
  par_value       numeric(18,6) not null default 0,
  sort            integer not null default 0
);

-- ---------------------------------------------------------------------------
--  Share capital
--  How many shares the company has in total. One row, set by a portal
--  administrator. What is allotted to holders comes out of this total, and
--  the remainder is unallocated and still to be issued. Ownership is measured
--  against the total, so unallocated shares dilute everybody and holders'
--  percentages add up to less than 100%.
--  Left at zero it means "not stated", and everything falls back to counting
--  what is actually allotted.
-- ---------------------------------------------------------------------------
create table if not exists public.share_capital (
  id           boolean primary key default true,
  total_shares bigint not null default 0,
  note         text not null default '',
  updated_at   timestamptz not null default now(),
  constraint share_capital_one_row      check (id),
  constraint share_capital_not_negative check (total_shares >= 0)
);

insert into public.share_capital (id, total_shares) values (true, 0)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  Shareholders
--  user_email is the person's real address: where they are written to, and
--  what the portal account for them is matched against. It is not how they
--  sign in; see portal_accounts.
-- ---------------------------------------------------------------------------
create table if not exists public.shareholders (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null unique,
  full_name     text not null,
  investor_ref  text not null unique default '',
  holder_type   text not null default 'individual',
  country       text not null default '',
  status        text not null default 'active',
  joined_on     date not null default current_date,

  -- contact details. Never exposed in the directory, never readable by
  -- another shareholder, editable only by the person they belong to.
  phone         text not null default '',
  address       text not null default '',

  -- whether this holder's name appears in the register other holders can see.
  -- The row is listed either way, so the percentages still add up; opting out
  -- replaces the name, not the holding.
  directory_opt_in boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint shareholders_email_lower check (user_email = lower(user_email)),
  constraint shareholders_email_shape check (user_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint shareholders_type   check (holder_type in ('individual', 'entity', 'trust')),
  constraint shareholders_status check (status in ('active', 'exited', 'suspended'))
);

-- ---------------------------------------------------------------------------
--  Portal accounts
--  One per person who may sign in to the portal. auth_user_id is a Supabase
--  Auth user that exists only for the portal: its sign in address is derived
--  from the real one (name+hsportal@domain) so it can never collide with the
--  Auth user the admin panel uses for the same person. That is what makes
--  "same email, different password" possible inside a single project.
--
--  Accounts are created by the portal-users edge function, never by the
--  browser, because creating an Auth user with a chosen password needs the
--  secret key.
-- ---------------------------------------------------------------------------
create table if not exists public.portal_accounts (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique references auth.users(id) on delete cascade,
  email           text not null unique,        -- the real address
  login_email     text not null unique,        -- the portal's own Auth address
  full_name       text not null default '',
  role            text not null default 'holder',
  shareholder_id  uuid unique references public.shareholders(id) on delete set null,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  created_by      text not null default '',
  last_sign_in_at timestamptz,
  constraint portal_accounts_email_lower check (email = lower(email)),
  constraint portal_accounts_role   check (role in ('holder', 'admin')),
  constraint portal_accounts_status check (status in ('active', 'disabled'))
);

-- ---------------------------------------------------------------------------
--  Holdings
--  One row per lot, not one per shareholder. A holder who bought three times
--  has three certificates at three prices, and collapsing that into a single
--  balance would throw away the cost basis and the acquisition dates the
--  portal has to show.
-- ---------------------------------------------------------------------------
create table if not exists public.holdings (
  id             uuid primary key default gen_random_uuid(),
  shareholder_id uuid not null references public.shareholders(id) on delete cascade,
  class_id       uuid not null references public.share_classes(id),
  shares         bigint not null,
  unit_price     numeric(18,6) not null,
  acquired_on    date not null,
  certificate_no text not null unique default '',
  status         text not null default 'active',
  note           text not null default '',
  created_at     timestamptz not null default now(),
  constraint holdings_shares_positive check (shares > 0),
  constraint holdings_status check (status in ('active', 'transferred', 'cancelled'))
);
create index if not exists holdings_by_holder on public.holdings (shareholder_id);

-- ---------------------------------------------------------------------------
--  Transactions
--  The ledger. Append only: a settled entry cannot be edited or deleted, and
--  a mistake is corrected with an adjustment. Nothing writes here directly;
--  entries arrive through the portal_record_transaction and
--  portal_transfer_shares functions, which move the certificates at the same
--  time so the two can never disagree.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  shareholder_id uuid not null references public.shareholders(id) on delete cascade,
  class_id       uuid not null references public.share_classes(id),
  kind           text not null,
  shares         bigint not null,              -- negative when shares leave
  unit_price     numeric(18,6) not null default 0,
  total_value    numeric(18,2) not null default 0,
  occurred_on    date not null,
  reference      text not null unique default '',
  status         text not null default 'settled',
  counterparty   text not null default '',
  note           text not null default '',
  created_at     timestamptz not null default now(),
  constraint transactions_kind check (kind in
    ('purchase', 'allocation', 'transfer_in', 'transfer_out', 'bonus', 'adjustment')),
  constraint transactions_status check (status in ('settled', 'pending', 'cancelled'))
);
create index if not exists transactions_by_holder on public.transactions (shareholder_id, occurred_on desc);

-- ---------------------------------------------------------------------------
--  Valuations
--  The internal share price, dated. The portal always quotes the most recent
--  published one and says when it was set, because an undated valuation is a
--  number nobody can check. The price holds between valuations, which is why
--  the chart draws it as steps rather than a slope.
-- ---------------------------------------------------------------------------
create table if not exists public.valuations (
  id              uuid primary key default gen_random_uuid(),
  effective_on    date not null unique,
  price_per_share numeric(18,6) not null,
  total_valuation numeric(18,2) not null default 0,
  method          text not null default '',
  note            text not null default '',
  published       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Dividends, and what each holder is owed from one
-- ---------------------------------------------------------------------------
create table if not exists public.dividends (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  declared_on  date not null,
  record_date  date not null,
  payment_date date not null,
  per_share    numeric(18,6) not null,
  currency     text not null default 'BDT',
  class_id     uuid references public.share_classes(id),   -- null means every class
  status       text not null default 'announced',
  note         text not null default '',
  created_at   timestamptz not null default now(),
  constraint dividends_status check (status in ('announced', 'approved', 'paid', 'cancelled'))
);

create table if not exists public.dividend_payments (
  id              uuid primary key default gen_random_uuid(),
  dividend_id     uuid not null references public.dividends(id) on delete cascade,
  shareholder_id  uuid not null references public.shareholders(id) on delete cascade,
  eligible_shares bigint not null,
  gross           numeric(18,2) not null,
  tax_withheld    numeric(18,2) not null default 0,
  net             numeric(18,2) not null,
  status          text not null default 'pending',
  paid_on         date,
  reference       text not null unique default '',
  constraint dividend_payments_status check (status in ('pending', 'paid', 'failed', 'cancelled')),
  unique (dividend_id, shareholder_id)
);
create index if not exists dividend_payments_by_holder on public.dividend_payments (shareholder_id);

-- ---------------------------------------------------------------------------
--  Documents
--  shareholder_id null means the document belongs to everybody: an annual
--  report, a company policy. A document with a holder on it is private to that
--  holder, which is what a share certificate has to be. The file itself lives
--  in the private portal-documents storage bucket, at storage_path.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text not null,
  shareholder_id uuid references public.shareholders(id) on delete cascade,
  storage_path   text not null default '',
  file_size      bigint not null default 0,
  issued_on      date not null default current_date,
  published      boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint documents_category check (category in
    ('certificate', 'agreement', 'dividend_statement', 'tax', 'annual_report', 'company'))
);
create index if not exists documents_by_holder on public.documents (shareholder_id);

-- ---------------------------------------------------------------------------
--  Updates and company facts
-- ---------------------------------------------------------------------------
create table if not exists public.updates (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  kind         text not null default 'announcement',
  published_at timestamptz not null default now(),
  pinned       boolean not null default false,
  published    boolean not null default true,
  constraint updates_kind check (kind in
    ('announcement', 'investor_update', 'dividend', 'document', 'meeting'))
);

create table if not exists public.company_facts (
  id        uuid primary key default gen_random_uuid(),
  label     text not null,
  value     text not null,
  note      text not null default '',
  sort      integer not null default 0,
  published boolean not null default true
);

-- ---------------------------------------------------------------------------
--  Security activity
--  What the Account page shows under sign in activity. The portal writes a
--  row when somebody signs in; nobody may rewrite or remove one, including the
--  person it is about, because a security log its subject can edit is not a
--  security log.
-- ---------------------------------------------------------------------------
create table if not exists public.portal_activity (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid references public.portal_accounts(id) on delete cascade,
  shareholder_id uuid references public.shareholders(id) on delete cascade,
  kind           text not null,
  detail         text not null default '',
  device         text not null default '',
  created_at     timestamptz not null default now(),
  constraint portal_activity_kind check (kind in
    ('sign_in', 'sign_out', 'password_change', 'profile_change', 'mfa_enrolled', 'mfa_removed', 'document_view'))
);

-- ---------------------------------------------------------------------------
--  Audit trail
--  Every change to the register, by whom and when, with the row before and
--  after. Written by triggers and by the portal-users function; readable by
--  portal administrators only; writable by nobody through the API.
-- ---------------------------------------------------------------------------
create table if not exists public.portal_audit (
  id               bigint generated always as identity primary key,
  at               timestamptz not null default now(),
  actor_account_id uuid,
  actor_email      text not null default '',
  table_name       text not null,
  row_id           text not null default '',
  action           text not null,
  summary          text not null default '',
  old_row          jsonb,
  new_row          jsonb
);
create index if not exists portal_audit_at on public.portal_audit (at desc);

-- ---------------------------------------------------------------------------
--  Bringing an existing database up to this version
--  create table if not exists leaves a table from an earlier run untouched,
--  so every column added since then is added here as well. On a fresh install
--  each of these finds the column already present and does nothing.
-- ---------------------------------------------------------------------------
alter table public.dividends         add column if not exists tax_rate numeric(5,2) not null default 10;
alter table public.updates           add column if not exists automatic boolean not null default false;
alter table public.transactions      add column if not exists holding_id uuid references public.holdings(id) on delete set null;
alter table public.transactions      add column if not exists recorded_by uuid references public.portal_accounts(id) on delete set null;
alter table public.portal_activity   add column if not exists account_id uuid references public.portal_accounts(id) on delete cascade;
alter table public.portal_activity   alter column shareholder_id drop not null;
alter table public.shareholders      alter column investor_ref set default '';
alter table public.holdings          alter column certificate_no set default '';
alter table public.transactions      alter column reference set default '';
alter table public.dividend_payments alter column reference set default '';

do $$
begin
  alter table public.dividends add constraint dividends_tax_rate check (tax_rate >= 0 and tax_rate <= 100);
exception when duplicate_object then null;
end
$$;

create index if not exists portal_activity_by_account on public.portal_activity (account_id, created_at desc);

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
drop trigger if exists shareholders_touch on public.shareholders;
create trigger shareholders_touch before update on public.shareholders
  for each row execute function public.touch_updated_at();
drop trigger if exists share_capital_touch on public.share_capital;
create trigger share_capital_touch before update on public.share_capital
  for each row execute function public.touch_updated_at();

-- ===========================================================================
--  WHO IS ASKING
--
--  Every question is answered from portal_accounts by auth.uid(), never from
--  the address in the token. A person's admin panel session carries their real
--  address and no portal account, so it answers "nobody" to every question
--  below, which is the whole of the separation between the two.
--
--  security definer because the policies call these, and a policy that queried
--  a protected table through the caller's own rights would recurse.
-- ===========================================================================
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id
    from public.portal_accounts a
   where a.auth_user_id = auth.uid()
     and a.status = 'active'
   limit 1;
$$;

create or replace function public.is_portal_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_account_id() is not null;
$$;

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.portal_accounts a
     where a.auth_user_id = auth.uid()
       and a.status = 'active'
       and a.role = 'admin'
  );
$$;

-- The shareholder the signed in portal account belongs to, if it belongs to
-- one. An administrator who holds no shares has no shareholder, and sees the
-- portal without a position of their own.
create or replace function public.current_shareholder_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id
    from public.portal_accounts a
    join public.shareholders s on s.id = a.shareholder_id
   where a.auth_user_id = auth.uid()
     and a.status = 'active'
     and s.status = 'active'
   limit 1;
$$;

create or replace function public.is_shareholder()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_shareholder_id() is not null;
$$;

create or replace function public.require_portal_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_portal_admin() then
    raise exception 'Only a portal administrator can do that.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- ===========================================================================
--  ROW LEVEL SECURITY
--
--  Rebuilt from scratch on every run. A member reads what the company
--  publishes and their own records. A portal administrator reads everything
--  and writes the tables an administrator edits directly. holdings and
--  transactions are written by nobody through the API: they change only
--  through the functions under AUTOMATION, which keep them in step.
--  Anonymous visitors get nothing from any table in this file.
-- ===========================================================================
do $$
declare
  t text;
  p text;
  every_table text[] := array['share_classes', 'share_capital', 'shareholders', 'portal_accounts', 'holdings',
                              'transactions', 'valuations', 'dividends', 'dividend_payments',
                              'documents', 'updates', 'company_facts', 'portal_activity',
                              'portal_audit'];
begin
  foreach t in array every_table loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;

  -- ---- what every member reads -------------------------------------------
  foreach t in array array['share_classes', 'dividends', 'share_capital'] loop
    execute format($q$create policy "members read %1$s" on public.%1$I
                        for select to authenticated
                        using (public.is_portal_member())$q$, t);
  end loop;

  foreach t in array array['valuations', 'updates', 'company_facts'] loop
    execute format($q$create policy "members read published %1$s" on public.%1$I
                        for select to authenticated
                        using ((published and public.is_portal_member()) or public.is_portal_admin())$q$, t);
  end loop;

  -- ---- a holder's own records, and everybody's for an administrator ------
  foreach t in array array['holdings', 'transactions', 'dividend_payments'] loop
    execute format($q$create policy "holder reads own %1$s" on public.%1$I
                        for select to authenticated
                        using (shareholder_id = public.current_shareholder_id()
                               or public.is_portal_admin())$q$, t);
  end loop;

  -- ---- what a portal administrator edits directly -------------------------
  foreach t in array array['share_classes', 'shareholders', 'valuations', 'dividends',
                           'documents', 'updates', 'company_facts'] loop
    execute format($q$create policy "portal admin adds %1$s" on public.%1$I
                        for insert to authenticated
                        with check (public.is_portal_admin())$q$, t);
    execute format($q$create policy "portal admin changes %1$s" on public.%1$I
                        for update to authenticated
                        using (public.is_portal_admin())
                        with check (public.is_portal_admin())$q$, t);
    execute format($q$create policy "portal admin removes %1$s" on public.%1$I
                        for delete to authenticated
                        using (public.is_portal_admin())$q$, t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- ---- share capital: one row, changed by an administrator, never added to ---
--  There is deliberately no insert or delete policy: the row is created by
--  this file and only its number ever changes.
drop policy if exists "portal admin sets the company total" on public.share_capital;
create policy "portal admin sets the company total" on public.share_capital
  for update to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
grant update on public.share_capital to authenticated;

-- ---- dividend payments: an administrator can mark one line paid or failed --
create policy "portal admin changes dividend_payments"
  on public.dividend_payments for update to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
grant update on public.dividend_payments to authenticated;

-- ---- shareholders: your own row, or all of them for an administrator -------
create policy "member reads own shareholder record"
  on public.shareholders for select to authenticated
  using (id = public.current_shareholder_id() or public.is_portal_admin());

-- The only write a holder is allowed anywhere in this file. The columns that
-- decide what they own are not in it: a WITH CHECK cannot pin individual
-- columns, so the guard trigger below does, and refuses the update outright
-- if anything else moved.
create policy "holder edits own contact details"
  on public.shareholders for update to authenticated
  using (id = public.current_shareholder_id())
  with check (id = public.current_shareholder_id());

-- ---- portal accounts: your own, or all of them for an administrator --------
-- Read only from the browser. Accounts are created and changed by the
-- portal-users edge function, which holds the secret key.
create policy "member reads own portal account"
  on public.portal_accounts for select to authenticated
  using (auth_user_id = auth.uid() or public.is_portal_admin());

-- ---- documents: yours, plus the ones addressed to everybody ----------------
create policy "members read documents"
  on public.documents for select to authenticated
  using (
    public.is_portal_admin()
    or (published and (
          shareholder_id = public.current_shareholder_id()
          or (shareholder_id is null and public.is_portal_member())
        ))
  );

-- ---- activity: record and read your own ------------------------------------
create policy "member reads own activity"
  on public.portal_activity for select to authenticated
  using (account_id = public.current_account_id() or public.is_portal_admin());

create policy "member records own activity"
  on public.portal_activity for insert to authenticated
  with check (account_id = public.current_account_id());
grant insert on public.portal_activity to authenticated;

-- ---- audit: administrators read it; nobody writes it through the API -------
create policy "portal admin reads the audit trail"
  on public.portal_audit for select to authenticated
  using (public.is_portal_admin());

-- ---- the one field set a holder may change about themselves ----------------
create or replace function public.guard_shareholder_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- a portal administrator may change anything
  if public.is_portal_admin() then return new; end if;

  -- everyone else may change their contact details and nothing else
  if new.id             is distinct from old.id
  or new.user_email     is distinct from old.user_email
  or new.full_name      is distinct from old.full_name
  or new.investor_ref   is distinct from old.investor_ref
  or new.holder_type    is distinct from old.holder_type
  or new.status         is distinct from old.status
  or new.joined_on      is distinct from old.joined_on
  or new.created_at     is distinct from old.created_at then
    raise exception 'Only a portal administrator can change your name, reference or standing. '
                    'You may edit your phone, address, country and directory listing.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists shareholders_self_edit_guard on public.shareholders;
create trigger shareholders_self_edit_guard
  before update on public.shareholders
  for each row execute function public.guard_shareholder_self_edit();

-- ===========================================================================
--  VIEWS
--
--  These run with the owner's rights, which is deliberate: a percentage needs
--  the total of everybody's shares, and no holder may read everybody's rows.
--  Each one therefore carries its own gate in its WHERE clause, and none of
--  the member views selects a contact column. Read every WHERE clause here as
--  part of the security model, because that is what it is.
--
--  Dropped and recreated rather than replaced, because a replace cannot change
--  a view's columns and an earlier version of any of these may be present.
-- ===========================================================================
drop view if exists public.v_register cascade;
drop view if exists public.v_shareholder_directory cascade;
drop view if exists public.v_my_position cascade;
drop view if exists public.v_latest_valuation cascade;
drop view if exists public.v_share_totals cascade;

-- The three numbers every percentage and valuation is worked out from.
-- Postgres checks a function's EXECUTE permission against whoever is asking,
-- even inside a view that runs with its owner's rights, so these have to be
-- callable by a signed in user or every view below fails for everybody. Each
-- one therefore answers 0 to anybody who is not a portal member, and the
-- share count stays as private as the views that use it.
create or replace function public.company_total_shares()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_portal_member()
              then coalesce((select total_shares from public.share_capital where id), 0)
              else 0 end::bigint;
$$;

-- Shares actually in issue: active lots only, so a cancelled or transferred
-- certificate stops counting the moment it stops being owned.
create or replace function public.allotted_shares()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_portal_member() then (
           select coalesce(sum(h.shares), 0)
             from public.holdings h
             join public.shareholders s on s.id = h.shareholder_id
            where h.status = 'active' and s.status = 'active')
         else 0 end::bigint;
$$;

-- What a percentage is measured against: the company's total. Unless more has
-- somehow been allotted than the company says it has, in which case the larger
-- figure is used, so nobody is ever shown as owning more than all of it. A
-- company total left at zero means the same as "count what is allotted".
create or replace function public.ownership_base()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(public.company_total_shares(), public.allotted_shares());
$$;

-- total_shares is what is allotted to holders; company_total is what the
-- company says it has; the difference is still to be issued.
create view public.v_share_totals as
  with held as (
    select coalesce(sum(h.shares), 0)::bigint    as allotted,
           count(distinct h.shareholder_id)::int as holders
      from public.holdings h
      join public.shareholders s on s.id = h.shareholder_id
     where h.status = 'active' and s.status = 'active'
  )
  select
    held.allotted                                              as total_shares,
    held.holders,
    public.company_total_shares()                              as company_total,
    greatest(public.company_total_shares() - held.allotted, 0) as unallocated,
    public.ownership_base()                                    as ownership_base
  from held
  where public.is_portal_member();

create view public.v_latest_valuation as
  select effective_on, price_per_share, total_valuation, method, note
    from public.valuations
   where published
     and public.is_portal_member()
   order by effective_on desc
   limit 1;

-- The caller's own position, aggregated and costed. Because every figure here
-- is multiplied out at read time, a new share price revalues every holding the
-- moment it is saved, with nothing stored per holder to fall out of date.
create view public.v_my_position as
  select
    coalesce(sum(h.shares), 0)::bigint                            as shares,
    coalesce(sum(h.shares * h.unit_price), 0)::numeric(18,2)      as invested,
    public.allotted_shares()                                      as total_shares,
    public.company_total_shares()                                 as company_total,
    case when public.ownership_base() > 0
         then round(100.0 * coalesce(sum(h.shares), 0) / public.ownership_base(), 4)
         else 0 end                                               as ownership_pct,
    (select price_per_share from public.v_latest_valuation)       as price_per_share,
    (coalesce(sum(h.shares), 0)
      * coalesce((select price_per_share from public.v_latest_valuation), 0))::numeric(18,2)
                                                                  as current_value
  from public.holdings h
  where h.shareholder_id = public.current_shareholder_id()
    and h.status = 'active';

-- The register other holders may see. Name, size, class, rank. No address, no
-- phone, no email, ever. A holder who opted out keeps their row so the
-- percentages still add up, and loses their name.
create view public.v_shareholder_directory as
  with agg as (
    select
      s.id,
      s.investor_ref,
      s.full_name,
      s.holder_type,
      s.directory_opt_in,
      s.joined_on,
      coalesce(sum(h.shares), 0)::bigint as shares,
      string_agg(distinct c.code, ', ' order by c.code) as classes
    from public.shareholders s
    left join public.holdings h on h.shareholder_id = s.id and h.status = 'active'
    left join public.share_classes c on c.id = h.class_id
    where s.status = 'active'
    group by s.id
  )
  select
    a.id,
    case when a.directory_opt_in then a.full_name else 'Undisclosed holder' end as full_name,
    case when a.directory_opt_in then a.investor_ref else '' end as investor_ref,
    a.holder_type,
    a.directory_opt_in,
    a.shares,
    coalesce(a.classes, '') as classes,
    case when public.ownership_base() > 0
         then round(100.0 * a.shares / public.ownership_base(), 4) else 0 end as ownership_pct,
    rank() over (order by a.shares desc)::int as ranking,
    (a.id = public.current_shareholder_id()) as is_me
  from agg a
  where public.is_portal_member();

-- The full register, for administrators only: every holder whatever their
-- standing, their contact address, their size and cost, and whether and how
-- they can sign in.
create view public.v_register as
  with held as (
    select h.shareholder_id,
           sum(h.shares)::bigint                     as shares,
           sum(h.shares * h.unit_price)::numeric(18,2) as invested
      from public.holdings h
     where h.status = 'active'
     group by h.shareholder_id
  )
  select
    s.id, s.investor_ref, s.full_name, s.user_email, s.holder_type, s.country,
    s.status, s.joined_on, s.directory_opt_in, s.phone, s.address,
    coalesce(hd.shares, 0)   as shares,
    coalesce(hd.invested, 0) as invested,
    case when public.ownership_base() > 0 and s.status = 'active'
         then round(100.0 * coalesce(hd.shares, 0) / public.ownership_base(), 4)
         else 0 end as ownership_pct,
    a.id              as account_id,
    a.role            as account_role,
    a.status          as account_status,
    a.last_sign_in_at as last_sign_in_at
  from public.shareholders s
  left join held hd on hd.shareholder_id = s.id
  left join public.portal_accounts a on a.shareholder_id = s.id
  where public.is_portal_admin();

revoke all on public.v_share_totals, public.v_latest_valuation, public.v_my_position,
              public.v_shareholder_directory, public.v_register from public, anon;
grant select on public.v_share_totals, public.v_latest_valuation, public.v_my_position,
                public.v_shareholder_directory, public.v_register to authenticated;

-- ===========================================================================
--  SEED
--  A realistic register, so every screen has something on it. Only when the
--  tables are empty: re-running this file must not double the cap table. It
--  runs before the automation below exists, so seeding does not set off the
--  triggers it would otherwise set off.
-- ===========================================================================
insert into public.share_classes (code, name, description, votes_per_share, par_value, sort)
select * from (values
  ('ORD-A', 'Ordinary A', 'Founding equity. One vote per share, full dividend rights.', 1.0, 10.000000, 10),
  ('ORD-B', 'Ordinary B', 'Employee and adviser equity. Non voting, full dividend rights.', 0.0, 10.000000, 20),
  ('PREF-1', 'Preference 1', 'Investor preference. Priority on dividends and on a return of capital.', 1.0, 100.000000, 30)
) as seed(code, name, description, votes_per_share, par_value, sort)
where not exists (select 1 from public.share_classes);

insert into public.shareholders (user_email, full_name, investor_ref, holder_type, country, joined_on, directory_opt_in)
select * from (values
  ('tawhidhossen449@gmail.com', 'SK Tawhid Hossen',   'HS-SH-0001', 'individual', 'Bangladesh', date '2024-03-01', true),
  ('ariyanbiswas500@gmail.com', 'Ariyan Biswas',      'HS-SH-0002', 'individual', 'Bangladesh', date '2024-03-01', true),
  ('finance@avanelabs.example', 'Avane Labs Ltd',     'HS-SH-0003', 'entity',     'Singapore',  date '2024-09-14', true),
  ('holdings@gungchil.example', 'Gungchil Holdings',  'HS-SH-0004', 'entity',     'Bangladesh', date '2025-01-20', true),
  ('n.rahman@example.com',      'Nusrat Rahman',      'HS-SH-0005', 'individual', 'Bangladesh', date '2025-04-02', false),
  ('trust@firstprinciples.example', 'First Principles Trust', 'HS-SH-0006', 'trust', 'United Kingdom', date '2025-06-11', true)
) as seed(user_email, full_name, investor_ref, holder_type, country, joined_on, directory_opt_in)
where not exists (select 1 from public.shareholders);

do $$
declare
  a uuid; b uuid; pref uuid;
  h1 uuid; h2 uuid; h3 uuid; h4 uuid; h5 uuid; h6 uuid;
  d1 uuid; d2 uuid; d3 uuid;
begin
  if exists (select 1 from public.holdings) then
    raise notice 'holdings already present, skipping the rest of the seed';
    return;
  end if;

  select id into a    from public.share_classes where code = 'ORD-A';
  select id into b    from public.share_classes where code = 'ORD-B';
  select id into pref from public.share_classes where code = 'PREF-1';

  select id into h1 from public.shareholders where investor_ref = 'HS-SH-0001';
  select id into h2 from public.shareholders where investor_ref = 'HS-SH-0002';
  select id into h3 from public.shareholders where investor_ref = 'HS-SH-0003';
  select id into h4 from public.shareholders where investor_ref = 'HS-SH-0004';
  select id into h5 from public.shareholders where investor_ref = 'HS-SH-0005';
  select id into h6 from public.shareholders where investor_ref = 'HS-SH-0006';

  insert into public.holdings (shareholder_id, class_id, shares, unit_price, acquired_on, certificate_no, note) values
    (h1, a,    420000, 10.000000, '2024-03-01', 'HS-CERT-000001', 'Founding allotment'),
    (h1, a,     60000, 42.500000, '2025-02-18', 'HS-CERT-000012', 'Follow on subscription'),
    (h1, b,     25000, 18.000000, '2025-07-09', 'HS-CERT-000019', 'Long service allocation'),
    (h2, a,    310000, 10.000000, '2024-03-01', 'HS-CERT-000002', 'Founding allotment'),
    (h2, b,     20000, 18.000000, '2025-07-09', 'HS-CERT-000020', 'Long service allocation'),
    (h3, pref, 150000, 100.000000,'2024-09-14', 'HS-CERT-000005', 'Series seed'),
    (h4, a,     90000, 42.500000, '2025-01-20', 'HS-CERT-000009', 'Strategic subscription'),
    (h5, b,     18000, 18.000000, '2025-04-02', 'HS-CERT-000015', 'Adviser allocation'),
    (h6, pref,  60000, 100.000000,'2025-06-11', 'HS-CERT-000017', 'Series seed extension');

  insert into public.transactions (shareholder_id, class_id, kind, shares, unit_price, total_value, occurred_on, reference, counterparty, note) values
    (h1, a, 'allocation',  420000, 10.000000, 4200000.00, '2024-03-01', 'HS-TX-00001', 'HaveStack Technologies', 'Founding allotment'),
    (h2, a, 'allocation',  310000, 10.000000, 3100000.00, '2024-03-01', 'HS-TX-00002', 'HaveStack Technologies', 'Founding allotment'),
    (h3, pref,'purchase',  150000, 100.000000,15000000.00,'2024-09-14', 'HS-TX-00005', 'Avane Labs Ltd', 'Series seed subscription'),
    (h4, a, 'purchase',     90000, 42.500000, 3825000.00, '2025-01-20', 'HS-TX-00009', 'Gungchil Holdings', 'Strategic subscription'),
    (h1, a, 'purchase',     60000, 42.500000, 2550000.00, '2025-02-18', 'HS-TX-00012', 'HaveStack Technologies', 'Follow on subscription'),
    (h5, b, 'allocation',   18000, 18.000000,  324000.00, '2025-04-02', 'HS-TX-00015', 'HaveStack Technologies', 'Adviser allocation'),
    (h6, pref,'purchase',   60000, 100.000000, 6000000.00,'2025-06-11', 'HS-TX-00017', 'First Principles Trust', 'Series seed extension'),
    (h1, b, 'allocation',   25000, 18.000000,  450000.00, '2025-07-09', 'HS-TX-00019', 'HaveStack Technologies', 'Long service allocation'),
    (h2, b, 'allocation',   20000, 18.000000,  360000.00, '2025-07-09', 'HS-TX-00020', 'HaveStack Technologies', 'Long service allocation'),
    (h1, a, 'bonus',            0,  0.000000,       0.00, '2026-01-15', 'HS-TX-00024', 'HaveStack Technologies', 'Bonus issue pending approval'),
    (h2, a, 'adjustment',       0,  0.000000,       0.00, '2026-02-03', 'HS-TX-00026', 'HaveStack Technologies', 'Register correction, no change to holding');

  update public.transactions set status = 'pending'   where reference = 'HS-TX-00024';
  update public.transactions set status = 'cancelled' where reference = 'HS-TX-00026';

  insert into public.valuations (effective_on, price_per_share, total_valuation, method, note) values
    ('2024-03-01',  10.000000,   7300000.00, 'Par on incorporation', 'Founding capital at par.'),
    ('2024-09-14', 100.000000, 103000000.00, 'Priced round',         'Set by the Series seed subscription price.'),
    ('2025-01-20',  42.500000,  49895000.00, 'Board valuation',      'Ordinary share price after the strategic subscription.'),
    ('2026-01-31',  58.000000,  70934000.00, 'Board valuation',      'Annual review, approved by the board on 31 January 2026.');

  insert into public.dividends (title, declared_on, record_date, payment_date, per_share, class_id, status, note)
    values ('Interim dividend 2025', '2025-08-01', '2025-08-20', '2025-09-05', 1.250000, null, 'paid',
            'Interim distribution on all classes for the half year to June 2025.')
    returning id into d1;
  insert into public.dividends (title, declared_on, record_date, payment_date, per_share, class_id, status, note)
    values ('Preference coupon 2025', '2025-12-15', '2025-12-31', '2026-01-15', 6.000000, pref, 'paid',
            'Annual preference coupon on the Preference 1 class.')
    returning id into d2;
  insert into public.dividends (title, declared_on, record_date, payment_date, per_share, class_id, status, note)
    values ('Final dividend 2025', '2026-02-10', '2026-03-05', '2026-03-25', 2.400000, null, 'approved',
            'Final distribution for the year to December 2025. Approved, not yet paid.')
    returning id into d3;

  insert into public.dividend_payments (dividend_id, shareholder_id, eligible_shares, gross, tax_withheld, net, status, paid_on, reference)
  select
    d.id, x.sh, x.qty,
    round(x.qty * d.per_share, 2),
    round(x.qty * d.per_share * 0.10, 2),
    round(x.qty * d.per_share * 0.90, 2),
    case when d.status = 'paid' then 'paid' else 'pending' end,
    case when d.status = 'paid' then d.payment_date else null end,
    'HS-DIV-' || to_char(d.record_date, 'YYYYMMDD') || '-' || x.ref
  from (values (d1), (d2), (d3)) as dd(did)
  join public.dividends d on d.id = dd.did
  join lateral (
    select h.shareholder_id as sh,
           sum(h.shares)::bigint as qty,
           (select investor_ref from public.shareholders where id = h.shareholder_id) as ref
      from public.holdings h
     where h.status = 'active'
       and h.acquired_on <= d.record_date
       and (d.class_id is null or h.class_id = d.class_id)
     group by h.shareholder_id
  ) x on true;

  insert into public.documents (title, category, shareholder_id, storage_path, file_size, issued_on) values
    ('Annual report 2025',                'annual_report', null, 'company/annual-report-2025.pdf',        2360000, '2026-02-20'),
    ('Articles of association',           'company',       null, 'company/articles-of-association.pdf',    410000, '2024-03-01'),
    ('Shareholder agreement 2024',        'agreement',     null, 'company/shareholder-agreement-2024.pdf', 690000, '2024-03-01'),
    ('Board valuation note, January 2026','company',       null, 'company/valuation-note-2026-01.pdf',     180000, '2026-01-31'),
    ('Share certificate HS-CERT-000001',  'certificate',   h1,   'holders/HS-SH-0001/cert-000001.pdf',      96000, '2024-03-01'),
    ('Share certificate HS-CERT-000012',  'certificate',   h1,   'holders/HS-SH-0001/cert-000012.pdf',      96000, '2025-02-18'),
    ('Share certificate HS-CERT-000019',  'certificate',   h1,   'holders/HS-SH-0001/cert-000019.pdf',      96000, '2025-07-09'),
    ('Subscription agreement, February 2025','agreement',  h1,   'holders/HS-SH-0001/sub-agreement-2025.pdf', 240000, '2025-02-18'),
    ('Dividend statement, interim 2025',  'dividend_statement', h1, 'holders/HS-SH-0001/div-interim-2025.pdf', 88000, '2025-09-05'),
    ('Tax certificate 2025 to 2026',      'tax',           h1,   'holders/HS-SH-0001/tax-2025-26.pdf',       74000, '2026-04-06'),
    ('Share certificate HS-CERT-000002',  'certificate',   h2,   'holders/HS-SH-0002/cert-000002.pdf',      96000, '2024-03-01'),
    ('Dividend statement, interim 2025',  'dividend_statement', h2, 'holders/HS-SH-0002/div-interim-2025.pdf', 88000, '2025-09-05');

  insert into public.updates (title, body, kind, published_at, pinned) values
    ('Final dividend for 2025 approved',
     'The board approved a final dividend of 2.40 per share on 10 February 2026. The record date is 5 March 2026 and payment is scheduled for 25 March 2026. Holders on the register at the record date will receive a statement in Documents once payment has cleared.',
     'dividend', '2026-02-10 10:00+06', true),
    ('Annual general meeting, 18 March 2026',
     'The annual general meeting will be held at 11:00 on 18 March 2026 at the registered office, and remotely. Notice, the agenda and the proxy form are in Documents. Please register your attendance by 11 March.',
     'meeting', '2026-02-18 09:00+06', true),
    ('Annual report 2025 published',
     'The audited annual report for the year to 31 December 2025 is now available in Documents, together with the board valuation note supporting the January 2026 share price.',
     'document', '2026-02-20 14:30+06', false),
    ('Board valuation set at 58.00 per share',
     'Following the annual review, the board set the internal ordinary share price at 58.00 with effect from 31 January 2026. The valuation note sets out the method and the comparables used.',
     'investor_update', '2026-01-31 17:00+06', false),
    ('Managed services revenue up 41 per cent',
     'Recurring revenue from systems under management grew 41 per cent year on year, and now accounts for a little over half of total revenue. The full breakdown is in the annual report.',
     'investor_update', '2026-02-20 15:00+06', false),
    ('Interim dividend paid',
     'The interim dividend of 1.25 per share declared on 1 August 2025 was paid on 5 September 2025. Statements are in Documents.',
     'dividend', '2025-09-05 12:00+06', false);

  insert into public.company_facts (label, value, note, sort) values
    ('Legal name',        'HaveStack Technologies Ltd', 'Registered in Bangladesh.', 10),
    ('Incorporated',      '1 March 2024',               '', 20),
    ('Registered office', 'Dhaka, Bangladesh',          '', 30),
    ('Financial year end','31 December',                '', 40),
    ('Auditor',           'Appointed annually at the AGM', '', 50),
    ('Share classes',     'Three',                      'Ordinary A, Ordinary B and Preference 1.', 60);
end
$$;

-- ===========================================================================
--  AUTOMATION
--
--  What one administrator action sets off, so nobody has to do it by hand:
--
--    A new share price        every holding is revalued (the views multiply
--                             it out at read time), the company valuation is
--                             worked out if not given, and every holder is
--                             sent an update saying what changed and by how
--                             much. Open portals redraw without a reload.
--    A dividend declared      each holder's entitlement is worked out from the
--                             ledger as it stood on the record date, gross,
--                             withholding and net, and holders are told.
--    A dividend marked paid   every pending line is marked paid on the payment
--                             date, and holders are told. Cancelled cancels.
--    The register changes     any dividend not yet paid whose record date the
--    before a record date     change falls before is worked out again.
--    Shares issued            the ledger entry and the certificate are written
--                             together, both numbered in sequence.
--    Shares transferred       the sender's certificates are closed oldest
--                             first, a balance certificate is issued for any
--                             remainder at its original cost, and the receiver
--                             gets a new certificate. Two ledger entries, one
--                             action.
--    A holder removed         refused while they still hold shares; once they
--                             are out, their portal sign in is switched off.
--    A company document       holders are told a new document is available.
--    Anything changed         written to the audit trail with the before and
--                             after, and who did it.
--    A sign in                the account's last sign in is recorded.
-- ===========================================================================

-- ---- numbering --------------------------------------------------------------
-- Sequences, started past whatever is already on the register, so a reference
-- is never reused even when a later one is deleted.
create sequence if not exists public.seq_investor_ref;
create sequence if not exists public.seq_certificate_no;
create sequence if not exists public.seq_tx_reference;

select setval('public.seq_investor_ref',
  coalesce((select max(substring(investor_ref from '([0-9]+)$')::bigint)
              from public.shareholders where investor_ref ~ '[0-9]+$'), 0) + 1, false);
select setval('public.seq_certificate_no',
  coalesce((select max(substring(certificate_no from '([0-9]+)$')::bigint)
              from public.holdings where certificate_no ~ '[0-9]+$'), 0) + 1, false);
select setval('public.seq_tx_reference',
  coalesce((select max(substring(reference from '([0-9]+)$')::bigint)
              from public.transactions where reference ~ '[0-9]+$'), 0) + 1, false);

-- ---- small formatting helpers for the messages holders are sent -------------
create or replace function public.fmt_money(v numeric)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select to_char(round(coalesce(v, 0), 2), 'FM999,999,999,999,990.00') $$;

create or replace function public.fmt_shares(v bigint)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select to_char(coalesce(v, 0), 'FM999,999,999,999,990') $$;

create or replace function public.fmt_date(d date)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select to_char(d, 'FMDD FMMonth YYYY') $$;

-- ---- the audit trail ---------------------------------------------------------
create or replace function public.trg_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acct uuid := public.current_account_id();
  who  text;
  row_json jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if acct is not null then
    select a.email into who from public.portal_accounts a where a.id = acct;
  end if;
  insert into public.portal_audit (actor_account_id, actor_email, table_name, row_id, action, old_row, new_row)
  values (acct,
          coalesce(who, case when auth.uid() is null then 'system' else 'unrecognised session' end),
          tg_table_name,
          coalesce(row_json ->> 'id', row_json ->> 'key', ''),
          lower(tg_op),
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['share_classes', 'share_capital', 'shareholders', 'holdings', 'transactions',
                           'valuations', 'dividends', 'dividend_payments', 'documents', 'updates',
                           'company_facts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                      for each row execute function public.trg_audit()', t || '_audit', t);
  end loop;
end
$$;

-- ---- shareholders ------------------------------------------------------------
create or replace function public.trg_shareholder_before()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  held bigint;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.transactions where shareholder_id = old.id)
    or exists (select 1 from public.holdings where shareholder_id = old.id) then
      raise exception '% has history on the register and cannot be deleted. Mark them as exited instead, which keeps the record.', old.full_name
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  new.user_email := lower(trim(new.user_email));

  if tg_op = 'INSERT' then
    if coalesce(new.investor_ref, '') = '' then
      new.investor_ref := 'HS-SH-' || lpad(nextval('public.seq_investor_ref')::text, 4, '0');
    end if;
    return new;
  end if;

  if new.status <> 'active' and old.status = 'active' then
    select coalesce(sum(shares), 0) into held
      from public.holdings where shareholder_id = new.id and status = 'active';
    if new.status = 'exited' and held > 0 then
      raise exception '% still holds % shares. Transfer them to another holder before removing them from the register.',
        new.full_name, public.fmt_shares(held)
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.portal_accounts a
                where a.shareholder_id = new.id and a.role = 'admin' and a.status = 'active')
       and (select count(*) from public.portal_accounts
             where role = 'admin' and status = 'active') = 1 then
      raise exception '% is the only portal administrator. Make someone else an administrator first.', new.full_name
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.trg_shareholder_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- someone who is no longer an active holder can no longer sign in
  if new.status <> 'active' and old.status = 'active' then
    update public.portal_accounts set status = 'disabled'
     where shareholder_id = new.id and status = 'active';
  end if;
  return null;
end;
$$;

drop trigger if exists shareholders_before on public.shareholders;
create trigger shareholders_before
  before insert or update or delete on public.shareholders
  for each row execute function public.trg_shareholder_before();

drop trigger if exists shareholders_after on public.shareholders;
create trigger shareholders_after
  after update of status on public.shareholders
  for each row execute function public.trg_shareholder_after();

-- ---- certificates and ledger references --------------------------------------
create or replace function public.trg_holding_before()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.certificate_no, '') = '' then
    new.certificate_no := 'HS-CERT-' || lpad(nextval('public.seq_certificate_no')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists holdings_before on public.holdings;
create trigger holdings_before before insert on public.holdings
  for each row execute function public.trg_holding_before();

create or replace function public.trg_transaction_before()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.reference, '') = '' then
      new.reference := 'HS-TX-' || lpad(nextval('public.seq_tx_reference')::text, 5, '0');
    end if;
    if coalesce(new.total_value, 0) = 0 and coalesce(new.unit_price, 0) > 0 then
      new.total_value := round(abs(new.shares) * new.unit_price, 2);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'settled' then
      raise exception 'A settled entry is part of the register and cannot be deleted. Record an adjustment instead.'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  -- a settled or cancelled entry is history: only the link to its certificate
  -- may be filled in afterwards
  if old.status in ('settled', 'cancelled')
     and (new.shareholder_id, new.class_id, new.kind, new.shares, new.unit_price,
          new.total_value, new.occurred_on, new.status, new.reference)
         is distinct from
         (old.shareholder_id, old.class_id, old.kind, old.shares, old.unit_price,
          old.total_value, old.occurred_on, old.status, old.reference) then
    raise exception 'A % entry is part of the register and cannot be edited. Record an adjustment instead.', old.status
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_before on public.transactions;
create trigger transactions_before before insert or update or delete on public.transactions
  for each row execute function public.trg_transaction_before();

-- ---- moving certificates -----------------------------------------------------
-- Close a holder's certificates oldest first until qty shares are gone. A
-- certificate only partly used is closed too, and a balance certificate for the
-- remainder is issued at its original price and date, so cost basis survives.
create or replace function public.reduce_lots(p_holder uuid, p_class uuid, p_qty bigint,
                                              p_final text, p_ref text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  remaining bigint := p_qty;
  available bigint;
begin
  select coalesce(sum(shares), 0) into available
    from public.holdings
   where shareholder_id = p_holder and class_id = p_class and status = 'active';
  if available < p_qty then
    raise exception 'That holder has % shares of this class, fewer than the % needed.',
      public.fmt_shares(available), public.fmt_shares(p_qty)
      using errcode = 'check_violation';
  end if;

  for r in
    select * from public.holdings
     where shareholder_id = p_holder and class_id = p_class and status = 'active'
     order by acquired_on, created_at
     for update
  loop
    exit when remaining = 0;
    update public.holdings
       set status = p_final,
           note = trim(both ' ' from note || ' Closed by ' || p_ref || '.')
     where id = r.id;
    if r.shares > remaining then
      insert into public.holdings (shareholder_id, class_id, shares, unit_price, acquired_on, note)
      values (r.shareholder_id, r.class_id, r.shares - remaining, r.unit_price, r.acquired_on,
              'Balance of ' || r.certificate_no || ' after ' || p_ref || '.');
      remaining := 0;
    else
      remaining := remaining - r.shares;
    end if;
  end loop;
end;
$$;

-- Give a settled entry its effect on the certificates.
create or replace function public.apply_transaction(p_tx uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t     public.transactions;
  lot   uuid;
  total bigint;
  room  bigint;
begin
  select * into t from public.transactions where id = p_tx for update;
  if not found then return; end if;

  if t.shares > 0 then
    -- A transfer moves shares between holders and never creates any, so only
    -- an entry bringing new shares onto the register is held to the total.
    -- This is the one place both routes pass through: settled as it is
    -- recorded, or recorded as pending and settled later.
    total := public.company_total_shares();
    if total > 0 and t.kind <> 'transfer_in' then
      room := total - public.allotted_shares();
      if t.shares > room then
        raise exception
          'The company has % shares and % are already allotted, so only % can be issued. Raise the company total first.',
          public.fmt_shares(total), public.fmt_shares(public.allotted_shares()),
          public.fmt_shares(greatest(room, 0))
          using errcode = 'check_violation';
      end if;
    end if;

    insert into public.holdings (shareholder_id, class_id, shares, unit_price, acquired_on, note)
    values (t.shareholder_id, t.class_id, t.shares, t.unit_price, t.occurred_on,
            initcap(replace(t.kind, '_', ' ')) || ', ' || t.reference || '.')
    returning id into lot;
    update public.transactions set holding_id = lot where id = t.id;
  elsif t.shares < 0 then
    perform public.reduce_lots(t.shareholder_id, t.class_id, -t.shares,
                               case when t.kind = 'transfer_out' then 'transferred' else 'cancelled' end,
                               t.reference);
  end if;
end;
$$;

-- ---- what an administrator calls ---------------------------------------------
create or replace function public.portal_record_transaction(
  p_shareholder  uuid,
  p_class        uuid,
  p_kind         text,
  p_shares       bigint,
  p_unit_price   numeric default 0,
  p_occurred_on  date    default current_date,
  p_counterparty text    default '',
  p_note         text    default '',
  p_status       text    default 'settled')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tx uuid;
begin
  perform public.require_portal_admin();

  if p_kind not in ('purchase', 'allocation', 'bonus', 'adjustment') then
    raise exception 'Use a transfer to move shares from one holder to another.' using errcode = 'check_violation';
  end if;
  if coalesce(p_shares, 0) = 0 then
    raise exception 'The number of shares cannot be zero.' using errcode = 'check_violation';
  end if;
  if p_shares < 0 and p_kind <> 'adjustment' then
    raise exception 'Only an adjustment can reduce a holding.' using errcode = 'check_violation';
  end if;
  if p_status not in ('settled', 'pending') then
    raise exception 'A new entry is either settled or pending.' using errcode = 'check_violation';
  end if;
  if p_status = 'pending' and p_shares < 0 then
    raise exception 'A reduction is settled when it is recorded.' using errcode = 'check_violation';
  end if;
  if p_occurred_on > current_date then
    raise exception 'An entry cannot be dated in the future.' using errcode = 'check_violation';
  end if;
  if coalesce(p_unit_price, 0) < 0 then
    raise exception 'A price cannot be negative.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.shareholders where id = p_shareholder and status = 'active') then
    raise exception 'That shareholder is not active on the register.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.share_classes where id = p_class) then
    raise exception 'Unknown share class.' using errcode = 'check_violation';
  end if;

  insert into public.transactions (shareholder_id, class_id, kind, shares, unit_price,
                                   occurred_on, status, counterparty, note, recorded_by)
  values (p_shareholder, p_class, p_kind, p_shares, coalesce(p_unit_price, 0),
          p_occurred_on, p_status, coalesce(p_counterparty, ''), coalesce(p_note, ''),
          public.current_account_id())
  returning id into tx;

  if p_status = 'settled' then
    perform public.apply_transaction(tx);
  end if;
  return tx;
end;
$$;

create or replace function public.portal_transfer_shares(
  p_from        uuid,
  p_to          uuid,
  p_class       uuid,
  p_shares      bigint,
  p_unit_price  numeric default 0,
  p_occurred_on date    default current_date,
  p_note        text    default '')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  from_name text;
  to_name   text;
  out_ref   text;
  in_tx     uuid;
  lot       uuid;
begin
  perform public.require_portal_admin();

  if p_from = p_to then
    raise exception 'Shares cannot be transferred to the holder who already has them.' using errcode = 'check_violation';
  end if;
  if coalesce(p_shares, 0) <= 0 then
    raise exception 'Transfer a positive number of shares.' using errcode = 'check_violation';
  end if;
  if p_occurred_on > current_date then
    raise exception 'A transfer cannot be dated in the future.' using errcode = 'check_violation';
  end if;
  select full_name into from_name from public.shareholders where id = p_from and status = 'active';
  if from_name is null then
    raise exception 'The holder transferring the shares is not active on the register.' using errcode = 'check_violation';
  end if;
  select full_name into to_name from public.shareholders where id = p_to and status = 'active';
  if to_name is null then
    raise exception 'The holder receiving the shares is not active on the register.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.share_classes where id = p_class) then
    raise exception 'Unknown share class.' using errcode = 'check_violation';
  end if;

  insert into public.transactions (shareholder_id, class_id, kind, shares, unit_price,
                                   occurred_on, status, counterparty, note, recorded_by)
  values (p_from, p_class, 'transfer_out', -p_shares, coalesce(p_unit_price, 0),
          p_occurred_on, 'settled', to_name, coalesce(p_note, ''), public.current_account_id())
  returning reference into out_ref;

  perform public.reduce_lots(p_from, p_class, p_shares, 'transferred', out_ref);

  insert into public.transactions (shareholder_id, class_id, kind, shares, unit_price,
                                   occurred_on, status, counterparty, note, recorded_by)
  values (p_to, p_class, 'transfer_in', p_shares, coalesce(p_unit_price, 0),
          p_occurred_on, 'settled', from_name, coalesce(p_note, ''), public.current_account_id())
  returning id into in_tx;

  insert into public.holdings (shareholder_id, class_id, shares, unit_price, acquired_on, note)
  values (p_to, p_class, p_shares, coalesce(p_unit_price, 0), p_occurred_on,
          'Transferred from ' || from_name || ', ' || out_ref || '.')
  returning id into lot;

  update public.transactions set holding_id = lot where id = in_tx;
  return in_tx;
end;
$$;

create or replace function public.portal_settle_transaction(p_tx uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.transactions;
begin
  perform public.require_portal_admin();
  select * into t from public.transactions where id = p_tx for update;
  if not found then
    raise exception 'No such entry.' using errcode = 'no_data_found';
  end if;
  if t.status <> 'pending' then
    raise exception 'Only a pending entry can be settled.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.shareholders where id = t.shareholder_id and status = 'active') then
    raise exception 'That shareholder is no longer active on the register.' using errcode = 'check_violation';
  end if;
  update public.transactions set status = 'settled' where id = p_tx;
  perform public.apply_transaction(p_tx);
end;
$$;

create or replace function public.portal_cancel_transaction(p_tx uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.transactions;
begin
  perform public.require_portal_admin();
  select * into t from public.transactions where id = p_tx for update;
  if not found then
    raise exception 'No such entry.' using errcode = 'no_data_found';
  end if;
  if t.status <> 'pending' then
    raise exception 'Only a pending entry can be cancelled. A settled one is corrected with an adjustment.'
      using errcode = 'check_violation';
  end if;
  update public.transactions set status = 'cancelled' where id = p_tx;
end;
$$;

-- ---- dividends ---------------------------------------------------------------
-- Work out every holder's entitlement from the ledger as it stood on the record
-- date. The ledger rather than today's certificates, because somebody who sold
-- after the record date was still the holder on it, and is still owed.
create or replace function public.recompute_dividend(p_dividend uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.dividends;
  n integer;
begin
  select * into d from public.dividends where id = p_dividend;
  if not found or d.status in ('paid', 'cancelled') then
    return 0;
  end if;

  delete from public.dividend_payments where dividend_id = d.id and status = 'pending';

  insert into public.dividend_payments (dividend_id, shareholder_id, eligible_shares,
                                        gross, tax_withheld, net, status, reference)
  select d.id, x.holder, x.qty,
         round(x.qty * d.per_share, 2),
         round(round(x.qty * d.per_share, 2) * d.tax_rate / 100, 2),
         round(x.qty * d.per_share, 2) - round(round(x.qty * d.per_share, 2) * d.tax_rate / 100, 2),
         'pending',
         'HS-DIV-' || to_char(d.record_date, 'YYYYMMDD') || '-'
                   || upper(substr(md5(d.id::text), 1, 4)) || '-' || x.ref
    from (
      select t.shareholder_id as holder, s.investor_ref as ref, sum(t.shares)::bigint as qty
        from public.transactions t
        join public.shareholders s on s.id = t.shareholder_id
       where t.status = 'settled'
         and t.occurred_on <= d.record_date
         and (d.class_id is null or t.class_id = d.class_id)
       group by t.shareholder_id, s.investor_ref
      having sum(t.shares) > 0
    ) x
  on conflict (dividend_id, shareholder_id) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.portal_recompute_dividend(p_dividend uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_portal_admin();
  return public.recompute_dividend(p_dividend);
end;
$$;

create or replace function public.trg_dividend_before()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'paid' then
      raise exception 'A paid dividend is part of the record and cannot be deleted.' using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if coalesce(new.per_share, 0) <= 0 then
    raise exception 'A dividend has to be more than zero per share.' using errcode = 'check_violation';
  end if;
  if new.record_date < new.declared_on then
    raise exception 'The record date cannot come before the declaration.' using errcode = 'check_violation';
  end if;
  if new.payment_date < new.record_date then
    raise exception 'Payment cannot come before the record date.' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('announced', 'approved') then
      raise exception 'A new dividend starts as announced or approved.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.status in ('paid', 'cancelled')
     and (new.status, new.per_share, new.record_date, new.payment_date, new.class_id, new.tax_rate)
         is distinct from
         (old.status, old.per_share, old.record_date, old.payment_date, old.class_id, old.tax_rate) then
    raise exception 'This dividend is % and can no longer be changed.', old.status using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create or replace function public.trg_dividend_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  class_phrase text;
begin
  class_phrase := case
    when new.class_id is null then 'every class'
    else coalesce((select 'the ' || name || ' class' from public.share_classes where id = new.class_id), 'one class')
  end;

  if tg_op = 'INSERT' then
    perform public.recompute_dividend(new.id);
    insert into public.updates (title, body, kind, automatic)
    values (new.title || ' declared',
            format('A dividend of %s %s per share on %s has been declared. Holders on the register on %s are eligible, and payment is scheduled for %s. Your own entitlement, before and after withholding, is under Dividends.',
                   new.currency, public.fmt_money(new.per_share), class_phrase,
                   public.fmt_date(new.record_date), public.fmt_date(new.payment_date)),
            'dividend', true);
    return null;
  end if;

  if new.status = 'paid' and old.status <> 'paid' then
    update public.dividend_payments
       set status = 'paid', paid_on = coalesce(paid_on, new.payment_date)
     where dividend_id = new.id and status = 'pending';
    insert into public.updates (title, body, kind, automatic)
    values (new.title || ' paid',
            format('The %s of %s %s per share on %s was paid on %s. Your statement is under Dividends.',
                   lower(new.title), new.currency, public.fmt_money(new.per_share), class_phrase,
                   public.fmt_date(new.payment_date)),
            'dividend', true);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.dividend_payments set status = 'cancelled'
     where dividend_id = new.id and status = 'pending';
    insert into public.updates (title, body, kind, automatic)
    values (new.title || ' cancelled',
            format('The %s of %s %s per share has been cancelled and will not be paid.',
                   lower(new.title), new.currency, public.fmt_money(new.per_share)),
            'dividend', true);
  elsif new.status in ('announced', 'approved')
        and (new.per_share, new.record_date, new.class_id, new.tax_rate)
            is distinct from (old.per_share, old.record_date, old.class_id, old.tax_rate) then
    perform public.recompute_dividend(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists dividends_before on public.dividends;
create trigger dividends_before before insert or update or delete on public.dividends
  for each row execute function public.trg_dividend_before();

drop trigger if exists dividends_after on public.dividends;
create trigger dividends_after after insert or update on public.dividends
  for each row execute function public.trg_dividend_after();

-- A change to the register before an unpaid dividend's record date changes who
-- is owed what, so work those dividends out again.
create or replace function public.trg_transaction_dividends()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d record;
  touched date := least(coalesce(new.occurred_on, old.occurred_on), coalesce(old.occurred_on, new.occurred_on));
begin
  for d in
    select id from public.dividends
     where status in ('announced', 'approved') and record_date >= touched
  loop
    perform public.recompute_dividend(d.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists transactions_dividends_insert on public.transactions;
create trigger transactions_dividends_insert after insert on public.transactions
  for each row execute function public.trg_transaction_dividends();

drop trigger if exists transactions_dividends_update on public.transactions;
create trigger transactions_dividends_update after update on public.transactions
  for each row
  when (old.status is distinct from new.status
        or old.shares is distinct from new.shares
        or old.occurred_on is distinct from new.occurred_on)
  execute function public.trg_transaction_dividends();

-- ---- valuations --------------------------------------------------------------
create or replace function public.trg_valuation_before()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.price_per_share, 0) <= 0 then
    raise exception 'A share price has to be more than zero.' using errcode = 'check_violation';
  end if;
  -- the company is worth its price times every share it has, the unallocated
  -- ones included
  if coalesce(new.total_valuation, 0) = 0
     or (tg_op = 'UPDATE' and new.price_per_share is distinct from old.price_per_share
         and new.total_valuation = old.total_valuation) then
    new.total_valuation := round(new.price_per_share * public.ownership_base(), 2);
  end if;
  return new;
end;
$$;

create or replace function public.trg_valuation_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  latest    date;
  previous  numeric;
  movement  text;
  corrected boolean := tg_op = 'UPDATE' and old.published
                       and old.price_per_share is distinct from new.price_per_share;
begin
  if not new.published then return null; end if;
  if tg_op = 'UPDATE' and old.published and not corrected then return null; end if;

  select max(effective_on) into latest from public.valuations where published;
  -- a back dated entry fills in history; it does not change today's price
  if new.effective_on <> latest then return null; end if;

  select v.price_per_share into previous
    from public.valuations v
   where v.published and v.effective_on < new.effective_on
   order by v.effective_on desc limit 1;

  movement := case
    when previous is null or previous = 0 then ''
    when new.price_per_share > previous then
      format(', up %s%% from BDT %s', to_char(round((new.price_per_share - previous) / previous * 100, 1), 'FM999990.0'), public.fmt_money(previous))
    when new.price_per_share < previous then
      format(', down %s%% from BDT %s', to_char(round((previous - new.price_per_share) / previous * 100, 1), 'FM999990.0'), public.fmt_money(previous))
    else ', unchanged from the previous valuation'
  end;

  insert into public.updates (title, body, kind, automatic)
  values ((case when corrected then 'Share price corrected to BDT ' else 'Share price set at BDT ' end)
            || public.fmt_money(new.price_per_share),
          format('The internal share price is BDT %s per share with effect from %s%s.%s Every holding shown in the portal is now valued at this price.',
                 public.fmt_money(new.price_per_share), public.fmt_date(new.effective_on), movement,
                 case when coalesce(new.method, '') <> '' then ' Method: ' || new.method || '.' else '' end),
          'investor_update', true);
  return null;
end;
$$;

drop trigger if exists valuations_before on public.valuations;
create trigger valuations_before before insert or update on public.valuations
  for each row execute function public.trg_valuation_before();

drop trigger if exists valuations_after on public.valuations;
create trigger valuations_after after insert or update on public.valuations
  for each row execute function public.trg_valuation_after();

-- ---- documents ---------------------------------------------------------------
create or replace function public.trg_document_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- only company wide papers are announced; a holder's own certificate is
  -- nobody else's business
  if new.shareholder_id is not null or not new.published then return null; end if;
  if tg_op = 'UPDATE' and old.published then return null; end if;
  insert into public.updates (title, body, kind, automatic)
  values ('New document: ' || new.title,
          format('%s has been published and is available to every holder under Documents.', new.title),
          'document', true);
  return null;
end;
$$;

drop trigger if exists documents_after on public.documents;
create trigger documents_after after insert or update of published on public.documents
  for each row execute function public.trg_document_after();

-- ---- sign ins ----------------------------------------------------------------
create or replace function public.trg_activity_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'sign_in' and new.account_id is not null then
    update public.portal_accounts set last_sign_in_at = new.created_at where id = new.account_id;
  end if;
  return null;
end;
$$;

drop trigger if exists portal_activity_after on public.portal_activity;
create trigger portal_activity_after after insert on public.portal_activity
  for each row execute function public.trg_activity_after();

-- ---- who may call what --------------------------------------------------------
-- Supabase grants every new function in `public` to anon, so revoking from
-- PUBLIC alone is not enough; anon is named. Signed in users may call the
-- identity checks, which the policies need, and the portal_ functions, each of
-- which refuses anybody who is not a portal administrator. Everything else is
-- internal and callable by nobody through the API.
do $$
declare
  f record;
  callable text[] := array['current_account_id', 'is_portal_member', 'is_portal_admin',
                           'current_shareholder_id', 'is_shareholder', 'require_portal_admin',
                           'company_total_shares', 'allotted_shares', 'ownership_base',
                           'portal_record_transaction', 'portal_transfer_shares',
                           'portal_settle_transaction', 'portal_cancel_transaction',
                           'portal_recompute_dividend'];
  internal text[] := array['reduce_lots', 'apply_transaction', 'recompute_dividend',
                           'trg_audit', 'trg_shareholder_before', 'trg_shareholder_after',
                           'trg_holding_before', 'trg_transaction_before', 'trg_dividend_before',
                           'trg_dividend_after', 'trg_transaction_dividends', 'trg_valuation_before',
                           'trg_valuation_after', 'trg_document_after', 'trg_activity_after',
                           'guard_shareholder_self_edit', 'touch_updated_at',
                           'fmt_money', 'fmt_shares', 'fmt_date'];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (callable || internal)
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname = any (callable) then
      execute format('grant execute on function %s to authenticated', f.sig);
    else
      execute format('revoke all on function %s from authenticated', f.sig);
    end if;
  end loop;
end
$$;

revoke all on sequence public.seq_investor_ref, public.seq_certificate_no, public.seq_tx_reference
  from public, anon, authenticated;

-- ===========================================================================
--  LIVE UPDATES
--  Postgres changes on these tables are pushed to open portals, still filtered
--  by the policies above, so a holder sees a new price or a new update arrive
--  without reloading and never sees a row they could not read anyway.
-- ===========================================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found; live updates stay off';
    return;
  end if;
  foreach t in array array['valuations', 'updates', 'dividends', 'dividend_payments', 'holdings'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ===========================================================================
--  DOCUMENT STORAGE
--  A private bucket. A file is readable by exactly the people who can read the
--  documents row that points at it, and written by portal administrators.
--  The download link the portal hands out is signed and short lived.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('portal-documents', 'portal-documents', false)
on conflict (id) do nothing;

drop policy if exists "portal members read their documents" on storage.objects;
drop policy if exists "portal admins upload documents"      on storage.objects;
drop policy if exists "portal admins replace documents"     on storage.objects;
drop policy if exists "portal admins delete documents"      on storage.objects;

create policy "portal members read their documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'portal-documents'
    and (
      public.is_portal_admin()
      or exists (
        select 1 from public.documents d
         where d.storage_path = objects.name
           and d.published
           and (d.shareholder_id = public.current_shareholder_id()
                or (d.shareholder_id is null and public.is_portal_member()))
      )
    )
  );

create policy "portal admins upload documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-documents' and public.is_portal_admin());

create policy "portal admins replace documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'portal-documents' and public.is_portal_admin())
  with check (bucket_id = 'portal-documents' and public.is_portal_admin());

create policy "portal admins delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portal-documents' and public.is_portal_admin());

-- ---------------------------------------------------------------------------
--  Check it worked.
-- ---------------------------------------------------------------------------
select 'share classes'     as "check", count(*)::text as result from public.share_classes
union all select 'shareholders',      count(*)::text from public.shareholders
union all select 'portal accounts',   count(*)::text from public.portal_accounts
union all select 'holdings',          count(*)::text from public.holdings
union all select 'transactions',      count(*)::text from public.transactions
union all select 'dividends',         count(*)::text from public.dividends
union all select 'dividend payments', count(*)::text from public.dividend_payments
union all select 'documents',         count(*)::text from public.documents
union all select 'updates',           count(*)::text from public.updates
union all select 'policies',          count(*)::text from pg_policies
  where schemaname = 'public'
    and tablename in ('share_classes','shareholders','portal_accounts','holdings','transactions',
                      'valuations','dividends','dividend_payments','documents','updates',
                      'company_facts','portal_activity','portal_audit')
union all select 'automation triggers', count(*)::text from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal;
