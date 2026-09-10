/* =========================================================
   portal-auth.js
   ---------------------------------------------------------
   Sign in for the shareholder portal. Email and password
   through Supabase Auth, then a lookup against
   public.shareholders.

   The same two step shape as the admin panel, deliberately,
   but against a different table. The password proves the
   account is yours; the shareholders row decides whether that
   account owns anything. An address can therefore be a
   shareholder, an administrator, both, or neither, and none
   of those four cases needs the others to change.

   A holder whose status is no longer 'active' fails the
   second step. They keep their account and lose the portal,
   which is what happens when somebody exits the register.

   There is no sign up. Accounts are created by an
   administrator, because a portal that lets a stranger create
   one is a portal with a public door onto a share register.
   ========================================================= */
window.PortalAuth = (function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var URL_ = CFG.supabaseUrl || "";
  var KEY_ = CFG.supabaseKey || "";

  var _client = null;
  var _holder = null;   // the row from public.shareholders once verified
  var _session = null;  // kept so a lookup need not fetch it twice

  function configured() {
    return !!(URL_ && KEY_ && window.supabase && window.supabase.createClient);
  }

  function client() {
    if (!configured()) return null;
    if (!_client) {
      _client = window.supabase.createClient(URL_, KEY_, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,   // the password reset link lands here
          storageKey: "hs-portal-auth"
        }
      });
    }
    return _client;
  }

  /* Where a reset link should return to. Derived from the current location so
     the same build works on the deployment, on a preview URL and on localhost. */
  function redirectTo() {
    var p = location.pathname;
    return location.origin + p.slice(0, p.lastIndexOf("/") + 1) + "login.html";
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
      String(email || "").trim().toLowerCase(), { redirectTo: redirectTo() });
  }

  function updatePassword(password) {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.updateUser({ password: String(password || "") });
  }

  function signOut() {
    var c = client();
    if (!c) { location.href = "login.html"; return Promise.resolve(); }
    return record("sign_out", "Signed out")
      .catch(function () { /* never block leaving over a log line */ })
      .then(function () { return c.auth.signOut(); })
      .then(function () { location.href = "login.html"; });
  }

  /* Sign out every other device but this one. Supabase can revoke the rest of
     a user's refresh tokens in one call, which is the honest version of a
     "sign out everywhere" control: it does not pretend we can pick one remote
     session out of a list, because the client cannot. */
  function signOutOthers() {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.signOut({ scope: "others" });
  }

  /* Is this session on the register?
     Returns the shareholders row, or null. Null with no error means signed in
     but not a shareholder, which is a different thing from not signed in.

     The address is in the query rather than left to row level security to
     narrow. Somebody who is both a shareholder and an administrator matches
     the admin policy as well as their own, so the unfiltered version returns
     the whole register and asking for a single row fails, locking the owner
     of the company out of their own portal. Ask for the row you actually
     want. */
  function lookupHolder(session) {
    var c = client();
    var known = session || (_session || null);
    var email = (known && known.user && known.user.email) || "";
    var go = email
      ? Promise.resolve(email.toLowerCase())
      : c.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          _session = s;
          return ((s && s.user && s.user.email) || "").toLowerCase();
        });

    return go.then(function (addr) {
      if (!addr) return null;
      return c.from("shareholders")
        .select("id,user_email,full_name,investor_ref,holder_type,country,status," +
                "joined_on,phone,address,directory_opt_in")
        .eq("user_email", addr)
        .maybeSingle()
        .then(function (r) { return r.error ? null : r.data; });
    });
  }

  /* Called at the top of every protected page. Resolves with the holder row,
     or redirects and never resolves. */
  function requireShareholder() {
    if (!configured()) { showUnconfigured(); return new Promise(function () {}); }
    var c = client();
    return c.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { location.replace("login.html"); return new Promise(function () {}); }
      _session = session;
      return lookupHolder(session).then(function (row) {
        if (!row) {
          // signed in, but not a holder. Do not leave a half authenticated
          // session lying around.
          return c.auth.signOut().then(function () {
            location.replace("login.html?denied=1");
            return new Promise(function () {});
          });
        }
        _holder = row;
        return row;
      });
    });
  }

  function currentHolder() { return _holder; }

  /* The signed in holder's id. Pages filter by it explicitly so the portal
     shows your position even when your account can see more than it. */
  function holderId() { return _holder ? _holder.id : null; }

  /* ---- the security log ----
     Written by the portal, never editable by the person it is about: there is
     an insert policy for a holder's own rows and no update or delete policy at
     all. A log its subject can rewrite is not a log. */
  function record(kind, detail) {
    var c = client();
    if (!c || !_holder) return Promise.resolve();
    return c.from("portal_activity").insert({
      shareholder_id: _holder.id,
      kind: kind,
      detail: detail || "",
      device: shortDevice()
    }).then(function () {}, function () {});
  }

  /* A recognisable name for this browser, not a fingerprint. Enough for the
     reader to tell one of their own devices from a stranger's, and nothing
     more precise than that. */
  function shortDevice() {
    var ua = navigator.userAgent || "";
    var os = /Windows/.test(ua) ? "Windows"
           : /Android/.test(ua) ? "Android"
           : /iPhone|iPad|iPod/.test(ua) ? "iOS"
           : /Mac OS X/.test(ua) ? "macOS"
           : /Linux/.test(ua) ? "Linux" : "Unknown system";
    var br = /Edg\//.test(ua) ? "Edge"
           : /OPR\//.test(ua) ? "Opera"
           : /Chrome\//.test(ua) ? "Chrome"
           : /Safari\//.test(ua) ? "Safari"
           : /Firefox\//.test(ua) ? "Firefox" : "Unknown browser";
    return br + " on " + os;
  }

  /* ---- two factor ----
     Supabase calls these factors. Enrolling returns a QR and a secret; the
     factor stays unverified until a code from the app is accepted, so a
     half finished enrolment cannot lock anybody out. */
  function listFactors() {
    var c = client();
    if (!c) return Promise.resolve({ totp: [] });
    return c.auth.mfa.listFactors().then(function (r) {
      return r.error ? { totp: [] } : (r.data || { totp: [] });
    });
  }
  function enrollTotp() {
    return client().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator " + new Date().toISOString().slice(0, 10)
    });
  }
  function verifyTotp(factorId, code) {
    var c = client();
    return c.auth.mfa.challenge({ factorId: factorId }).then(function (ch) {
      if (ch.error) return ch;
      return c.auth.mfa.verify({
        factorId: factorId, challengeId: ch.data.id, code: String(code || "").trim()
      });
    });
  }
  function unenroll(factorId) {
    return client().auth.mfa.unenroll({ factorId: factorId });
  }

  /* Shown instead of the portal when site-config has no Supabase values, which
     is how a handed over copy arrives. */
  function showUnconfigured() {
    document.body.innerHTML =
      '<main class="login"><div class="login-card">' +
        '<div class="login-brand">' +
          '<img src="../assets/logo-mark-96.png" alt="" width="26" height="26" />' +
          "<h1>HaveStack Portal</h1>" +
        "</div>" +
        '<p class="lead">Sign in is not configured.</p>' +
        '<div class="notice" style="border-left-color:var(--line-3)"><p>' +
          "Put your Supabase project URL and publishable key into " +
          "<code>assets/site-config.js</code>, then run " +
          "<code>supabase/portal-schema.sql</code> in the SQL editor to create the " +
          "share register this portal reads." +
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
    signOutOthers: signOutOthers,
    requireShareholder: requireShareholder,
    lookupHolder: lookupHolder,
    currentHolder: currentHolder,
    holderId: holderId,
    record: record,
    shortDevice: shortDevice,
    listFactors: listFactors,
    enrollTotp: enrollTotp,
    verifyTotp: verifyTotp,
    unenroll: unenroll,
    showUnconfigured: showUnconfigured
  };
})();
