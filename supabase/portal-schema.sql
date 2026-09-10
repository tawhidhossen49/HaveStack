-- ===========================================================================
--  HaveStack shareholder portal
--  Run this once in the Supabase SQL editor, after auth-schema.sql.
--
--  The rule this file is built around: a shareholder reads, an administrator
--  writes. Ownership, transactions, dividends, valuations and certificates are
--  records of things that happened. They are not settings, and nothing signed
--  in as a shareholder can change one. The only rows a shareholder may write
--  are the handful of fields on their own profile that are genuinely theirs.
--
--  Everything is seeded with a realistic cap table so every screen has
--  something to show. Delete the seed block at the bottom before you put real
--  figures in, or edit the numbers to match your own register.
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
--  Shareholders
--  user_email is the join to Supabase Auth. It is how a signed in person is
--  recognised as an owner, so it carries the same lowercase constraint the
--  admins table does: one address must not be able to exist twice in two cases.
-- ---------------------------------------------------------------------------
create table if not exists public.shareholders (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null unique,
  full_name     text not null,
  investor_ref  text not null unique,
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
  certificate_no text not null unique,
  status         text not null default 'active',
  note           text not null default '',
  created_at     timestamptz not null default now(),
  constraint holdings_shares_positive check (shares > 0),
  constraint holdings_status check (status in ('active', 'transferred', 'cancelled'))
);
create index if not exists holdings_by_holder on public.holdings (shareholder_id);

-- ---------------------------------------------------------------------------
--  Transactions
--  The ledger. Append only in spirit: a mistake is corrected with an
--  adjustment row, not by editing history.
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
  reference      text not null unique,
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
--  number nobody can check.
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
  reference       text not null unique,
  constraint dividend_payments_status check (status in ('pending', 'paid', 'failed', 'cancelled')),
  unique (dividend_id, shareholder_id)
);
create index if not exists dividend_payments_by_holder on public.dividend_payments (shareholder_id);

-- ---------------------------------------------------------------------------
--  Documents
--  shareholder_id null means the document belongs to everybody: an annual
--  report, a company policy. A document with a holder on it is private to that
--  holder, which is what a share certificate has to be.
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
--  What the Account page shows under sessions and login activity. The portal
--  writes a row when somebody signs in; nothing else may write here at all,
--  not even the person it is about, because a security log a user can edit is
--  not a security log.
-- ---------------------------------------------------------------------------
create table if not exists public.portal_activity (
  id             uuid primary key default gen_random_uuid(),
  shareholder_id uuid not null references public.shareholders(id) on delete cascade,
  kind           text not null,
  detail         text not null default '',
  device         text not null default '',
  created_at     timestamptz not null default now(),
  constraint portal_activity_kind check (kind in
    ('sign_in', 'sign_out', 'password_change', 'profile_change', 'mfa_enrolled', 'mfa_removed', 'document_view'))
);
create index if not exists portal_activity_by_holder on public.portal_activity (shareholder_id, created_at desc);

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

-- ===========================================================================
--  WHO IS ASKING
-- ===========================================================================

-- The signed in person's shareholder row, or null. security definer because
-- the policies on shareholders will call this, and a policy on a table that
-- queries the same table through the caller's own rights recurses for ever.
create or replace function public.current_shareholder_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id
    from public.shareholders s
   where s.user_email = lower(coalesce(auth.jwt() ->> 'email', ''))
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

--  Supabase grants every new function in `public` to anon by default, so
--  revoking from PUBLIC alone leaves that grant standing. Name anon as well.
--  authenticated keeps execute because the policies below call these, and a
--  policy is evaluated as the caller.
revoke all on function public.current_shareholder_id() from public, anon;
revoke all on function public.is_shareholder() from public, anon;
grant execute on function public.current_shareholder_id() to authenticated;
grant execute on function public.is_shareholder() to authenticated;

-- ===========================================================================
--  ROW LEVEL SECURITY
--
--  Read your own, read what is published to everyone, write almost nothing.
--  Administrators, decided by public.is_admin() from auth-schema.sql, write
--  everything. Anonymous visitors get none of this: nothing below is granted
--  to anon, so the publishable key on the public site cannot reach a single
--  row of it.
-- ===========================================================================
alter table public.share_classes      enable row level security;
alter table public.shareholders       enable row level security;
alter table public.holdings           enable row level security;
alter table public.transactions       enable row level security;
alter table public.valuations         enable row level security;
alter table public.dividends          enable row level security;
alter table public.dividend_payments  enable row level security;
alter table public.documents          enable row level security;
alter table public.updates            enable row level security;
alter table public.company_facts      enable row level security;
alter table public.portal_activity    enable row level security;

do $$
declare
  t text;
  p text;
  -- tables a shareholder may read only their own rows of
  mine text[] := array['holdings', 'transactions', 'dividend_payments', 'portal_activity'];
  -- tables any signed in shareholder may read in full
  shared text[] := array['share_classes', 'valuations', 'dividends', 'updates', 'company_facts'];
  -- every table an admin writes
  all_t text[] := array['share_classes', 'shareholders', 'holdings', 'transactions',
                        'valuations', 'dividends', 'dividend_payments', 'documents',
                        'updates', 'company_facts', 'portal_activity'];
begin
  -- start from a clean slate so this file can be re-run
  foreach t in array all_t loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
  end loop;

  -- ---- a holder reads their own -------------------------------------------
  foreach t in array mine loop
    execute format($p$create policy "holder reads own %1$s" on public.%1$I
                        for select to authenticated
                        using (shareholder_id = public.current_shareholder_id())$p$, t);
  end loop;

  -- ---- a holder reads what the company published --------------------------
  foreach t in array shared loop
    execute format($p$create policy "holder reads %1$s" on public.%1$I
                        for select to authenticated
                        using (public.is_shareholder() or public.is_admin())$p$, t);
  end loop;

  -- ---- administrators write everything ------------------------------------
  foreach t in array all_t loop
    execute format($p$create policy "admin reads every %1$s" on public.%1$I
                        for select to authenticated using (public.is_admin())$p$, t);
    execute format($p$create policy "admin writes %1$s" on public.%1$I
                        for insert to authenticated with check (public.is_admin())$p$, t);
    execute format($p$create policy "admin changes %1$s" on public.%1$I
                        for update to authenticated using (public.is_admin())
                        with check (public.is_admin())$p$, t);
    execute format($p$create policy "admin deletes %1$s" on public.%1$I
                        for delete to authenticated using (public.is_admin())$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- ---- shareholders: your own row, and the register ---------------------------
-- A holder reads their own row in full. Every other holder's row reaches them
-- only through the directory view further down, which carries no contact
-- details at all.
create policy "holder reads own record"
  on public.shareholders for select to authenticated
  using (id = public.current_shareholder_id());

-- The only write a shareholder is allowed anywhere in this schema. The columns
-- that decide what they own are not in it: a WITH CHECK cannot pin individual
-- columns, so the trigger below does, and refuses the update outright if
-- anything else moved.
create policy "holder edits own contact details"
  on public.shareholders for update to authenticated
  using (id = public.current_shareholder_id())
  with check (id = public.current_shareholder_id());

create or replace function public.guard_shareholder_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- an administrator may change anything
  if public.is_admin() then return new; end if;

  -- everyone else may change these three and nothing else
  if new.id             is distinct from old.id
  or new.user_email     is distinct from old.user_email
  or new.full_name      is distinct from old.full_name
  or new.investor_ref   is distinct from old.investor_ref
  or new.holder_type    is distinct from old.holder_type
  or new.status         is distinct from old.status
  or new.joined_on      is distinct from old.joined_on
  or new.created_at     is distinct from old.created_at then
    raise exception 'Only an administrator can change your name, reference or standing. '
                    'You may edit your phone, address, country and directory listing.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_shareholder_self_edit() from public, anon, authenticated;

drop trigger if exists shareholders_self_edit_guard on public.shareholders;
create trigger shareholders_self_edit_guard
  before update on public.shareholders
  for each row execute function public.guard_shareholder_self_edit();

-- ---- documents: yours, plus the ones addressed to everybody -----------------
create policy "holder reads own documents"
  on public.documents for select to authenticated
  using (
    published
    and (
      shareholder_id = public.current_shareholder_id()
      or (shareholder_id is null and public.is_shareholder())
    )
  );

-- ---- portal_activity: the portal records your own sign ins ------------------
-- Insert only, only about yourself. There is no update or delete policy for a
-- shareholder anywhere on this table, so a row here cannot be rewritten or
-- quietly removed by the person it describes.
create policy "holder records own activity"
  on public.portal_activity for insert to authenticated
  with check (shareholder_id = public.current_shareholder_id());

-- ===========================================================================
--  VIEWS
--
--  These run with the owner's rights, which is deliberate: a percentage needs
--  the total of everybody's shares, and no shareholder may read everybody's
--  rows. Each one therefore filters explicitly, and none of them selects a
--  contact column. Read every WHERE clause here as part of the security model,
--  because that is what it is.
-- ===========================================================================

-- Shares actually in issue: active lots only, so a cancelled or transferred
-- certificate stops counting the moment it stops being owned.
--  Both of these are company wide rather than personal, so neither filters by
--  who is asking. They still need a gate: without one, any account that can
--  sign in at all could read the internal share price and the total in issue.
create or replace view public.v_share_totals as
  select
    coalesce(sum(h.shares), 0)::bigint as total_shares,
    count(distinct h.shareholder_id)::int as holders
  from public.holdings h
  join public.shareholders s on s.id = h.shareholder_id
  where h.status = 'active' and s.status = 'active'
    and (public.is_shareholder() or public.is_admin());

create or replace view public.v_latest_valuation as
  select effective_on, price_per_share, total_valuation, method, note
    from public.valuations
   where published
     and (public.is_shareholder() or public.is_admin())
   order by effective_on desc
   limit 1;

-- The caller's own position, already aggregated and costed.
create or replace view public.v_my_position as
  select
    coalesce(sum(h.shares), 0)::bigint                            as shares,
    coalesce(sum(h.shares * h.unit_price), 0)::numeric(18,2)      as invested,
    (select total_shares from public.v_share_totals)              as total_shares,
    case when (select total_shares from public.v_share_totals) > 0
         then round(100.0 * coalesce(sum(h.shares), 0)
                    / (select total_shares from public.v_share_totals), 4)
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
create or replace view public.v_shareholder_directory as
  with totals as (select total_shares from public.v_share_totals),
  agg as (
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
    case when t.total_shares > 0
         then round(100.0 * a.shares / t.total_shares, 4) else 0 end as ownership_pct,
    rank() over (order by a.shares desc)::int as ranking,
    (a.id = public.current_shareholder_id()) as is_me
  from agg a cross join totals t
  where public.is_shareholder() or public.is_admin();

-- Only a shareholder or an admin reaches any of these. anon gets nothing.
revoke all on public.v_share_totals, public.v_latest_valuation,
              public.v_my_position, public.v_shareholder_directory from public, anon;
grant select on public.v_share_totals, public.v_latest_valuation,
                public.v_my_position, public.v_shareholder_directory to authenticated;

-- ===========================================================================
--  SEED
--  A realistic register, so every screen has something on it. Only when the
--  tables are empty: re-running this file must not double the cap table.
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

-- Holdings, transactions, valuations, dividends and documents all hang off the
-- two tables above, so they are seeded together in one block that looks the
-- references up by their natural keys rather than hard coding uuids.
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

  -- Each holder's slice of each dividend, worked out from what they held.
  -- 10% withholding, which is what the statements in Documents show.
  insert into public.dividend_payments (dividend_id, shareholder_id, eligible_shares, gross, tax_withheld, net, status, paid_on, reference)
  select
    d.id, x.sh, x.qty,
    round(x.qty * d.per_share, 2),
    round(x.qty * d.per_share * 0.10, 2),
    round(x.qty * d.per_share * 0.90, 2),
    case when d.status = 'paid' then 'paid' else 'pending' end,
    case when d.status = 'paid' then d.payment_date else null end,
    -- unique by construction: one dividend has one record date, and a holder
    -- appears once per dividend. Slicing a uuid instead could collide.
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
    ('Annual report 2025',                'annual_report', null, 'documents/annual-report-2025.pdf',        2360000, '2026-02-20'),
    ('Articles of association',           'company',       null, 'documents/articles-of-association.pdf',    410000, '2024-03-01'),
    ('Shareholder agreement 2024',        'agreement',     null, 'documents/shareholder-agreement-2024.pdf', 690000, '2024-03-01'),
    ('Board valuation note, January 2026','company',       null, 'documents/valuation-note-2026-01.pdf',     180000, '2026-01-31'),
    ('Share certificate HS-CERT-000001',  'certificate',   h1,   'documents/cert-000001.pdf',                 96000, '2024-03-01'),
    ('Share certificate HS-CERT-000012',  'certificate',   h1,   'documents/cert-000012.pdf',                 96000, '2025-02-18'),
    ('Share certificate HS-CERT-000019',  'certificate',   h1,   'documents/cert-000019.pdf',                 96000, '2025-07-09'),
    ('Subscription agreement, February 2025','agreement',  h1,   'documents/sub-agreement-h1-2025.pdf',      240000, '2025-02-18'),
    ('Dividend statement, interim 2025',  'dividend_statement', h1, 'documents/div-interim-2025-h1.pdf',      88000, '2025-09-05'),
    ('Tax certificate 2025 to 2026',      'tax',           h1,   'documents/tax-2025-26-h1.pdf',              74000, '2026-04-06'),
    ('Share certificate HS-CERT-000002',  'certificate',   h2,   'documents/cert-000002.pdf',                 96000, '2024-03-01'),
    ('Dividend statement, interim 2025',  'dividend_statement', h2, 'documents/div-interim-2025-h2.pdf',      88000, '2025-09-05');

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

-- ---------------------------------------------------------------------------
--  Check it worked.
-- ---------------------------------------------------------------------------
select 'share classes'  as "check", count(*)::text as result from public.share_classes
union all select 'shareholders',      count(*)::text from public.shareholders
union all select 'holdings',          count(*)::text from public.holdings
union all select 'transactions',      count(*)::text from public.transactions
union all select 'dividends',         count(*)::text from public.dividends
union all select 'dividend payments', count(*)::text from public.dividend_payments
union all select 'documents',         count(*)::text from public.documents
union all select 'updates',           count(*)::text from public.updates
union all select 'shares in issue',   (select total_shares::text from public.v_share_totals)
union all select 'policies',          count(*)::text from pg_policies
  where schemaname = 'public'
    and tablename in ('share_classes','shareholders','holdings','transactions','valuations',
                      'dividends','dividend_payments','documents','updates','company_facts',
                      'portal_activity');
