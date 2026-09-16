/* =========================================================
   portal-admin.js
   ---------------------------------------------------------
   Shared pieces for the portal's Administration pages: form
   controls in the console's own style, the lists those forms
   choose from, confirmation before anything other people will
   see, and the plain language summary of an audit entry.

   Loaded only on administration pages, after portal-common.

   None of this is the security boundary. Every rule it
   appears to enforce is enforced again by the database, which
   refuses a holder whatever this file does; the checks here
   exist so an administrator hears about a mistake before
   pressing save rather than after.
   ========================================================= */
window.PortalAdmin = (function () {
  "use strict";

  var P = window.Portal;
  var esc = P.escapeHtml;

  /* ---------- markup ---------- */
  function banner(text) {
    return '<div class="admin-banner">' + P.svg(P.I.info, 16) + "<div>" + text + "</div></div>";
  }

  function field(id, label, control, hint, full) {
    return '<div class="field' + (full ? " full" : "") + '">' +
      '<label for="' + id + '">' + esc(label) + "</label>" + control +
      (hint ? '<span class="hint" id="' + id + '-hint">' + hint + "</span>" : "") +
    "</div>";
  }

  function input(id, attrs) {
    attrs = attrs || {};
    var out = '<input id="' + id + '" type="' + (attrs.type || "text") + '"';
    ["value", "min", "max", "step", "placeholder", "autocomplete", "inputmode", "accept"].forEach(function (k) {
      if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") {
        out += " " + k + '="' + esc(attrs[k]) + '"';
      }
    });
    return out + " />";
  }

  function select(id, list, selected) {
    return '<select id="' + id + '">' + options(list, selected) + "</select>";
  }

  function options(list, selected) {
    return (list || []).map(function (o) {
      var v = o.value === undefined ? o : o.value;
      var l = o.label === undefined ? v : o.label;
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? " selected" : "") + ">" +
        esc(l) + "</option>";
    }).join("");
  }

  function textarea(id, value, rows) {
    return '<textarea id="' + id + '" rows="' + (rows || 4) + '">' + esc(value || "") + "</textarea>";
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function num(id) {
    var raw = val(id).replace(/,/g, "");
    return raw === "" ? NaN : Number(raw);
  }

  /* A button that says what it is doing while it does it, and cannot be
     pressed twice. Returns the function that puts it back. */
  function busy(btn, text) {
    if (!btn) return function () {};
    var was = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = text || "Saving";
    return function () { btn.disabled = false; btn.innerHTML = was; };
  }

  /* Ask before doing something other people will see. The consequence goes in
     the question, so pressing Confirm is agreeing to something specific. */
  function confirm(title, text, confirmLabel) {
    return P.modal({
      title: title,
      confirm: confirmLabel || "Confirm",
      fields: [],
      before: '<p class="confirm-text">' + text + "</p>"
    }).then(function (v) { return !!v; });
  }

  /* ---------- dates ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function addDays(iso, days) {
    var p = String(iso).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- the lists forms choose from ---------- */
  function register() {
    return P.view("v_register", "full_name");
  }

  function classes() {
    return P.rows("share_classes", "sort");
  }

  function totals() {
    return P.one("v_share_totals");
  }

  function holderOptions(list, opts) {
    opts = opts || {};
    var rows = (list || []).filter(function (h) { return opts.all || h.status === "active"; });
    var out = rows.map(function (h) {
      return {
        value: h.id,
        label: h.full_name + " · " + h.investor_ref +
          (opts.withShares ? "  (" + P.shares(h.shares) + " shares)" : "") +
          (h.status !== "active" ? " · " + h.status : "")
      };
    });
    if (opts.placeholder) out.unshift({ value: "", label: opts.placeholder });
    return out;
  }

  function classOptions(list, opts) {
    opts = opts || {};
    var out = (list || []).map(function (c) { return { value: c.id, label: c.code + " · " + c.name }; });
    if (opts.allLabel) out.unshift({ value: "", label: opts.allLabel });
    return out;
  }

  /* ---------- the audit trail in plain language ---------- */
  var TABLE_NAMES = {
    share_classes: "share class", shareholders: "shareholder", holdings: "certificate",
    transactions: "ledger entry", valuations: "share price", dividends: "dividend",
    dividend_payments: "dividend payment", documents: "document", updates: "announcement",
    company_facts: "company fact", portal_accounts: "portal access"
  };

  function summarize(row) {
    if (row.summary) return row.summary;
    var n = row.new_row || {}, o = row.old_row || {};
    var what = TABLE_NAMES[row.table_name] || row.table_name;
    switch (row.table_name) {
      case "valuations":
        if (row.action === "insert") return "Set the share price at " + P.price(n.price_per_share) + " from " + P.date(n.effective_on);
        if (row.action === "update" && n.price_per_share !== o.price_per_share) return "Changed the share price of " + P.date(n.effective_on) + " from " + P.price(o.price_per_share) + " to " + P.price(n.price_per_share);
        if (row.action === "update" && n.published !== o.published) return (n.published ? "Published" : "Hid") + " the share price of " + P.date(n.effective_on);
        break;
      case "transactions":
        if (row.action === "insert") return "Recorded " + P.txKind(n.kind).toLowerCase() + " " + n.reference + " of " + P.shares(Math.abs(n.shares)) + " shares";
        if (n.status !== o.status) return "Marked " + n.reference + " " + n.status;
        return "Linked " + (n.reference || "an entry") + " to its certificate";
      case "holdings":
        if (row.action === "insert") return "Issued certificate " + n.certificate_no + " for " + P.shares(n.shares) + " shares";
        if (n.status !== o.status) return "Closed certificate " + n.certificate_no + " (" + n.status + ")";
        break;
      case "dividends":
        if (row.action === "insert") return "Declared " + n.title + " at " + P.price(n.per_share) + " per share";
        if (n.status !== o.status) return "Marked " + n.title + " " + n.status;
        return "Changed " + n.title;
      case "dividend_payments":
        if (row.action === "insert") return "Worked out an entitlement of " + P.shares(n.eligible_shares) + " shares, " + P.money(n.net) + " net";
        if (row.action === "delete") return "Cleared an entitlement to work it out again";
        if (n.status !== o.status) return "Marked a dividend payment " + n.status;
        break;
      case "shareholders":
        if (row.action === "insert") return "Added " + n.full_name + " (" + n.investor_ref + ") to the register";
        if (n.status !== o.status) return "Changed " + n.full_name + " from " + o.status + " to " + n.status;
        return "Updated " + (n.full_name || o.full_name) + "'s record";
      case "updates":
        if (row.action === "insert") return (n.automatic ? "Automatically posted" : "Posted") + ' "' + n.title + '"';
        if (row.action === "delete") return 'Deleted "' + o.title + '"';
        return 'Changed "' + n.title + '"';
      case "documents":
        if (row.action === "insert") return 'Published "' + n.title + '"';
        if (row.action === "delete") return 'Deleted "' + o.title + '"';
        return 'Changed "' + n.title + '"';
    }
    var verb = { insert: "Added", update: "Changed", delete: "Removed" }[row.action] || row.action;
    return verb + " a " + what;
  }

  /* The fields that actually changed, for the detail view. */
  function diff(oldRow, newRow) {
    var o = oldRow || {}, n = newRow || {};
    var keys = Object.keys(o).concat(Object.keys(n))
      .filter(function (k, i, all) { return all.indexOf(k) === i; })
      .filter(function (k) { return ["updated_at", "created_at"].indexOf(k) < 0; });
    return keys.filter(function (k) {
      return JSON.stringify(o[k]) !== JSON.stringify(n[k]);
    }).map(function (k) {
      return { field: k, before: o[k], after: n[k] };
    });
  }

  return {
    banner: banner, field: field, input: input, select: select, options: options,
    textarea: textarea, val: val, num: num, busy: busy, confirm: confirm,
    today: today, addDays: addDays,
    register: register, classes: classes, totals: totals,
    holderOptions: holderOptions, classOptions: classOptions,
    summarize: summarize, diff: diff
  };
})();
