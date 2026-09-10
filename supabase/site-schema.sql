-- ===========================================================================
--  HaveStack public page, under the admin panel's control
--  Run this once in the Supabase SQL editor, after auth-schema.sql.
--
--  Two tables. site_sections is one row per section of the public page and
--  decides whether that section is shown at all, whether it appears in the
--  navigation, and what its heading says. section_items is the repeated
--  blocks inside a section: the four conditions, the six sector tiles, the
--  five delivery steps, and so on.
--
--  Both are seeded with exactly what the page says today, so running this
--  changes nothing a visitor can see until somebody edits something.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Sections
--  `key` is the id the section already carries in the HTML, which is also
--  what the navigation links point at. Keeping them the same means hiding a
--  section and removing its nav link are the same decision.
-- ---------------------------------------------------------------------------
create table if not exists public.site_sections (
  key        text primary key,
  label      text not null,                 -- what the admin panel calls it
  nav_label  text not null default '',      -- what the nav link says
  kicker     text not null default '',
  heading    text not null default '',
  intro      text not null default '',
  note       text not null default '',
  item_noun  text not null default 'item',  -- what its rows are called
  sort       integer not null default 0,
  visible    boolean not null default true,
  in_nav     boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint site_sections_key_shape check (key ~ '^[a-z][a-z0-9-]{1,40}$')
);

-- ---------------------------------------------------------------------------
--  The repeated blocks inside a section
--  One table rather than eight, because they are the same shape: a mark, a
--  heading, a line of text, sometimes a list, sometimes a link or an image.
--  `item_key` is a stable handle for the few places the page needs one, such
--  as which capability tab a "see this" link jumps to.
-- ---------------------------------------------------------------------------
create table if not exists public.section_items (
  id          uuid primary key default gen_random_uuid(),
  section_key text not null references public.site_sections(key) on delete cascade,
  item_key    text not null default '',
  icon        text not null default '',
  title       text not null default '',
  body        text not null default '',
  bullets     text[] not null default '{}',
  link        text not null default '',
  image       text not null default '',
  meta        text not null default '',
  sort        integer not null default 0,
  published   boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint section_items_icon_shape check (icon = '' or icon ~ '^i-[a-z-]+$')
);
create index if not exists section_items_by_section
  on public.section_items (section_key, sort);

-- search_path is pinned so the function cannot be redirected at a schema the
-- caller controls, and nobody may call it directly: a trigger function is
-- called by its trigger.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists site_sections_touch on public.site_sections;
create trigger site_sections_touch before update on public.site_sections
  for each row execute function public.touch_updated_at();

drop trigger if exists section_items_touch on public.section_items;
create trigger section_items_touch before update on public.section_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  Settings
--  Only things that genuinely are settings. The practice name, the page
--  description and the domain are deliberately not here: a crawler reads the
--  head of index.html before any script runs, so a value kept in this table
--  would arrive too late to be the one indexed.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  label      text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "anyone reads site_settings"  on public.site_settings;
drop policy if exists "admins change site_settings" on public.site_settings;
drop policy if exists "admins write site_settings"  on public.site_settings;

create policy "anyone reads site_settings"
  on public.site_settings for select to anon using (true);
create policy "admins change site_settings"
  on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins write site_settings"
  on public.site_settings for insert to authenticated with check (public.is_admin());

grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;

insert into public.site_settings (key, value, label)
select * from (values
  ('contact_email', 'hello@havestack.tech', 'Contact address')
) as seed(key, value, label)
where not exists (select 1 from public.site_settings);

-- ---------------------------------------------------------------------------
--  Row level security
--  A visitor reads what is visible and published, and nothing else. A hidden
--  section is not merely styled away in the browser: it is never sent.
-- ---------------------------------------------------------------------------
alter table public.site_sections enable row level security;
alter table public.section_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['site_sections', 'section_items'] loop
    execute format('drop policy if exists "anyone reads %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins read every %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins change %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins delete %1$s" on public.%1$I', t);

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

create policy "anyone reads site_sections"
  on public.site_sections for select to anon using (visible);

-- An item is only public if it is published AND its section is visible, so a
-- hidden section cannot leak its contents through the other table.
create policy "anyone reads section_items"
  on public.section_items for select to anon
  using (
    published
    and exists (select 1 from public.site_sections s
                 where s.key = section_key and s.visible)
  );

-- ---------------------------------------------------------------------------
--  Seed: exactly what the page shows today. Only when empty, so a re-run of
--  this file cannot duplicate or overwrite edits already made.
-- ---------------------------------------------------------------------------
insert into public.site_sections
  (key, label, nav_label, kicker, heading, intro, note, item_noun, sort)
select * from (values
  ('about', 'Mandate', 'Mandate', 'Mandate', 'How HaveStack takes on work.', 'Four conditions apply before an engagement opens.', 'HaveStack works with anyone who needs a system built properly. Business to business engagements are scheduled first, because they arrive with a named owner, a defined scope and a budget, which is what lets the practice commit to a delivery date.', 'condition', 10),
  ('services', 'Capabilities', 'Capabilities', '', 'What the practice builds.', 'Five practice areas, each carried from specification to live service.', '', 'practice area', 20),
  ('maintenance', 'Maintenance', 'Maintenance', '', 'Systems under management.', 'A system does not end at launch. HaveStack keeps the parts that fail quietly in good order.', '', 'domain', 30),
  ('products', 'Products', 'Products', 'Products', 'Software we run ourselves.', 'Products built and operated in house, on the same standards as client work.', '', 'product', 40),
  ('work', 'Clients', 'Clients', '', 'Organisations we build for.', 'Named with their agreement. Further references are available under a non disclosure agreement.', '', 'client', 50),
  ('partners', 'Partners', 'Partners', '', 'Official partners.', 'Organisations and institutions that work alongside the practice.', '', 'partner', 60),
  ('sectors', 'Sectors', 'Sectors', '', 'Where these systems run.', 'Six sectors where a failure is expensive.', '', 'sector', 70),
  ('process', 'Delivery', 'Delivery', 'Delivery', 'How an engagement runs.', 'Five stages, each closing on a written output.', '', 'stage', 80),
  ('standards', 'Standards', 'Standards', '', 'What HaveStack commits to in writing.', 'Twelve commitments, written into every engagement contract.', '', 'commitment', 90),
  ('clients', 'Governance', 'Governance', '', 'Governance and standing.', '', '', 'organisation', 100),
  ('book', 'Request a meeting', '', 'Engagement', 'Start with a meeting.', '', '', 'item', 110)
) as seed(key, label, nav_label, kicker, heading, intro, note, item_noun, sort)
where not exists (select 1 from public.site_sections);

insert into public.section_items
  (section_key, item_key, icon, title, body, bullets, link, image, meta, sort)
select * from (values
  ('about', '', 'i-buildings', 'Business first', 'Open to any organisation. Business and institutional engagements take priority.', '{}'::text[], '', '', '', 10),
  ('about', '', 'i-squares-four', 'Systems, not brochure sites', 'Operational software that holds records and enforces workflow.', '{}'::text[], '', '', '', 20),
  ('about', '', 'i-seal-check', 'A named owner', 'One person on the client side approves scope and signs acceptance.', '{}'::text[], '', '', '', 30),
  ('about', '', 'i-scales', 'A defined budget', 'Cost follows scope and is agreed in writing. No price list is published.', '{}'::text[], '', '', '', 40),
  ('services', 'erp', '', 'Enterprise resource planning', 'One authoritative record of finance, procurement, inventory and payroll, with approval chains enforced in software.', array['General ledger', 'Procurement', 'Inventory', 'Payroll']::text[], '', 'assets/cap-erp.jpg', 'Resource planning', 10),
  ('services', 'learning', '', 'Learning platforms', 'Course delivery, assessment and certification engineered to carry full cohorts through an academic term.', array['Course delivery', 'Assessment', 'Certification', 'Transcripts']::text[], '', 'assets/cap-learning.jpg', 'Learning', 20),
  ('services', 'public', '', 'Public facing platforms', 'Citizen facing services provisioned for a defined peak load and proven against it before release.', array['Service intake', 'Payments', 'Case tracking', 'Accessibility']::text[], '', 'assets/cap-public.jpg', 'Public services', 30),
  ('services', 'integration', '', 'Integration and internal tooling', 'Interfaces between the platforms an institution already runs, governed by a documented data contract.', array['Interface layer', 'Data migration', 'Admin consoles', 'Reporting']::text[], '', 'assets/cap-integration.jpg', 'Integration', 40),
  ('services', 'managed', '', 'Managed operations', 'Monitoring, release management, recovery and a named escalation route under a service agreement.', array['Monitoring', 'Releases', 'Recovery', 'Escalation']::text[], '', 'assets/cap-managed.jpg', 'Managed operations', 50),
  ('maintenance', '', 'i-brain', 'AI and language models', '', array['Model versions pinned, upgrades tested before they land', 'Prompt and output checked against a fixed evaluation set', 'Token spend tracked with a monthly ceiling', 'Fallback routing when a provider degrades', 'Retrieval sources re indexed on a schedule']::text[], 'maintenance-ai.html', '', 'op-ai', 10),
  ('maintenance', '', 'i-hard-drives', 'Databases', '', array['Backups taken on schedule and restored in a drill', 'Slow queries traced, indexes rebuilt', 'Migrations applied with a written rollback', 'Replication and failover verified', 'Growth watched before storage runs out']::text[], 'maintenance-databases.html', '', 'op-data', 20),
  ('maintenance', '', 'i-cpu', 'Backend and infrastructure', '', array['Dependencies patched, advisories reviewed weekly', 'Certificates and domains renewed ahead of expiry', 'Uptime and error rates alerted to a named contact', 'Capacity reviewed against measured load', 'Logs retained for the period the contract sets']::text[], 'maintenance-backend.html', '', 'op-infra', 30),
  ('maintenance', '', 'i-clock-counter-clockwise', 'Response and reporting', '', array['Response times set in the service agreement', 'Incidents written up with cause and correction', 'Releases scheduled, never applied unannounced', 'A monthly report the client can file', 'Access reviewed each quarter']::text[], 'maintenance-response.html', '', 'op-report', 40),
  ('sectors', '', '', 'Government and public administration', 'Registries, service delivery and internal administration.', '{}'::text[], '', 'assets/sector-government.jpg', 'sc-a', 10),
  ('sectors', '', '', 'Banking and NBFI', 'Origination, servicing and regulatory reporting.', '{}'::text[], '', 'assets/sector-banking.jpg', 'sc-b', 20),
  ('sectors', '', '', 'Education', 'Admissions and academic records.', '{}'::text[], '', 'assets/sector-education.jpg', 'sc-c', 30),
  ('sectors', '', '', 'Healthcare', 'Patient administration under access control.', '{}'::text[], '', 'assets/sector-healthcare.jpg', 'sc-d', 40),
  ('sectors', '', '', 'Real estate and construction', 'Cost control and handover records.', '{}'::text[], '', 'assets/sector-realestate.jpg', 'sc-e', 50),
  ('sectors', '', '', 'Development and NGO', 'Programme monitoring and donor reporting.', '{}'::text[], '', 'assets/sector-ngo.jpg', 'sc-f', 60),
  ('process', '', 'i-magnifying-glass', 'Discovery', 'The practice records how the organisation operates today.', '{}'::text[], '', '', 'Scope document', 10),
  ('process', '', 'i-compass-tool', 'Architecture', 'Data model, integrations and hosting fixed before any code.', '{}'::text[], '', '', 'Technical specification', 20),
  ('process', '', 'i-code', 'Build', 'Delivery in reviewable increments against agreed scope.', '{}'::text[], '', '', 'Accepted release', 30),
  ('process', '', 'i-handshake', 'Handover', 'Source, credentials and documentation transfer to the client.', '{}'::text[], '', '', 'Operations manual', 40),
  ('process', '', 'i-pulse', 'Operations', 'Monitored and maintained under a service agreement.', '{}'::text[], '', '', 'Service report', 50),
  ('standards', '', 'i-file-text', 'Delivery and documentation', '', array['Written scope before any code', 'Client read access to the repository', 'One configuration across development, staging and production', 'Each stage accepted against the written specification']::text[], '', '', '', 10),
  ('standards', '', 'i-lock-key', 'Security and access', '', array['Least privilege on every account and integration', 'Encryption in transit and at rest', 'Audit trail on every record change', 'Access withdrawn the working day someone leaves']::text[], '', '', '', 20),
  ('standards', '', 'i-key', 'Ownership and continuity', '', array['Intellectual property transfers on final payment', 'Hosting, domains and repositories in the client name', 'Established open technology, documented for another team', 'A notice period and a defined exit process']::text[], '', '', '', 30),
  ('clients', '', '', 'HaveStack Technologies', '', '{}'::text[], '', '', 'Software practice|self', 10),
  ('clients', '', '', 'Amaze Consortium', '', '{}'::text[], '', '', 'Parent', 20),
  ('clients', '', '', 'ARIES', '', '{}'::text[], '', '', 'Partner, research and exploration society', 30),
  ('clients', 'fact', '', 'Practice', 'Independent', '{}'::text[], '', '', 'fact', 110),
  ('clients', 'fact', '', 'Partners', 'Amaze, ARIES', '{}'::text[], '', '', 'fact', 120),
  ('clients', 'fact', '', 'Base', 'Dhaka, Bangladesh', '{}'::text[], '', '', 'fact', 130),
  ('clients', 'fact', '', 'Field', 'Enterprise software', '{}'::text[], '', '', 'fact', 140),
  ('clients', 'standing', '', 'Corporate standing', 'HaveStack is an enterprise software practice working in partnership with Amaze Consortium and with ARIES, its research and exploration society.

Those relationships give an institutional buyer more than one organisation to examine, and continuity that does not rest on any one individual.', '{}'::text[], '', '', 'standing', 5)
) as seed(section_key, item_key, icon, title, body, bullets, link, image, meta, sort)
where not exists (select 1 from public.section_items);

-- ---------------------------------------------------------------------------
--  Check it worked.
-- ---------------------------------------------------------------------------
select 'sections' as "check", count(*)::text as result from public.site_sections
union all select 'hidden sections', count(*)::text from public.site_sections where not visible
union all select 'section items',   count(*)::text from public.section_items
union all select 'policies',        count(*)::text from pg_policies
  where schemaname = 'public' and tablename in ('site_sections', 'section_items');
