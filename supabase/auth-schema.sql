-- ===========================================================================
--  HaveStack admin access
--  Run this once in the Supabase SQL editor.
--
--  Google sign in on its own proves who somebody is, not that they are allowed
--  in. Anybody with a Google account could complete the sign in. This table is
--  the allowlist: an address has to be in it before the panel will open, and
--  an address can be added before that person has ever signed in.
-- ===========================================================================

create table if not exists public.admins (
  email      text primary key,
  full_name  text,
  added_at   timestamptz not null default now(),
  added_by   text,
  -- addresses are compared lower cased everywhere; store them that way so the
  -- primary key cannot hold Me@x.com and me@x.com as two different admins
  constraint admins_email_lower check (email = lower(email)),
  constraint admins_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

comment on table public.admins is
  'Addresses permitted to open the admin panel. Checked after Google sign in.';

-- ---------------------------------------------------------------------------
--  is_admin(): does the caller's signed in address appear above?
--
--  security definer so it reads the table with the owner's rights. Without
--  that, a policy on admins that queries admins recurses forever. search_path
--  is pinned so the function cannot be redirected at a schema the caller
--  controls.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.admins a
     where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
--  Row level security
--  Nobody reaches this table without being on it. Admins can see the whole
--  list and manage each other, which is what makes "add my friend" possible
--  from inside the panel rather than from the dashboard.
-- ---------------------------------------------------------------------------
alter table public.admins enable row level security;

drop policy if exists "admins read the list"   on public.admins;
drop policy if exists "admins add an admin"    on public.admins;
drop policy if exists "admins remove an admin" on public.admins;
drop policy if exists "admins rename an admin" on public.admins;

create policy "admins read the list"
  on public.admins for select
  to authenticated
  using (public.is_admin());

create policy "admins add an admin"
  on public.admins for insert
  to authenticated
  with check (public.is_admin());

create policy "admins rename an admin"
  on public.admins for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- An admin may remove anyone except themselves. Removing yourself while you
-- are the only admin would lock the panel with no way back in.
create policy "admins remove an admin"
  on public.admins for delete
  to authenticated
  using (
    public.is_admin()
    and email <> lower(coalesce(auth.jwt() ->> 'email', ''))
  );

revoke all on public.admins from anon;
grant select, insert, update, delete on public.admins to authenticated;

-- ---------------------------------------------------------------------------
--  The first admin
--  There is no way to add one from inside the panel until one exists, so seed
--  it here. Change the address, then run the file.
-- ---------------------------------------------------------------------------
insert into public.admins (email, full_name, added_by)
values ('tawhidhossen449@gmail.com', 'SK Tawhid Hossen', 'seed')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
--  Reading meeting requests from the panel
--  The public form can insert and nothing else. This lets a signed in admin
--  read what was submitted, which the requests page needs.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.meeting_requests') is null then
    raise notice 'meeting_requests not found, skipping. Run schema.sql first if you want the requests page to read submissions.';
    return;
  end if;

  execute 'drop policy if exists "admins read meeting requests" on public.meeting_requests';
  execute 'create policy "admins read meeting requests"
             on public.meeting_requests for select
             to authenticated
             using (public.is_admin())';
  execute 'grant select on public.meeting_requests to authenticated';
end
$$;

-- ---------------------------------------------------------------------------
--  Check it worked. You should get three rows: an admin count of at least 1,
--  is_admin() present, and four policies.
--  "check" is a reserved word, hence the quoting.
-- ---------------------------------------------------------------------------
select 'admins in the list' as "check", count(*)::text as result from public.admins
union all
select 'is_admin() exists',
       case when to_regprocedure('public.is_admin()') is null then 'MISSING' else 'yes' end
union all
select 'policies on admins', count(*)::text from pg_policies
 where schemaname = 'public' and tablename = 'admins';
