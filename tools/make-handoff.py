# -*- coding: utf-8 -*-
"""Build a clean copy of this site to give to someone else.

    python tools/make-handoff.py

Produces ../havestack-handoff/ and ../havestack-handoff.zip next to the
project folder.

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
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(ROOT), 'havestack-handoff')
ZIP = OUT + '.zip'

SKIP_DIRS = {'.git', 'ALL SKILLS', 'node_modules', '__pycache__', '.vercel'}
SKIP_FILES = {'background video.mp4', 'background video 2.mp4', '.DS_Store',
              'desktop.ini', 'Thumbs.db'}

README = """HaveStack site
==============

A static site. No build step, no dependencies, no package manager. Open
index.html in a browser and it works, including offline.

Pages
  index.html                  the site
  request.html                the meeting request form
  maintenance-*.html          four detail pages
  admin/                      admin panel, behind Google sign in

Before you deploy this as your own
----------------------------------

1. assets/site-config.js
   The Supabase values are blank. While they stay blank the request form
   collects the brief and hands it to the visitor's email client instead of
   posting it anywhere, and the admin panel says sign in is not configured.

   To turn both on, create a Supabase project and put its URL and publishable
   key here, then run these two files in its SQL editor:

     supabase/schema.sql        the meeting_requests table the form writes to
     supabase/auth-schema.sql   the admins allowlist the panel checks

   Edit the address at the bottom of auth-schema.sql to your own before you
   run it: that seeds the first admin, and there is no way to add one from
   inside the panel until one exists.

   Then in the Supabase dashboard, Authentication > Providers > Google: turn
   it on and paste in a client ID and secret from Google Cloud Console. Add
   your site's /admin/login.html to the redirect URLs.

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
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
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

    size = os.path.getsize(ZIP) / 1048576.0
    print('folder : %s' % OUT)
    print('zip    : %s  (%.1f MB, %d files)' % (ZIP, size, copied + 1))
    print('config : cleared')
    print('.git   : not included')


if __name__ == '__main__':
    build()
