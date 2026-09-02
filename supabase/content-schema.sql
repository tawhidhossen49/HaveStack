-- ===========================================================================
--  HaveStack editable content
--  Run this once in the Supabase SQL editor, after auth-schema.sql.
--
--  These two tables back the Products index and the Clients and Partners
--  registers on the public page. Anyone may read them, because the public site
--  does; only an admin may write, which public.is_admin() decides.
--
--  Both are seeded with exactly what the page shows today, so turning this on
--  changes nothing visible until somebody edits something.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  blurb       text not null default '',
  -- the mark shown at the left of the row, one of the sprite symbol ids
  icon        text not null default 'i-database',
  -- null means the row shows its "not yet public" state instead of a link
  link        text,
  state_label text not null default 'Not yet public',
  sort        integer not null default 0,
  published   boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint products_name_len check (char_length(name) between 1 and 120),
  constraint products_icon_shape check (icon ~ '^i-[a-z-]+$'),
  constraint products_link_shape check (link is null or link ~ '^https?://')
);

-- ---------------------------------------------------------------------------
--  Clients and partners
--  One table, not two. They differ by which register they appear in, which is
--  a column, not a different kind of thing.
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  register   text not null,
  mark       text not null,               -- path under assets/
  mark_w     integer not null default 160,
  mark_h     integer not null default 160,
  sort       integer not null default 0,
  published  boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint organisations_register check (register in ('client', 'partner')),
  constraint organisations_name_len check (char_length(name) between 1 and 120),
  constraint organisations_mark_shape check (mark ~ '^[A-Za-z0-9._/-]+\.(png|jpg|jpeg|svg|webp)$')
);

-- keep updated_at honest without the client having to remember
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists organisations_touch on public.organisations;
create trigger organisations_touch before update on public.organisations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Row level security
--  Read is open because this is what the public page displays. Write is for
--  admins only. Anonymous visitors see published rows and nothing else, so a
--  draft is genuinely invisible rather than merely unstyled.
-- ---------------------------------------------------------------------------
alter table public.products      enable row level security;
alter table public.organisations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products', 'organisations'] loop
    execute format('drop policy if exists "anyone reads published %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins read every %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins change %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins delete %1$s" on public.%1$I', t);

    execute format($p$create policy "anyone reads published %1$s" on public.%1$I
                        for select to anon using (published)$p$, t);
    execute format($p$create policy "admins read every %1$s" on public.%1$I
                        for select to authenticated using (public.is_admin())$p$, t);
    execute format($p$create policy "admins write %1$s" on public.%1$I
                        for insert to authenticated with check (public.is_admin())$p$, t);
    execute format($p$create policy "admins change %1$s" on public.%1$I
                        for update to authenticated using (public.is_admin())
                        with check (public.is_admin())$p$, t);
    execute format($p$create policy "admins delete %1$s" on public.%1$I
                        for delete to authenticated using (public.is_admin())$p$, t);

    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
--  Seed: exactly what the page shows today.
--
--  Only when the table is empty. These rows have no natural unique key, so
--  "on conflict do nothing" would not catch anything: every insert generates a
--  fresh id and conflicts with nothing. Running this file a second time would
--  quietly double the index. The guard below makes a re-run a no-op, which
--  matters because re-running a schema file is a normal thing to do.
-- ---------------------------------------------------------------------------
insert into public.products (name, blurb, icon, sort)
select * from (values
  ('Resource planning suite', 'Ledger, procurement and stores for mid sized institutions.',        'i-database',               10),
  ('Learning platform',       'Course delivery, assessment and transcripts for training bodies.',  'i-graduation-cap',         20),
  ('Service intake portal',   'Application intake and case tracking for public counters.',         'i-globe-hemisphere-west',  30),
  ('Interface layer',         'Moves records between systems under a fixed contract.',             'i-plugs-connected',        40),
  ('Operations console',      'Monitoring, release and recovery for systems under management.',    'i-gauge',                  50)
) as seed(name, blurb, icon, sort)
where not exists (select 1 from public.products);

insert into public.organisations (name, register, mark, mark_w, mark_h, sort)
select * from (values
  ('Gungchil',                     'client',  'assets/mark-gungchil.png',  254, 160, 10),
  ('Avane Labs',                   'partner', 'assets/mark-avane.png',     766, 160, 10),
  ('ARIES',                        'partner', 'assets/mark-aries.png',     162, 160, 20),
  ('Amaze Youth Chess Tournament', 'partner', 'assets/mark-ayct.png',     1024, 160, 30),
  ('First Principles',             'partner', 'assets/mark-fp.png',        601, 160, 40),
  ('The Outliers Club',            'partner', 'assets/mark-toc.png',       901, 160, 50)
) as seed(name, register, mark, mark_w, mark_h, sort)
where not exists (select 1 from public.organisations);

-- ---------------------------------------------------------------------------
--  Check it worked.
-- ---------------------------------------------------------------------------
select 'products' as "table", count(*)::text as rows from public.products
union all
select 'organisations', count(*)::text from public.organisations
union all
select 'policies', count(*)::text from pg_policies
 where schemaname = 'public' and tablename in ('products', 'organisations');
