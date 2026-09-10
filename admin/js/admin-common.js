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

  /* Seven entries, not fourteen.

     The panel used to carry one rail item per section of the public page,
     which made the rail a table of contents for a document the reader was
     already looking at, and left every one of those pages holding a single
     small list. Page sections is now the way in to all of them: it shows
     every section at once, with what is on the page and what is hidden, and
     each row opens its own editor. Products and Clients and partners keep
     their own entries because they are edited far more often than the rest. */
  var NAV = [
    { group: null, items: [
      { href: "index.html",    label: "Dashboard",        icon: I.grid },
      { href: "requests.html", label: "Meeting requests", icon: I.inbox }
    ]},
    { group: "The public page", items: [
      { href: "sections.html", label: "Page sections",        icon: I.layers },
      { href: "products.html", label: "Products",             icon: I.box },
      { href: "partners.html", label: "Clients and partners", icon: I.users },
      { href: "media.html",    label: "Images",               icon: I.image }
    ]},
    { group: "Practice", items: [
      { href: "settings.html", label: "Settings", icon: I.cog }
    ]}
  ];

  /* The section editor is reached from Page sections rather than from the
     rail, so it has no entry of its own. It still needs the rail to show
     where the reader is. */
  function activeFor(file) {
    return file === "section.html" ? "sections.html" : file;
  }

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
    }, activeFor(active), title, subtitle, actions);
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
