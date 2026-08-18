-- ============================================================================
-- HaveStack: meeting requests
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It is safe to run once. Running it twice will error on the create table,
-- which is intentional: it stops you silently rebuilding a live table.
--
-- The form is public, so anyone can call the API with the publishable key.
-- The protection is Row Level Security: anonymous visitors may INSERT and
-- nothing else. There is deliberately no SELECT policy, so submissions cannot
-- be read back through the API by anyone. You read them in the dashboard.
-- ============================================================================

create table public.meeting_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  reference        text not null unique,          -- HS-YYYYMMDD-XXXX, shown to the sender
  organisation     text not null,
  sector           text not null,
  full_name        text not null,
  role             text not null,
  email            text not null,
  named_owner      text not null,
  system_required  text not null,
  intended_start   text not null,
  brief            text not null,

  status           text not null default 'new',   -- your workflow, not the sender's
  notes            text,                          -- for you, after the meeting

  -- Honeypot. The form renders a hidden field that a human never sees and
  -- never fills. Bots fill every field they find. Enforcing it here rather
  -- than only in JavaScript means a bot posting straight to the API is still
  -- rejected, by Postgres, before anything is written.
  trap             text
);

-- ---------------------------------------------------------------------------
-- Validation. The browser already checks these, but a public endpoint has to
-- assume the browser was bypassed, so the same rules are enforced again here.
-- ---------------------------------------------------------------------------
alter table public.meeting_requests
  add constraint reference_fmt   check (reference ~ '^HS-[0-9]{8}-[0-9A-Z]{4}$'),
  add constraint organisation_len check (char_length(organisation) between 2 and 200),
  add constraint full_name_len    check (char_length(full_name)    between 2 and 120),
  add constraint role_len         check (char_length(role)         between 2 and 120),
  add constraint email_fmt        check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
                                         and char_length(email) <= 254),
  add constraint brief_len        check (char_length(brief) between 20 and 4000),
  add constraint notes_len        check (notes is null or char_length(notes) <= 8000),

  add constraint sector_ok check (sector in (
    'Government','Banking and NBFI','Education','Healthcare',
    'Real estate','Development and NGO','Other')),

  add constraint named_owner_ok check (named_owner in (
    'Yes, I hold sign off','No, I am gathering options','Not yet decided')),

  add constraint system_required_ok check (system_required in (
    'Resource planning','Learning platform','Public platform','Integration',
    'Maintenance of an existing system','Undecided')),

  add constraint intended_start_ok check (intended_start in (
    'Within a month','One to three months','Three to six months','Later','Undecided')),

  add constraint status_ok check (status in ('new','contacted','scheduled','declined','closed')),

  -- a filled honeypot is a bot, so refuse the row outright
  add constraint trap_empty check (trap is null or trap = '');

-- reading the queue newest first, and filtering by state
create index meeting_requests_created_idx on public.meeting_requests (created_at desc);
create index meeting_requests_status_idx  on public.meeting_requests (status);

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------
alter table public.meeting_requests enable row level security;

-- Explicit grants alongside RLS. Two independent locks rather than one.
revoke all on public.meeting_requests from anon;
grant insert on public.meeting_requests to anon;

-- The only thing the public may do. The with check clause also stops a
-- submitter setting their own status or smuggling a value into the honeypot.
create policy "anonymous visitors may submit a request"
  on public.meeting_requests
  for insert
  to anon
  with check (
    status = 'new'
    and (trap is null or trap = '')
  );

-- No select, update or delete policy exists, so all three are denied for anon.
-- Your dashboard uses a privileged connection and is unaffected.
