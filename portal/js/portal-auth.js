/* =========================================================
   portal-auth.js
   ---------------------------------------------------------
   Sign in for the shareholder portal, kept apart from the
   admin panel's.

   A person who uses both has two passwords. The admin panel
   signs in the Supabase Auth user for their real address.
   The portal signs in a second Auth user that exists only
   for the portal, whose sign in address is derived from the
   real one: name+hsportal@domain. Nobody types that address;
   this file works it out from the one they do type. The two
   Auth users share nothing, so the admin password does not
   open the portal, the portal password does not open the
   panel, and changing one never changes the other.

   Being signed in is not enough on its own. The session has
   to belong to an active row in public.portal_accounts, and
   that row says whether this person is a holder or a portal
   administrator. A holder whose account has been switched
   off, or who has left the register, is signed straight back
   out.

   There is no sign up and no emailed password reset. A
   portal administrator creates each account with a password,
   and sets a new one if it is forgotten.
   ========================================================= */
window.PortalAuth = (function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var URL_ = CFG.supabaseUrl || "";
  var KEY_ = CFG.supabaseKey || "";

  var _client = null;
  var _account = null;   // the row from public.portal_accounts
  var _holder = null;    // the row from public.shareholders, if there is one
  var _me = null;        // the two merged, which is what every page reads

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
          detectSessionInUrl: false,
          // its own storage key, so a portal session and an admin panel
          // session can live in the same browser without replacing each other
          storageKey: "hs-portal-auth"
        }
      });
    }
    return _client;
  }

  /* The portal's own sign in address for a real one. Must stay identical to
     portalLoginEmail() in supabase/functions/portal-users/index.ts, which
     created the account with it. */
  function portalLoginEmail(real) {
    var e = String(real || "").trim().toLowerCase();
    var at = e.lastIndexOf("@");
    if (at < 1) return e;
    return e.slice(0, at) + "+hsportal" + e.slice(at);
  }

  function signIn(email, password) {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.signInWithPassword({
      email: portalLoginEmail(email),
      password: String(password || "")
    });
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

  /* Sign out every other device but this one. The client cannot pick one
     remote session out of a list, so this does not pretend to: it ends all of
     them at once. */
  function signOutOthers() {
    var c = client();
    if (!c) return Promise.reject(new Error("not configured"));
    return c.auth.signOut({ scope: "others" });
  }

  /* ---- who the session belongs to ----
     Looked up by the Auth user's id, never by an address in the token. */
  function loadMember(session) {
    var c = client();
    var uid = session && session.user && session.user.id;
    if (!uid) return Promise.resolve(null);
    return c.from("portal_accounts")
      .select("id,email,full_name,role,status,shareholder_id,last_sign_in_at")
      .eq("auth_user_id", uid)
      .maybeSingle()
      .then(function (r) {
        if (r.error || !r.data) return null;
        var account = r.data;
        if (!account.shareholder_id) return { account: account, holder: null };
        return c.from("shareholders")
          .select("id,user_email,full_name,investor_ref,holder_type,country,status," +
                  "joined_on,phone,address,directory_opt_in")
          .eq("id", account.shareholder_id)
          .maybeSingle()
          .then(function (h) {
            return { account: account, holder: h.error ? null : h.data };
          });
      });
  }

  /* What a page is handed. A holder's register record, with their account
     laid over it; or, for an administrator who holds no shares, the account
     alone in the same shape, so no page has to ask which it got. */
  function merge(account, holder) {
    var me = holder ? Object.assign({}, holder) : {
      id: null, user_email: account.email, full_name: account.full_name || account.email,
      investor_ref: "", holder_type: "", country: "", status: "active", joined_on: null,
      phone: "", address: "", directory_opt_in: false
    };
    me.account_id = account.id;
    me.account_email = account.email;
    me.role = account.role;
    me.is_admin = account.role === "admin";
    me.has_holding = !!holder;
    me.last_sign_in_at = account.last_sign_in_at;
    return me;
  }

  function denied(reason) {
    var c = client();
    return c.auth.signOut().then(function () {
      location.replace("login.html?" + reason + "=1");
      return new Promise(function () {});
    });
  }

  /* Called at the top of every page. Resolves with the signed in person, or
     sends them to the sign in page and never resolves. */
  function requireShareholder() {
    if (!configured()) { showUnconfigured(); return new Promise(function () {}); }
    var c = client();
    return c.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { location.replace("login.html"); return new Promise(function () {}); }
      return loadMember(session).then(function (m) {
        if (!m) return denied("denied");
        if (m.account.status !== "active") return denied("disabled");
        if (m.holder && m.holder.status !== "active") return denied("disabled");
        _account = m.account;
        _holder = m.holder;
        _me = merge(m.account, m.holder);
        return _me;
      });
    });
  }

  /* The administration pages. A holder who reaches one by address is sent to
     the overview; the database would refuse them anyway, but they should not
     be shown controls that cannot work. */
  function requirePortalAdmin() {
    return requireShareholder().then(function (me) {
      if (!me.is_admin) {
        location.replace("index.html");
        return new Promise(function () {});
      }
      return me;
    });
  }

  function currentHolder() { return _me; }
  function currentAccount() { return _account; }
  function holderId() { return _holder ? _holder.id : null; }
  function isAdmin() { return !!(_account && _account.role === "admin"); }

  /* ---- the security log ----
     Written by the portal, never editable by the person it is about: there is
     an insert policy for your own rows and no update or delete policy at all. */
  function record(kind, detail) {
    var c = client();
    if (!c || !_account) return Promise.resolve();
    return c.from("portal_activity").insert({
      account_id: _account.id,
      shareholder_id: _holder ? _holder.id : null,
      kind: kind,
      detail: detail || "",
      device: shortDevice()
    }).then(function () {}, function () {});
  }

  /* A recognisable name for this browser, not a fingerprint. */
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

  /* ---- the portal-users edge function ----
     Account changes need the secret key, so they happen on the server. The
     publishable key goes on the apikey header only: the new keys are not JWTs,
     and a gateway that sees one on Authorization rejects the request. */
  function callFunction(action, payload, opts) {
    opts = opts || {};
    if (!configured()) return Promise.resolve({ error: "Sign in is not configured." });
    var headers = { "Content-Type": "application/json", apikey: KEY_ };
    var token = opts.token
      ? Promise.resolve(opts.token)
      : opts.anonymous
        ? Promise.resolve(null)
        : client().auth.getSession().then(function (r) {
            return r.data && r.data.session ? r.data.session.access_token : null;
          });
    return token.then(function (t) {
      if (t) headers.Authorization = "Bearer " + t;
      var body = Object.assign({ action: action }, payload || {});
      return fetch(URL_ + "/functions/v1/portal-users", {
        method: "POST", headers: headers, body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().catch(function () { return { error: "Unexpected reply (" + res.status + ")." }; });
      }, function () {
        return { error: "Could not reach the server. Check your connection and try again." };
      });
    });
  }

  /* ---- two factor ---- */
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
          "<code>supabase/portal-schema.sql</code> in the SQL editor and deploy the " +
          "<code>portal-users</code> edge function." +
        "</p></div>" +
        '<a class="btn btn-block btn-sm" href="../index.html">Back to the site</a>' +
      "</div></main>";
  }

  return {
    configured: configured,
    client: client,
    portalLoginEmail: portalLoginEmail,
    signIn: signIn,
    updatePassword: updatePassword,
    signOut: signOut,
    signOutOthers: signOutOthers,
    loadMember: loadMember,
    requireShareholder: requireShareholder,
    requirePortalAdmin: requirePortalAdmin,
    currentHolder: currentHolder,
    currentAccount: currentAccount,
    holderId: holderId,
    isAdmin: isAdmin,
    record: record,
    shortDevice: shortDevice,
    callFunction: callFunction,
    listFactors: listFactors,
    enrollTotp: enrollTotp,
    verifyTotp: verifyTotp,
    unenroll: unenroll,
    showUnconfigured: showUnconfigured
  };
})();
