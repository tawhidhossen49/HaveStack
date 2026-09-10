/* =========================================================
   admin-common.js
   ---------------------------------------------------------
   The admin panel's half of the console: its navigation, its
   wordmark, and its data helpers bound to the admin session.

   Everything else the panel draws, from the rail to the modal
   to the way a table folds into records on a phone, lives in
   assets/console-ui.js and is shared with the shareholder
   portal. The two are one product and should not drift apart
   by accident, which they would if each kept its own copy of
   the chrome.

   The public surface of this file has not changed. Every
   admin-*.js still calls A.Shell, A.panel, A.rows and the
   rest exactly as it did before.
   ========================================================= */
window.Admin = (function () {
  "use strict";

  var U = window.ConsoleUI;
  var I = U.I;

  /* Grouped so the rail reads as a structure rather than a list of fourteen
     equal things. Groups match how the public site is actually organised. */
  var NAV = [
    { group: null, items: [
      { href: "index.html",    label: "Dashboard",        icon: I.grid },
      { href: "requests.html", label: "Meeting requests", icon: I.inbox }
    ]},
    { group: "Site content", items: [
      { href: "capabilities.html", label: "Capabilities",         icon: I.layers },
      { href: "maintenance.html",  label: "Maintenance",          icon: I.gauge },
      { href: "products.html",     label: "Products",             icon: I.box },
      { href: "partners.html",     label: "Clients and partners", icon: I.users },
      { href: "sectors.html",      label: "Sectors",              icon: I.globe },
      { href: "standards.html",    label: "Standards",            icon: I.shield },
      { href: "governance.html",   label: "Governance",           icon: I.scales }
    ]},
    { group: "Practice", items: [
      { href: "media.html",    label: "Media library", icon: I.image },
      { href: "settings.html", label: "Settings",      icon: I.cog }
    ]}
  ];

  /* `admin` is the row from public.admins, passed in by the page after the
     guard has run. */
  function Shell(active, title, subtitle, actions, admin) {
    return U.Shell({
      home: "index.html",
      word: "Admin",
      nav: NAV,
      who: {
        name: (admin && (admin.full_name || admin.email)) || "Signed in",
        email: (admin && admin.email) || ""
      },
      away: { href: "../index.html", label: "View site", icon: I.ext },
      onSignOut: function () {
        if (window.AdminAuth) AdminAuth.signOut(); else location.href = "login.html";
      }
    }, active, title, subtitle, actions);
  }

  /* Data helpers bound to the admin session. Ordering defaults to the sort
     column, because most of what the panel edits is an ordered list. */
  var D = U.makeData(function () { return AdminAuth.client(); });
  function db() { return AdminAuth.client(); }
  function rows(table, order) { return D.rows(table, order || "sort"); }

  return {
    NAV: NAV, I: I, svg: U.svg, escapeHtml: U.escapeHtml, initials: U.initials,
    Shell: Shell, toast: U.toast, modal: U.modal,
    db: db, rows: rows, insert: D.insert, update: D.update, remove: D.remove,
    failed: U.failed,
    panel: U.panel, empty: U.empty, notice: U.notice, table: U.table
  };
})();
