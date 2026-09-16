# -*- coding: utf-8 -*-
"""Build a clean copy of this site to give to someone else.

    python tools/make-handoff.py

Produces havestack-handoff.zip inside the project folder. It is listed in
.gitignore so it never reaches the repository, and the build leaves it out of
the copy, so running this twice never puts the old zip inside the new one.

What it does, and why each part matters:

  Leaves out .git.       Without this the recipient opens the folder and finds
                         it still wired to this repository. Deleting .git after
                         the fact works, but it is easy to forget and easy to
                         get wrong.

  Clears the config.     assets/site-config.js is the only file holding values
                         specific to one deployment. Handed over unchanged, the
                         recipient's request form would write meeting requests
                         into this project's database. Cleared, the form falls
                         back to email and says so.

  Leaves out ALL SKILLS. Personal notes that have nothing to do with the site.

  Leaves out the video   assets/background video*.mp4 are the uncompressed
  masters.               originals. The site ships assets/hero.mp4, which is
                         encoded from them and is included.

  Writes a README.       So the recipient knows what to change before deploying.

Everything the site actually needs is included, and the result runs with no
internet connection: no image, font or script is loaded from another host.
"""
import os
import shutil
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP_NAME = 'havestack-handoff.zip'
ZIP = os.path.join(ROOT, ZIP_NAME)

SKIP_DIRS = {'.git', 'ALL SKILLS', 'node_modules', '__pycache__', '.vercel'}
# ZIP_NAME is listed because the zip lives in the folder being copied. Without
# it, every build would carry the previous zip inside the new one.
SKIP_FILES = {'background video.mp4', 'background video 2.mp4', '.DS_Store',
              'desktop.ini', 'Thumbs.db', ZIP_NAME}

README = """HaveStack site
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

   It also creates the site-media bucket and the site_images table behind the
   panel's Images page, where every picture on the public site can be replaced:
   the logo, the tab icon, the sharing card, the hero still, the photographs
   built into the layout, the capability and sector pictures, and the client
   and partner marks. An upload goes to storage and the row is pointed at it;
   the file in this folder is never touched, so "Undo" always works. Two
   pictures are read out of the markup by robots before any script runs, the
   sharing card and the logo given to search engines, so replacing those
   reaches people but not every crawler until the file here is replaced too.

   portal-schema.sql creates the share register: shareholders, holdings,
   transactions, dividends, valuations, documents and updates, with row level
   security that lets a shareholder read their own records and nothing else.
   It also holds the company's total shares, set under Register and access.
   Allotments come out of that total and are refused once it is used up; what
   is left over is unissued, and counts against everybody's percentage, so
   holders' ownership adds up to less than 100% until every share is allotted.
   Left at zero the total means "not stated", and percentages are worked out
   against the shares actually allotted instead.
   It seeds a realistic cap table so every screen in the portal has something
   on it. Replace those figures with your own, or delete the seed block at the
   bottom of the file before you run it. The two seeded shareholder addresses
   are the same two as in auth-schema.sql, so change them as well.

   The portal has its own sign in, separate from the admin panel. Somebody
   can use the same email address for both, but the portal password is a
   different password on a different account, and a panel admin is not let
   into the portal on that basis. Portal accounts are either holders, who see
   their own position, or portal administrators, who set the share price,
   run the register, record share movements, declare dividends, post
   announcements and publish documents. Everything a portal administrator
   does is written to an audit trail by the database itself.

   Much of it is automatic. Setting a share price revalues every holding and
   posts an update to every holder; open portals redraw without a reload.
   Declaring a dividend works out every holder's entitlement from the
   register on the record date, recalculates if shares move before then,
   and marks each line paid when the dividend is paid. Investor references,
   certificate numbers and transaction references are numbered for you, and
   a settled movement or a paid dividend cannot be edited afterwards.

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

   Deploy supabase/functions/portal-users the same way, named portal-users.
   It creates portal accounts, sets their passwords and switches them on or
   off. Then open /portal/setup.html once: sign in with your admin panel
   email and password, and choose a separate portal password. That makes you
   the first portal administrator, and the page refuses to run again once
   one exists. Give everybody else portal access from Register and access.

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
"""


def keep_dir(name):
    return name not in SKIP_DIRS


def build():
    # Staged in the system's temporary folder and removed afterwards. Staged
    # inside the project, the copy would find itself and copy itself.
    OUT = tempfile.mkdtemp(prefix='havestack-handoff-')
    copied = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if keep_dir(d)]
        rel = os.path.relpath(base, ROOT)
        if rel == '.':
            rel = ''
        target = os.path.join(OUT, rel)
        os.makedirs(target, exist_ok=True)
        for f in files:
            if f in SKIP_FILES:
                continue
            shutil.copy2(os.path.join(base, f), os.path.join(target, f))
            copied += 1

    # the one manual step of a handoff, done for you
    cfg = os.path.join(OUT, 'assets', 'site-config.js')
    if os.path.exists(cfg):
        with open(cfg, encoding='utf-8') as fh:
            s = fh.read()
        import re
        before = s
        s = re.sub(r"(supabaseUrl:\s*)'[^']*'", r"\1''", s)
        s = re.sub(r"(supabaseKey:\s*)'[^']*'", r"\1''", s)
        if s == before:
            print('WARNING: could not clear site-config.js, check it by hand')
        with open(cfg, 'w', encoding='utf-8', newline='') as fh:
            fh.write(s)

    with open(os.path.join(OUT, 'README.txt'), 'w', encoding='utf-8', newline='') as fh:
        fh.write(README)

    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(OUT):
            for f in files:
                p = os.path.join(base, f)
                z.write(p, os.path.join('havestack', os.path.relpath(p, OUT)))
    shutil.rmtree(OUT, ignore_errors=True)

    size = os.path.getsize(ZIP) / 1048576.0
    print('zip    : %s  (%.1f MB, %d files)' % (ZIP, size, copied + 1))
    print('config : cleared')
    print('.git   : not included')


if __name__ == '__main__':
    build()
