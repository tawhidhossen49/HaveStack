/* =========================================================
   console-ui.js
   ---------------------------------------------------------
   The parts of a HaveStack console that are the same whoever
   is signed in: the icon set, the shell chrome, the drawer,
   tables, toasts, the modal, and the small pieces a page is
   assembled from.

   Two consoles are built on this. The admin panel is the
   practice looking at itself; the shareholder portal is an
   owner looking in. They are one product and they should look
   it, so the chrome lives here once and each console supplies
   only what actually differs: its wordmark, its navigation,
   and who is signed in.

   Nothing here knows about Supabase. A console hands in its
   own client, because the two authenticate different people
   against different tables and neither should be able to
   borrow the other's session.
   ========================================================= */
window.ConsoleUI = (function () {
  "use strict";

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


  /* Marks the portal needs that the panel never did. Same 24x24 grid, same
     stroke weight, drawn in the same hand as the set above. */
  I.pie       = "M12 3a9 9 0 1 0 9 9h-9z";
  I.receipt   = "M5 3h14v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3";
  I.coins     = "M9 14a6 3 0 1 0 0-6 6 3 0 0 0 0 6zM3 11v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4M15 8.5c2.6.3 6 1.4 6 2.5M21 11v4c0 1.7-2.7 3-6 3";
  I.file      = "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5";
  I.building  = "M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M4 21h16M8 7h3M8 11h3M8 15h3";
  I.megaphone = "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM15 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14";
  I.user      = "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";
  I.trend     = "M3 17l6-6 4 4 8-8M21 7h-5M21 7v5";
  I.lock      = "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4";
  I.download  = "M12 3v12M7 11l5 5 5-5M4 21h16";
  I.check     = "M20 6 9 17l-5-5";
  I.clock     = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2";

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

  function initials(w) {
    var src = (w.name || w.email || "?").trim();
    var parts = src.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
  }


  /* ---------- the shell ----------
     `cfg` carries the only things one console differs from another by:
       home      where the wordmark links
       word      the small caps line under HaveStack
       nav       the grouped navigation
       who       { name, email, meta } for the rail foot
       away      the link at the far right of the topbar
       onSignOut what the sign out button calls
     Everything else below is deliberately identical for both. */
  function Shell(cfg, active, title, subtitle, actions) {
    var app = document.getElementById("consoleApp") || document.getElementById("adminApp");
    if (!app) return null;
    var who = cfg.who || {};
    var away = cfg.away || { href: "../index.html", label: "View site", icon: I.ext };

    var nav = (cfg.nav || []).map(function (sec) {
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
          '<a class="rail-brand" href="' + (cfg.home || "index.html") + '">' +
            '<img src="../assets/logo-mark-96.png" alt="" width="24" height="24" />' +
            "<span><b>HaveStack</b><small>" + escapeHtml(cfg.word || "Console") + "</small></span>" +
          "</a>" +
          '<nav class="nav" aria-label="Sections">' + nav + "</nav>" +
          '<div class="rail-foot">' +
            '<div class="who">' +
              '<span class="who-mark" aria-hidden="true">' + escapeHtml(initials(who)) + "</span>" +
              '<span class="who-text">' +
                '<span class="who-name">' + escapeHtml(who.name || "Signed in") + "</span>" +
                '<span class="who-role">' + escapeHtml(who.meta || who.email || "") + "</span>" +
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
            '<a class="btn btn-sm" href="' + away.href + '"' +
              (away.blank === false ? "" : ' target="_blank" rel="noopener"') + ">" +
              svg(away.icon, 14) + escapeHtml(away.label) + "</a>" +
          "</div>" +
          '<div class="content" id="content"></div>' +
        "</div>" +
      "</div>" +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="toasts" id="toasts" role="status" aria-live="polite"></div>';

    var out = document.getElementById("signOut");
    if (out) out.addEventListener("click", function () {
      out.disabled = true;
      if (cfg.onSignOut) cfg.onSignOut(); else location.href = "login.html";
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
            /* Anything the form needs read before its fields: a setup code to
               scan, a warning about what a confirmation will do. */
            (opts.before || "") +
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
     Thin wrappers over PostgREST. The console hands in its own client getter,
     since the panel and the portal authenticate different people. Row level
     security decides what is actually allowed; these only shape the call. */
  function makeData(getClient) {
    function rows(table, order, ascending) {
      var q = getClient().from(table).select("*");
      if (order) q = q.order(order, { ascending: ascending !== false });
      return q.then(function (r) {
        return r.error ? { error: r.error.message } : { data: r.data || [] };
      });
    }
    function insert(table, row) {
      return getClient().from(table).insert(row)
        .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
    }
    function update(table, id, patch) {
      return getClient().from(table).update(patch).eq("id", id)
        .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
    }
    function remove(table, id) {
      return getClient().from(table).delete().eq("id", id)
        .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
    }
    return { rows: rows, insert: insert, update: update, remove: remove };
  }

  /* A section that failed to load should say so rather than look empty. The
     two are very different: one means nothing is here yet, the other means
     something is wrong, and only one of them is the reader's to fix. */
  function failed(msg) {
    return empty("Could not load",
      msg + " If this keeps happening, check that you are still signed in.");
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
    I: I, svg: svg, escapeHtml: escapeHtml, initials: initials,
    Shell: Shell, toast: toast, modal: modal, makeData: makeData, failed: failed,
    panel: panel, empty: empty, notice: notice, table: table,
    labelTables: labelTables
  };
})();
