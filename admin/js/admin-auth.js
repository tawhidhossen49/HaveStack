/* =========================================================
   admin-auth.js
   ---------------------------------------------------------
   Sign in for the admin panel. Google through Supabase Auth,
   then an allowlist check against public.admins.

   Signing in with Google proves who somebody is. It does not
   prove they are allowed in, because anybody with a Google
   account can complete that sign in. So every page runs two
   checks: is there a session, and is that session's address
   on the list. Failing the first sends you to login, failing
   the second signs you back out.

   The session is remembered. supabase-js keeps it in
   localStorage and refreshes the token in the background, so
   signing in once holds until you sign out or the refresh
   token expires.
   ========================================================= */
window.AdminAuth = (function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var URL_ = CFG.supabaseUrl || "";
  var KEY_ = CFG.supabaseKey || "";

  var _client = null;
  var _admin = null;   // the row from public.admins once verified

  function configured() {
    return !!(URL_ && KEY_ && window.supabase && window.supabase.createClient);
  }

  function client() {
    if (!configured()) return null;
    if (!_client) {
      _client = window.supabase.createClient(URL_, KEY_, {
        auth: {
          persistSession: true,      // remember me across visits
          autoRefreshToken: true,    // and keep the token alive while here
          detectSessionInUrl: true   // pick the session out of the OAuth redirect
        }
      });
    }
    return _client;
  }

  /* Where Google should send the browser back to. Derived from the current
     location rather than hard coded, so the same build works on the
     deployment, on a preview URL and on localhost without edits. */
  function redirectTo() {
    var p = location.pathname;
    var dir = p.slice(0, p.lastIndexOf("/") + 1);
    return location.origin + dir + "login.html";
  }

  function signInWithGoogle() {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo(),
        // ask Google for a refresh token and let the account be chosen, rather
        // than silently reusing whichever one the browser last used
        queryParams: { access_type: "offline", prompt: "select_account" }
      }
    });
  }

  function signOut() {
    var c = client();
    if (!c) { location.href = "login.html"; return Promise.resolve(); }
    return c.auth.signOut().then(function () { location.href = "login.html"; });
  }

  /* Is this session on the allowlist?
     Returns the admins row, or null. A null with no error means signed in but
     not permitted, which is a different thing from not signed in at all. */
  function lookupAdmin(session) {
    var c = client();
    var email = (session.user && session.user.email || "").toLowerCase();
    if (!email) return Promise.resolve(null);
    return c.from("admins").select("email,full_name").eq("email", email).maybeSingle()
      .then(function (r) { return r.error ? null : r.data; });
  }

  /* Called at the top of every protected page. Resolves with the admin row, or
     redirects and never resolves. */
  function requireAdmin() {
    if (!configured()) { showUnconfigured(); return new Promise(function () {}); }
    var c = client();
    return c.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { location.replace("login.html"); return new Promise(function () {}); }
      return lookupAdmin(session).then(function (row) {
        if (!row) {
          // signed in, but not on the list. Do not leave a half authenticated
          // session lying around.
          return c.auth.signOut().then(function () {
            location.replace("login.html?denied=1");
            return new Promise(function () {});
          });
        }
        _admin = row;
        return row;
      });
    });
  }

  function currentAdmin() { return _admin; }

  /* Shown instead of the panel when site-config has no Supabase values, which
     is how a handed over copy arrives. */
  function showUnconfigured() {
    document.body.innerHTML =
      '<main class="login"><div class="login-card">' +
        '<div class="login-brand">' +
          '<img src="../assets/logo-mark-96.png" alt="" width="26" height="26" />' +
          "<b>HaveStack Admin</b>" +
        "</div>" +
        '<p class="lead">Sign in is not configured.</p>' +
        '<div class="notice" style="border-left-color:var(--line-3)"><p>' +
          "Put your Supabase project URL and publishable key into " +
          "<code>assets/site-config.js</code>, then run " +
          "<code>supabase/auth-schema.sql</code> in the SQL editor to create the " +
          "list of permitted addresses." +
        "</p></div>" +
        '<a class="btn btn-block btn-sm" href="../index.html">Back to the site</a>' +
      "</div></main>";
  }

  return {
    configured: configured,
    client: client,
    redirectTo: redirectTo,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    requireAdmin: requireAdmin,
    currentAdmin: currentAdmin,
    showUnconfigured: showUnconfigured
  };
})();
