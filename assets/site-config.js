/* =========================================================
   site-config.js
   ---------------------------------------------------------
   The only file in this project that holds anything specific
   to one deployment. Everything else is the site itself.

   HANDING THIS PROJECT TO SOMEONE ELSE
   Clear the two Supabase values below before you zip the
   folder up, or their copy of the request form will write
   meeting requests into your database. With them blank the
   form still works: it detects that no backend is configured
   and sends the brief by email instead.

   The publishable key is designed to be public and it permits
   exactly one thing, adding a row to meeting_requests. Reading,
   updating and deleting are refused by the row level security
   policy, so this file never exposes past submissions. It is
   still yours, and it still points at your project.
   ========================================================= */
window.SITE_CONFIG = {
  /* Supabase project the request form posts to. Leave both empty to fall
     back to email. */
  supabaseUrl: 'https://dnuqhgrxgthfbatnagbm.supabase.co',
  supabaseKey: 'sb_publishable_nTzfhETJm69WQfq_7oicfw_TsJuY99r',

  /* Where a brief goes when there is no backend, and the address shown
     throughout the site. */
  contactEmail: 'hello@havestack.tech'
};
