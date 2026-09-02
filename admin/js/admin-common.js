/* =========================================================
   admin-common.js
   ---------------------------------------------------------
   Shared chrome for every admin page: the rail, the topbar,
   toasts, and the small helpers a page needs. Loaded before
   each page's own admin-*.js.

   There is no data layer yet. Nothing here connects to a
   database, and no page invents rows to look busy: each one
   renders its controls and an empty state that says what
   will live there. Wiring goes in one place when it comes,
   which is why every page already renders through Shell().
   ========================================================= */
window.Admin = (function () {
  "use strict";

  /* Icons are inline 24x24 stroke paths so the panel carries no icon font
     and no request. Same family throughout, same stroke weight. */
  var I = {
    grid:     "M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z",
    inbox:    "M4 4h16v16H4zM4 14h4l2 3h4l2-3h4",
    box:      "M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10",
    users:    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87",
    layers:   "M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
    gauge:    "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM13.4 10.6 19 5M3 20a9 9 0 1 1 18 0",
    globe:    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z",
    shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    scales:   "M12 3v18M6 7h12M6 7 3 14h6zM18 7l-3 7h6zM8 21h8",
    image:    "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6",
    cog:      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.3 8a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V8a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    out:      "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    menu:     "M4 7h16M4 12h16M4 17h16",
    search:   "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    plus:     "M12 5v14M5 12h14",
    ext:      "M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5",
    info:     "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v5h1"
  };

  /* Grouped so the rail reads as a structure rather than a list of fourteen
     equal things. Groups match how the public site is actually organised. */
  var NAV = [
    { group: null, items: [
      { href: "index.html",    label: "Dashboard",        icon: I.grid },
      { href: "requests.html", label: "Meeting requests", icon: I.inbox }
    ]},
    { group: "Site content", items: [
      { href: "capabilities.html", label: "Capabilities",        icon: I.layers },
      { href: "maintenance.html",  label: "Maintenance",         icon: I.gauge },
      { href: "products.html",     label: "Products",            icon: I.box },
      { href: "partners.html",     label: "Clients and partners", icon: I.users },
      { href: "sectors.html",      label: "Sectors",             icon: I.globe },
      { href: "standards.html",    label: "Standards",           icon: I.shield },
      { href: "governance.html",   label: "Governance",          icon: I.scales }
    ]},
    { group: "Practice", items: [
      { href: "media.html",    label: "Media library", icon: I.image },
      { href: "settings.html", label: "Settings",      icon: I.cog }
    ]}
  ];

  function svg(path, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- the shell ---------- */
  function initials(w) {
    var src = (w.name || w.email || "?").trim();
    var parts = src.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
  }

  /* `admin` is the row from public.admins, passed in by the page after the
     guard has run. Everything else about the shell is unchanged. */
  function Shell(active, title, subtitle, actions, admin) {
    var app = document.getElementById("adminApp");
    if (!app) return null;
    var who = {
      name: (admin && (admin.full_name || admin.email)) || "Signed in",
      email: (admin && admin.email) || ""
    };

    var nav = NAV.map(function (sec) {
      var head = sec.group ? '<div class="nav-group">' + escapeHtml(sec.group) + "</div>" : "";
      return head + sec.items.map(function (n) {
        var on = n.href === active;
        return '<a href="' + n.href + '"' + (on ? ' aria-current="page"' : "") + ">" +
          svg(n.icon, 17) + escapeHtml(n.label) + "</a>";
      }).join("");
    }).join("");

    app.innerHTML =
      '<a class="skip" href="#content">Skip to content</a>' +
      '<div class="shell">' +
        '<aside class="rail" id="rail">' +
          '<a class="rail-brand" href="index.html">' +
            '<img src="../assets/logo-mark-96.png" alt="" width="24" height="24" />' +
            '<span><b>HaveStack</b><small>Admin</small></span>' +
          "</a>" +
          '<nav class="nav" aria-label="Sections">' + nav + "</nav>" +
          '<div class="rail-foot">' +
            '<div class="who">' +
              '<span class="who-mark" aria-hidden="true">' + escapeHtml(initials(who)) + "</span>" +
              '<span class="who-text">' +
                '<span class="who-name">' + escapeHtml(who.name) + "</span>" +
                '<span class="who-role">' + escapeHtml(who.email) + "</span>" +
              "</span>" +
            "</div>" +
            '<button class="btn btn-block btn-sm" type="button" id="signOut">' + svg(I.out, 15) + "Sign out</button>" +
          "</div>" +
        "</aside>" +
        '<div class="main">' +
          '<div class="topbar">' +
            '<button class="icon-btn burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="rail">' + svg(I.menu, 16) + "</button>" +
            '<div class="topbar-title"><h1>' + escapeHtml(title) + "</h1>" +
              (subtitle ? "<p>" + escapeHtml(subtitle) + "</p>" : "") + "</div>" +
            (actions || "") +
            '<a class="btn btn-sm" href="../index.html" target="_blank" rel="noopener">' + svg(I.ext, 14) + "View site</a>" +
          "</div>" +
          '<div class="content" id="content"></div>' +
        "</div>" +
      "</div>" +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="toasts" id="toasts" role="status" aria-live="polite"></div>';

    var out = document.getElementById("signOut");
    if (out) out.addEventListener("click", function () {
      out.disabled = true;
      if (window.AdminAuth) AdminAuth.signOut(); else location.href = "login.html";
    });

    wireDrawer();
    watchTables();
    return document.getElementById("content");
  }

  /* The rail is off canvas below 960px. The button is what brings it back,
     the scrim and Escape are what send it away, and focus is put somewhere
     sensible either way so a keyboard is never left behind a closed drawer. */
  function wireDrawer() {
    var rail = document.getElementById("rail");
    var burger = document.getElementById("burger");
    var scrim = document.getElementById("scrim");
    if (!rail || !burger || !scrim) return;

    function setOpen(open) {
      rail.classList.toggle("open", open);
      scrim.classList.toggle("show", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) { var f = rail.querySelector("a"); if (f) f.focus(); }
      else burger.focus();
    }
    burger.addEventListener("click", function () { setOpen(!rail.classList.contains("open")); });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && rail.classList.contains("open")) setOpen(false);
    });
    rail.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { rail.classList.remove("open"); scrim.classList.remove("show"); document.body.style.overflow = ""; });
    });
  }

  /* Below 719px every row becomes a record and each cell needs to say which
     column it came from. Copying the header down here means a page author
     cannot forget to, and a MutationObserver covers tables painted later. */
  function labelTables(root) {
    (root || document).querySelectorAll(".table").forEach(function (t) {
      var heads = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      if (!heads.length) return;
      t.querySelectorAll("tbody tr").forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (cell, i) {
          cell.setAttribute("data-label", heads[i] || "");
        });
      });
    });
  }
  function watchTables() {
    var content = document.getElementById("content");
    if (!content) return;
    labelTables(content);
    if (!("MutationObserver" in window)) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; labelTables(content); });
    }).observe(content, { childList: true, subtree: true });
  }

  /* Every control that has no behaviour yet carries data-stub. One delegated
     listener answers all of them, so no page needs an inline handler and the
     day a control becomes real it just loses the attribute. */
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-stub]") : null;
    if (!el) return;
    e.preventDefault();
    toast(el.getAttribute("data-stub") || "Nothing is wired up yet.");
  });

  /* ---------- modal ----------
     Opens a small form, returns a promise of the field values or null if the
     person backed out. Escape, the close button and the backdrop all cancel,
     and focus starts in the first field and returns to where it was. */
  function modal(opts) {
    return new Promise(function (resolve) {
      var back = document.createElement("div");
      back.className = "modal-back";
      var wasFocused = document.activeElement;

      back.innerHTML =
        '<form class="modal" novalidate>' +
          '<div class="modal-head"><div>' +
            "<h2>" + escapeHtml(opts.title) + "</h2>" +
            (opts.note ? "<p>" + escapeHtml(opts.note) + "</p>" : "") +
          "</div>" +
          '<button class="modal-x" type="button" data-cancel aria-label="Close">&#215;</button>' +
          "</div>" +
          '<div class="modal-body">' +
            opts.fields.map(function (f) {
              /* An empty string and a zero are different things. Testing the
                 value for truth would blank every field holding 0, which is a
                 real order number, so test for absence instead. */
              var has = f.value !== undefined && f.value !== null && f.value !== "";
              var val = has ? escapeHtml(f.value) : "";
              var id = "m-" + f.name;
              var control;

              if (f.options) {
                /* A fixed set of choices belongs in a select. Typed free hand
                   it is a spelling test the writer can fail, and the failure
                   only shows up as a rejected save. */
                control = '<select id="' + id + '"' + (f.readonly ? " disabled" : "") + ">" +
                  f.options.map(function (o) {
                    var v = o.value === undefined ? o : o.value;
                    var l = o.label === undefined ? v : o.label;
                    return '<option value="' + escapeHtml(v) + '"' +
                      (String(v) === String(f.value) ? " selected" : "") + ">" +
                      escapeHtml(l) + "</option>";
                  }).join("") + "</select>";
              } else if (f.multiline) {
                control = '<textarea id="' + id + '" rows="' + (f.rows || 5) + '"' +
                  (f.readonly ? " readonly" : "") + ">" + val + "</textarea>";
              } else {
                control = '<input id="' + id + '" type="' + (f.type || "text") + '"' +
                  (has ? ' value="' + val + '"' : "") +
                  (f.autocomplete ? ' autocomplete="' + f.autocomplete + '"' : "") +
                  (f.readonly ? " readonly" : "") + " />";
              }

              return '<div class="field"><label for="' + id + '">' + escapeHtml(f.label) + "</label>" +
                control +
                (f.hint ? '<span class="hint">' + escapeHtml(f.hint) + "</span>" : "") +
              "</div>";
            }).join("") +
          "</div>" +
          '<p class="modal-err" id="modal-err" role="alert" hidden></p>' +
          '<div class="modal-foot">' +
            '<button class="btn btn-sm" type="button" data-cancel>Cancel</button>' +
            '<button class="btn btn-key btn-sm" type="submit">' + escapeHtml(opts.confirm || "Save") + "</button>" +
          "</div>" +
        "</form>";

      function close(result) {
        document.removeEventListener("keydown", onKey);
        back.remove();
        document.body.style.overflow = "";
        if (wasFocused && wasFocused.focus) wasFocused.focus();
        resolve(result);
      }
      function onKey(e) { if (e.key === "Escape") close(null); }

      back.addEventListener("click", function (e) {
        if (e.target === back || e.target.closest("[data-cancel]")) close(null);
      });
      back.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var out = {};
        opts.fields.forEach(function (f) {
          out[f.name] = document.getElementById("m-" + f.name).value;
        });

        /* Validate before closing. Closing first and complaining afterwards
           throws away everything the writer typed and makes them start again
           over a single wrong character, so the form stays put and says what
           is wrong while their work is still in it. */
        if (opts.validate) {
          var problem = opts.validate(out);
          if (problem) {
            var box = back.querySelector("#modal-err");
            box.textContent = problem;
            box.hidden = false;
            var bad = opts.invalidField && document.getElementById("m-" + opts.invalidField);
            (bad || back.querySelector("input, textarea, select")).focus();
            return;
          }
        }
        close(out);
      });

      // clear a stale complaint as soon as the writer starts fixing it
      back.querySelector("form").addEventListener("input", function () {
        var box = back.querySelector("#modal-err");
        if (box && !box.hidden) box.hidden = true;
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(back);
      document.body.style.overflow = "hidden";
      var first = back.querySelector("input:not([readonly]), textarea:not([readonly]), select:not([disabled])");
      if (first) first.focus();
    });
  }

  /* ---------- data ----------
     Thin wrappers over PostgREST through the signed in client. Row level
     security decides what is actually allowed; these only shape the call. */
  function db() { return AdminAuth.client(); }

  function rows(table, order) {
    return db().from(table).select("*").order(order || "sort")
      .then(function (r) { return r.error ? { error: r.error.message } : { data: r.data || [] }; });
  }
  function insert(table, row) {
    return db().from(table).insert(row)
      .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
  }
  function update(table, id, patch) {
    return db().from(table).update(patch).eq("id", id)
      .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
  }
  function remove(table, id) {
    return db().from(table).delete().eq("id", id)
      .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
  }

  /* A section that failed to load should say so rather than look empty. The
     two are very different: one means nothing is here yet, the other means
     something is wrong, and only one of them is the reader's to fix. */
  function failed(msg) {
    return empty("Could not load",
      msg + " If this keeps happening, check the tables exist and that you are still signed in.");
  }

  /* ---------- toasts ---------- */
  function toast(message, isError) {
    var wrap = document.getElementById("toasts");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " err" : "");
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 3600);
  }

  /* ---------- pieces a page assembles from ---------- */
  function panel(opts) {
    return '<section class="panel">' +
      '<div class="panel-head">' +
        "<div><h2>" + escapeHtml(opts.title) + "</h2>" +
          (opts.note ? "<p>" + escapeHtml(opts.note) + "</p>" : "") + "</div>" +
        (opts.actions ? '<div class="row-actions">' + opts.actions + "</div>" : "") +
      "</div>" +
      '<div class="panel-body' + (opts.flush ? " flush" : "") + '">' + (opts.body || "") + "</div>" +
      (opts.foot ? '<div class="panel-foot">' + opts.foot + "</div>" : "") +
    "</section>";
  }

  function empty(title, note, action) {
    return '<div class="empty">' + svg(I.inbox, 26) +
      "<h3>" + escapeHtml(title) + "</h3>" +
      "<p>" + escapeHtml(note) + "</p>" +
      (action || "") + "</div>";
  }

  function notice(text) {
    return '<div class="notice">' + svg(I.info, 17) + "<p>" + text + "</p></div>";
  }

  /* Wide content scrolls inside its own box rather than pushing the document.
     At 720px the seven column header measured 755px and took the whole page
     with it; below 720 the rows become records and the wrapper stands down. */
  function table(headers, bodyRows) {
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      headers.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + (bodyRows || "") + "</tbody></table></div>";
  }

  return {
    NAV: NAV, I: I, svg: svg, escapeHtml: escapeHtml, initials: initials,
    Shell: Shell, toast: toast, modal: modal,
    db: db, rows: rows, insert: insert, update: update, remove: remove, failed: failed,
    panel: panel, empty: empty, notice: notice, table: table
  };
})();
