/* =========================================================
   portal-common.js
   ---------------------------------------------------------
   The shareholder portal's half of the console: its
   navigation, its wordmark, its data helpers bound to the
   portal session, and the formatting every page shares.

   The chrome itself lives in assets/console-ui.js alongside
   the admin panel's, so the two cannot drift apart.

   A note on what is missing. There is no insert, update or
   delete for anything on the register. Ownership,
   transactions, dividends, valuations and certificates are
   records of things that happened, and this file gives a page
   no way to write one even by mistake. The single exception
   is saveProfile below, which touches four columns of one
   row, and the database refuses the rest regardless of what
   this file asks for.
   ========================================================= */
window.Portal = (function () {
  "use strict";

  var U = window.ConsoleUI;
  var I = U.I;

  var NAV = [
    { group: null, items: [
      { href: "index.html", label: "Overview", icon: I.grid }
    ]},
    { group: "My position", items: [
      { href: "holdings.html",     label: "My holdings", icon: I.pie },
      { href: "dividends.html",    label: "Dividends",   icon: I.coins },
      { href: "transactions.html", label: "Transactions", icon: I.receipt },
      { href: "documents.html",    label: "Documents",   icon: I.file }
    ]},
    { group: "The company", items: [
      { href: "shareholders.html", label: "Shareholders", icon: I.users },
      { href: "company.html",      label: "Company",      icon: I.building },
      { href: "updates.html",      label: "Updates",      icon: I.megaphone }
    ]},
    { group: null, items: [
      { href: "account.html", label: "Account", icon: I.user }
    ]}
  ];

  /* Shown only to a portal administrator. A holder never sees these entries,
     and the pages behind them refuse a holder who reaches one by its address;
     the database refuses the writes regardless. */
  var ADMIN_NAV = { group: "Administration", items: [
    { href: "admin-price.html",        label: "Share price",        icon: I.trend },
    { href: "admin-register.html",     label: "Register and access", icon: I.shield },
    { href: "admin-transactions.html", label: "Share movements",    icon: I.layers },
    { href: "admin-dividends.html",    label: "Declare dividends",  icon: I.check },
    { href: "admin-updates.html",      label: "Announcements",      icon: I.inbox },
    { href: "admin-documents.html",    label: "Publish documents",  icon: I.download },
    { href: "admin-company.html",      label: "Company information", icon: I.building },
    { href: "admin-audit.html",        label: "Audit trail",        icon: I.clock }
  ]};

  function Shell(active, title, subtitle, actions, holder) {
    var content = shell(active, title, subtitle, actions, holder);
    if (content) decorate(active, holder);
    return content;
  }

  function shell(active, title, subtitle, actions, holder) {
    return U.Shell({
      home: "index.html",
      word: "Portal",
      nav: holder && holder.is_admin ? NAV.slice(0, -1).concat([ADMIN_NAV], NAV.slice(-1)) : NAV,
      who: {
        name: (holder && holder.full_name) || "Signed in",
        email: (holder && holder.user_email) || "",
        // the reference is what a holder is called in writing, so the rail
        // shows that; an administrator without a holding is shown as one
        meta: (holder && (holder.investor_ref ||
                          (holder.is_admin ? "Portal administrator" : ""))) || ""
      },
      away: { href: "../index.html", label: "View site", icon: I.ext },
      onSignOut: function () {
        if (window.PortalAuth) PortalAuth.signOut(); else location.href = "login.html";
      }
    }, active, title, subtitle, actions);
  }

  /* ---------- the portal's own chrome ----------
     Added after the shared shell has drawn, so the admin panel keeps the
     chrome it has. Three things: the rail is indexed, the pages that change
     what other people see are marked, and the readings a holder came for are
     put under the title on every page rather than on one of them. */
  function decorate(active, holder) {
    var i = 0;
    document.querySelectorAll(".nav a").forEach(function (a) {
      var n = document.createElement("span");
      n.className = "nav-i";
      // the numeral is an index, not content: a screen reader already has the link
      n.setAttribute("aria-hidden", "true");
      i += 1;
      n.textContent = (i < 10 ? "0" : "") + i;
      a.insertBefore(n, a.firstChild);
    });

    if (/^admin-/.test(active)) document.body.classList.add("is-admin-page");

    var bar = document.querySelector(".topbar");
    if (!bar) return;
    var strip = document.createElement("div");
    strip.className = "strip";
    strip.id = "portalStrip";
    strip.innerHTML = '<div class="strip-cell"><span class="strip-k">Share price</span>' +
      '<span class="strip-v"><span class="skel strip-skel"></span></span></div>';
    bar.insertAdjacentElement("afterend", strip);
    fillStrip(holder);
  }

  /* The strip is live everywhere, not only on the overview: it subscribes to
     the valuations table itself, so a price set by an administrator reaches
     every open page. The mark only claims to be live once the channel has
     actually said it is. */
  function fillStrip(holder) {
    var strip = document.getElementById("portalStrip");
    if (!strip) return;
    var state = { val: null, pos: null, totals: null, live: false };

    function cell(k, v) {
      return '<div class="strip-cell"><span class="strip-k">' + U.escapeHtml(k) + "</span>" +
             '<span class="strip-v">' + v + "</span></div>";
    }
    function draw() {
      var v = state.val || {}, p = state.pos || {}, t = state.totals || {};
      var out = cell("Share price", v.price_per_share
        ? price(v.price_per_share) : '<span class="nil">Not set</span>');
      if (v.effective_on) out += cell("As at", date(v.effective_on));
      if (holder && holder.has_holding) {
        out += Number(p.shares) > 0
          ? cell("Your stake", shares(p.shares) + " shares, " + pct(p.ownership_pct)) +
            cell("Worth", money(p.current_value))
          : cell("Your stake", '<span class="nil">No shares</span>');
      }
      if (holder && holder.is_admin && Number(t.total_shares) >= 0) {
        out += cell("Allotted", shares(t.total_shares) +
          (Number(t.company_total) > 0 ? " of " + shares(t.company_total) : ""));
      }
      if (state.live) {
        out += '<div class="strip-cell strip-live"><i></i><span class="strip-k">Live</span></div>';
      }
      strip.innerHTML = out;
    }

    var reads = [one("v_latest_valuation"), one("v_my_position")];
    if (holder && holder.is_admin) reads.push(one("v_share_totals"));
    Promise.all(reads).then(function (res) {
      state.val = res[0].error ? null : res[0].data;
      state.pos = res[1].error ? null : res[1].data;
      state.totals = res[2] && !res[2].error ? res[2].data : null;
      draw();
    });

    PortalAuth.client().channel("portal-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "valuations" }, function () {
        one("v_latest_valuation").then(function (r) {
          if (!r.error) { state.val = r.data; draw(); }
        });
      })
      .subscribe(function (status) {
        if (status === "SUBSCRIBED" && !state.live) { state.live = true; draw(); }
      });
  }

  var D = U.makeData(function () { return PortalAuth.client(); });

  /* ---------- reading ----------
     Every read goes through the same shape so a page never has to think about
     the error case twice: { data } or { error }. */
  function rows(table, order, ascending) { return D.rows(table, order, ascending); }

  function view(name, order, ascending) {
    var q = PortalAuth.client().from(name).select("*");
    if (order) q = q.order(order, { ascending: ascending !== false });
    return q.then(function (r) {
      return r.error ? { error: r.error.message } : { data: r.data || [] };
    });
  }

  /* Your own rows of a table, asked for explicitly.

     Row level security is the boundary and it stays the boundary: a
     shareholder cannot widen this. But an account that is also an
     administrator is allowed to read the whole register, and the portal is
     not the place that shows it. Naming the holder in the query means the
     portal always shows your position, whoever else you happen to be. */
  var NOBODY = "00000000-0000-0000-0000-000000000000";
  function mine(table, select) {
    // an administrator who holds no shares owns no rows; ask for none rather
    // than sending a filter on an empty id
    return PortalAuth.client().from(table).select(select || "*")
      .eq("shareholder_id", PortalAuth.holderId() || NOBODY);
  }

  /* Documents are yours plus the ones addressed to every holder. */
  function myDocuments() {
    var q = PortalAuth.client().from("documents").select("*");
    var holder = PortalAuth.holderId();
    return holder
      ? q.or("shareholder_id.eq." + holder + ",shareholder_id.is.null")
      : q.is("shareholder_id", null);
  }

  /* A database function, with the same { data } or { error } shape as a read.
     Postgres error text from the register's own checks is written for people,
     so it is passed straight through. */
  function rpc(name, args) {
    return PortalAuth.client().rpc(name, args || {}).then(function (r) {
      return r.error ? { error: r.error.message } : { data: r.data };
    });
  }

  /* The portal-users edge function, for anything that touches a sign in. */
  function fn(action, payload) {
    return PortalAuth.callFunction(action, payload).then(function (r) {
      return r && r.error ? { error: r.error } : { data: r };
    });
  }

  /* A view that returns exactly one row, like the caller's own position. */
  function one(name) {
    return PortalAuth.client().from(name).select("*").maybeSingle()
      .then(function (r) { return r.error ? { error: r.error.message } : { data: r.data }; });
  }

  /* The only write in the portal. The four columns below are the ones a
     shareholder owns; a database trigger refuses the update outright if
     anything else has moved, so this list being wrong fails safely. */
  function saveProfile(id, patch) {
    var allowed = {
      phone: patch.phone,
      address: patch.address,
      country: patch.country,
      directory_opt_in: patch.directory_opt_in
    };
    return PortalAuth.client().from("shareholders").update(allowed).eq("id", id)
      .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
  }

  /* ---------- formatting ----------
     One place, because a figure that is written two ways on two pages makes a
     reader wonder which one is right. */
  var CURRENCY = "BDT";

  function money(n, opts) {
    opts = opts || {};
    var v = Number(n);
    if (!isFinite(v)) return "·";
    var s = v.toLocaleString("en-US", {
      minimumFractionDigits: opts.decimals == null ? 2 : opts.decimals,
      maximumFractionDigits: opts.decimals == null ? 2 : opts.decimals
    });
    return (opts.bare ? "" : CURRENCY + " ") + s;
  }

  /* Share counts are whole things and never carry decimals. */
  function shares(n) {
    var v = Number(n);
    return isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "·";
  }

  /* A price per share can be small, so it keeps more places than a total. */
  function price(n) {
    var v = Number(n);
    if (!isFinite(v)) return "·";
    return CURRENCY + " " + v.toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  /* Percentages are rounded for reading but never to zero: a holding of two
     hundredths of a per cent is small, not absent. */
  function pct(n) {
    var v = Number(n);
    if (!isFinite(v)) return "·";
    if (v > 0 && v < 0.01) return "<0.01%";
    return v.toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }

  function date(d) {
    if (!d) return "·";
    var x = new Date(d.length === 10 ? d + "T00:00:00" : d);
    if (isNaN(x)) return "·";
    return x.toLocaleDateString("en-GB",
      { day: "numeric", month: "short", year: "numeric" });
  }

  function dateTime(d) {
    if (!d) return "·";
    var x = new Date(d);
    if (isNaN(x)) return "·";
    return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      ", " + x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function bytes(n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return "";
    var u = ["B", "KB", "MB", "GB"], i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v < 10 && i > 0 ? 1 : 0) + " " + u[i];
  }

  /* Movement against what was paid. Returns the parts rather than a string, so
     a caller can put the figure and its direction where it wants them. */
  function change(nowValue, cost) {
    var a = Number(nowValue), b = Number(cost);
    if (!isFinite(a) || !isFinite(b) || b === 0) {
      return { abs: 0, pct: 0, dir: "flat", sign: "" };
    }
    var abs = a - b;
    var dir = abs > 0.005 ? "up" : abs < -0.005 ? "down" : "flat";
    return {
      abs: abs,
      pct: (abs / b) * 100,
      dir: dir,
      // the sign is in the text, so colour is never the only carrier
      sign: dir === "up" ? "+" : dir === "down" ? "−" : ""
    };
  }

  /* The rendered movement. In a column already headed "Against cost" the
     words are noise, so a caller in a table asks for the bare form. */
  function deltaHtml(nowValue, cost, opts) {
    var bare = opts && opts.bare;
    var c = change(nowValue, cost);
    if (c.dir === "flat") {
      return '<span class="delta delta-flat">' +
        (bare ? "No change" : "No change against cost") + "</span>";
    }
    return '<span class="delta delta-' + c.dir + '">' + c.sign +
      money(Math.abs(c.abs), { bare: true }) + " · " + c.sign +
      Math.abs(c.pct).toFixed(1) + "%" + (bare ? "" : " against cost") + "</span>";
  }

  /* A figure for a stat card. The currency code is set small and grey so a
     long number stays on one line and the digits stay the thing you read. */
  function moneyBig(n) {
    var v = Number(n);
    if (!isFinite(v)) return "·";
    return '<span class="cur">' + CURRENCY + "</span>" + money(v, { bare: true });
  }

  /* The same for a percentage movement, where the sign and the size are the
     headline and the amount belongs underneath. */
  function deltaBig(nowValue, cost) {
    var c = change(nowValue, cost);
    if (c.dir === "flat") return '<span class="delta-flat">No change</span>';
    return '<span class="delta-' + c.dir + '">' + c.sign +
      Math.abs(c.pct).toFixed(1) + "%</span>";
  }

  /* ---------- small renderers ---------- */
  function statCard(label, value, sub, id) {
    return '<div class="stat">' +
      '<div class="label">' + U.escapeHtml(label) + "</div>" +
      '<div class="value"' + (id ? ' id="' + id + '"' : "") + ">" + value + "</div>" +
      (sub ? '<div class="sub">' + sub + "</div>" : "") +
    "</div>";
  }

  /* A skeleton at the size of the thing it stands in for, so nothing jumps
     when the real content lands. */
  function loadingStats(n) {
    var one = '<div class="stat"><div class="label">&nbsp;</div>' +
      '<div class="skel skel-fig"></div></div>';
    return '<div class="stats">' + new Array(n + 1).join(one) + "</div>";
  }
  function loadingLines(n) {
    var out = "";
    for (var i = 0; i < (n || 3); i++) out += '<div class="skel skel-line"></div>';
    return '<div class="panel-body">' + out + "</div>";
  }

  function kv(pairs) {
    return '<dl class="kv">' + pairs.map(function (p) {
      return "<dt>" + U.escapeHtml(p[0]) + "</dt><dd>" + p[1] + "</dd>";
    }).join("") + "</dl>";
  }

  function tag(text, kind) {
    return '<span class="tag tag-' + kind + '">' + U.escapeHtml(text) + "</span>";
  }

  /* Status words arrive from the database as machine tokens. One place decides
     what each looks like, so "settled" is never green on one page and grey on
     another. */
  var STATE = {
    settled: ["Settled", "live"], paid: ["Paid", "paid"],
    pending: ["Pending", "pending"], approved: ["Approved", "pending"],
    announced: ["Announced", "draft"], cancelled: ["Cancelled", "cancelled"],
    failed: ["Failed", "cancelled"], active: ["Active", "live"],
    transferred: ["Transferred", "draft"], exited: ["Exited", "cancelled"],
    suspended: ["Suspended", "cancelled"]
  };
  function stateTag(value) {
    var s = STATE[value] || [String(value || "·"), "draft"];
    return tag(s[0], s[1]);
  }

  var KIND = {
    purchase: "Purchase", allocation: "Allocation", transfer_in: "Transfer in",
    transfer_out: "Transfer out", bonus: "Bonus issue", adjustment: "Adjustment"
  };
  function txKind(k) { return KIND[k] || k; }

  var DOC_KIND = {
    certificate: "Share certificate", agreement: "Agreement",
    dividend_statement: "Dividend statement", tax: "Tax document",
    annual_report: "Annual report", company: "Company document"
  };
  function docKind(k) { return DOC_KIND[k] || k; }

  var UPDATE_KIND = {
    announcement: "Announcement", investor_update: "Investor update",
    dividend: "Dividend", document: "Document", meeting: "Meeting"
  };
  function updateKind(k) { return UPDATE_KIND[k] || k; }

  /* A proportion drawn as well as written. Hidden from screen readers, because
     the figure beside it already says the same thing. */
  function bar(percent, key) {
    var w = Math.max(0, Math.min(100, Number(percent) || 0));
    return '<div class="bar' + (key ? " bar-key" : "") + '" aria-hidden="true">' +
      '<i style="width:' + w.toFixed(2) + '%"></i></div>';
  }

  return {
    NAV: NAV, I: I, svg: U.svg, escapeHtml: U.escapeHtml,
    Shell: Shell, toast: U.toast, modal: U.modal, failed: U.failed,
    panel: U.panel, empty: U.empty, notice: U.notice, table: U.table,

    rows: rows, view: view, one: one, mine: mine, myDocuments: myDocuments, rpc: rpc, fn: fn,
    saveProfile: saveProfile,

    money: money, shares: shares, price: price, pct: pct,
    date: date, dateTime: dateTime, bytes: bytes,
    change: change, deltaHtml: deltaHtml, moneyBig: moneyBig, deltaBig: deltaBig,

    statCard: statCard, loadingStats: loadingStats, loadingLines: loadingLines,
    kv: kv, tag: tag, stateTag: stateTag, bar: bar,
    txKind: txKind, docKind: docKind, updateKind: updateKind,
    CURRENCY: CURRENCY
  };
})();
