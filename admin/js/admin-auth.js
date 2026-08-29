/* =========================================================
   admin-auth.js
   ---------------------------------------------------------
   Sign in for the admin panel. Email and password through
   Supabase Auth, then an allowlist check against public.admins.

   Two checks, not one. The password proves the account is
   yours; the allowlist decides whether that account may open
   the panel. Keeping them separate means an address can be
   revoked in one place without touching the account, and it
   means an account that somehow exists but is not on the list
   gets nothing.

   The session is remembered. supabase-js keeps it in
   localStorage and refreshes the token in the background, so
   signing in once holds until you sign out or the refresh
   token expires.

   Accounts are created in the Supabase dashboard, not here.
   There is no sign up form on purpose: a panel that lets
   anybody create an account is a panel with a public door,
   even with an allowlist behind it.
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
          detectSessionInUrl: true   // needed for the password reset link
        }
      });
    }
    return _client;
  }

  /* Where a password reset link should land. Derived from the current location
     rather than hard coded, so the same build works on the deployment, on a
     preview URL and on localhost without edits. */
  function redirectTo() {
    var p = location.pathname;
    var dir = p.slice(0, p.lastIndexOf("/") + 1);
    return location.origin + dir + "login.html";
  }

  function signIn(email, password) {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "")
    });
  }

  function sendReset(email) {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.resetPasswordForEmail(
      String(email || "").trim().toLowerCase(),
      { redirectTo: redirectTo() }
    );
  }

  function updatePassword(password) {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.updateUser({ password: String(password || "") });
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
          "<h1>HaveStack Admin</h1>" +
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
    signIn: signIn,
    sendReset: sendReset,
    updatePassword: updatePassword,
    signOut: signOut,
    requireAdmin: requireAdmin,
    lookupAdmin: lookupAdmin,
    currentAdmin: currentAdmin,
    showUnconfigured: showUnconfigured
  };
})();
