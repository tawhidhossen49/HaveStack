HaveStack site
==============

A static site. No build step, no dependencies, no package manager. Open
index.html in a browser and it works, including offline.

Pages
  index.html                  the site
  request.html                the meeting request form
  maintenance-*.html          four detail pages
  admin/                      admin panel, behind email and password
  portal/                     shareholder portal, behind email and password

  Both signed in areas share assets/console.css and assets/console-ui.js, which
  carry the chrome they have in common. Each keeps its own navigation, its own
  sign in and its own data. Editing one does not change the other.

Before you deploy this as your own
----------------------------------

1. assets/site-config.js
   The Supabase values are blank. While they stay blank the request form
   collects the brief and hands it to the visitor's email client instead of
   posting it anywhere, and the admin panel says sign in is not configured.

   To turn both on, create a Supabase project and put its URL and publishable
   key here, then run these five files in its SQL editor, in this order:

     supabase/schema.sql         the meeting_requests table the form writes to
     supabase/auth-schema.sql    the admins allowlist the panel checks
     supabase/content-schema.sql the products and organisations the panel edits
     supabase/site-schema.sql    the sections of the public page, and which of
                                 them are shown
     supabase/portal-schema.sql  the share register the portal reads

   content-schema.sql is seeded with what the page already shows, so running
   it changes nothing you can see. From then on the Products and the Clients
   and partners pages in the admin panel edit the real site: a change appears
   on the public page the next time somebody loads it. Until you run it, the
   panel says it cannot read those tables and the public page keeps showing
   the content written into index.html, which is the same content.

   site-schema.sql is what puts the public page under the panel's control.
   Every section of index.html gets a row, and the panel can hide any of them:
   a hidden section is not sent to visitors at all, and its link disappears
   from the menu at the same time. It is seeded with what the page already
   says, so running it changes nothing until you edit something.

   portal-schema.sql creates the share register: shareholders, holdings,
   transactions, dividends, valuations, documents and updates, with row level
   security that lets a shareholder read their own records and nothing else.
   It seeds a realistic cap table so every screen in the portal has something
   on it. Replace those figures with your own, or delete the seed block at the
   bottom of the file before you run it. The two seeded shareholder addresses
   are the same two as in auth-schema.sql, so change them as well.

   A person is a shareholder because there is a row for their address in
   public.shareholders, and an administrator because there is a row in
   public.admins. The two are independent: somebody can be either, both or
   neither, and giving somebody the portal does not give them the panel.

   Edit the address at the bottom of auth-schema.sql to your own before you
   run it: that seeds the first admin, and there is no way to add one from
   inside the panel until one exists.

   Then in the Supabase dashboard, Authentication > Sign In / Providers: leave
   Email on and turn off "Allow new users to sign up", so the only accounts
   are the ones an admin creates. Under URL Configuration set the Site URL and
   add your /admin/login.html to the redirect URLs, which is where a password
   reset link returns to.

   Last, deploy the edge function in supabase/functions/admin-users. In the
   dashboard: Edge Functions, create one named admin-users, paste in
   index.ts, Deploy. Nothing to configure; the keys it needs are injected.
   That function is what lets the panel create an account with a password you
   choose. Without it the panel still signs people in, but Settings > Access
   can only read the list.

   Change contactEmail to your own address. It is where briefs go when there
   is no database, and it is shown in the footer.

2. Search for havestack.tech
   It appears in the canonical link, the social card tags and the structured
   data at the top of each page. Replace it with your own domain.

3. assets/mark-*.png and assets/logo-*.png
   The organisation marks in the clients and partners rows, and the HaveStack
   mark in the header. Replace with your own.

4. vercel.json
   Only needed on Vercel. It adds the trailing slash to extensionless paths,
   without which /admin loads but cannot find its own stylesheet or scripts.
   Harmless on other hosts, which ignore it.

Running it locally
------------------

Opening index.html directly works. If you want a local server so that paths
behave exactly as they will in production:

    python -m http.server 8000

then visit http://localhost:8000
