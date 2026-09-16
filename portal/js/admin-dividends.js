/* admin-dividends: Declare dividends
   Declaring a dividend is one form. The database works out every holder's
   entitlement from the ledger as it stood on the record date, gross,
   withholding and net; posts an update telling holders; recalculates if the
   register changes before the record date; and marks every line paid when the
   dividend is marked paid. This page previews the total before declaring, and
   shows each holder's line after. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-dividends.html", "Declare dividends",
      "Declare a dividend once. Every holder's entitlement is worked out for you.", null, me);
    if (!content) return;

    var state = { dividends: [], payments: [], classes: [], lots: [], open: null };
    var year = new Date().getFullYear();

    content.innerHTML =
      A.banner("Entitlements are worked out from the register as it stands on the record date, and " +
        "worked out again automatically if shares move before then. Holders are told when a dividend " +
        "is declared, and again when it is paid. A paid dividend is part of the record and cannot be " +
        "changed.") +
      P.panel({
        title: "Declare a dividend",
        body:
          '<form id="df" novalidate><div class="form-grid">' +
            A.field("d-title", "Name", A.input("d-title", { value: "Interim dividend " + year })) +
            A.field("d-class", "Paid on", A.select("d-class", [])) +
            A.field("d-per", "Per share, BDT", A.input("d-per", { type: "number", min: "0.000001", step: "0.01", inputmode: "decimal", placeholder: "0.00" })) +
            A.field("d-tax", "Withholding, per cent", A.input("d-tax", { type: "number", min: "0", max: "100", step: "0.5", value: "10" })) +
            A.field("d-declared", "Declared on", A.input("d-declared", { type: "date", value: A.today() })) +
            A.field("d-record", "Record date", A.input("d-record", { type: "date", value: A.addDays(A.today(), 14) }),
              "Holders on the register on this date are paid.") +
            A.field("d-payment", "Payment date", A.input("d-payment", { type: "date", value: A.addDays(A.today(), 30) })) +
            A.field("d-status", "Status", A.select("d-status", [
              { value: "approved", label: "Approved by the board" },
              { value: "announced", label: "Announced, awaiting approval" }], "approved")) +
            A.field("d-note", "Note for holders", A.input("d-note", { placeholder: "For example, the period it covers" }), "", true) +
          "</div>" +
          '<div class="impact" id="d-impact" aria-live="polite">Enter an amount per share to see the total.</div>' +
          '<button class="btn btn-key" type="submit" id="d-go">Declare the dividend</button></form>'
      }) +
      P.panel({ title: "Dividends", note: "Newest first.", flush: true, body: '<div id="d-list">' + P.loadingLines(4) + "</div>" }) +
      '<div id="d-detail"></div>';

    function eligibleNow(classId) {
      return state.lots.filter(function (l) { return !classId || l.class_id === classId; })
        .reduce(function (n, l) { return n + Number(l.shares); }, 0);
    }
    function holdersNow(classId) {
      var seen = {};
      state.lots.forEach(function (l) { if (!classId || l.class_id === classId) seen[l.shareholder_id] = true; });
      return Object.keys(seen).length;
    }

    function impact() {
      var box = document.getElementById("d-impact");
      var per = A.num("d-per"), tax = A.num("d-tax"), classId = A.val("d-class");
      if (!(per > 0)) { box.textContent = "Enter an amount per share to see the total."; return; }
      if (!(tax >= 0 && tax <= 100)) { box.textContent = "Withholding is a percentage between 0 and 100."; return; }
      var shares = eligibleNow(classId), gross = shares * per;
      box.innerHTML = "On today's register that is <b>" + P.shares(shares) + "</b> shares across <b>" + holdersNow(classId) +
        "</b> holders: <b>" + P.money(gross) + "</b> gross, " + P.money(gross * tax / 100) + " withheld, <b>" +
        P.money(gross - gross * tax / 100) + "</b> net. The exact figures come from the register on " +
        P.date(A.val("d-record")) + ".";
    }
    ["d-per", "d-tax", "d-class", "d-record"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", impact);
      document.getElementById(id).addEventListener("change", impact);
    });

    document.getElementById("df").addEventListener("submit", function (e) {
      e.preventDefault();
      var title = A.val("d-title"), per = A.num("d-per"), tax = A.num("d-tax");
      var declared = A.val("d-declared"), record = A.val("d-record"), payment = A.val("d-payment");
      if (!title) { P.toast("Give the dividend a name.", true); return; }
      if (!(per > 0)) { P.toast("Enter an amount per share greater than zero.", true); return; }
      if (!(tax >= 0 && tax <= 100)) { P.toast("Withholding is a percentage between 0 and 100.", true); return; }
      if (!declared || !record || !payment) { P.toast("Fill in all three dates.", true); return; }
      if (record < declared) { P.toast("The record date cannot come before the declaration.", true); return; }
      if (payment < record) { P.toast("Payment cannot come before the record date.", true); return; }
      A.confirm("Declare " + title,
        document.getElementById("d-impact").innerHTML + " Every holder is told once you declare it.",
        "Declare it"
      ).then(function (yes) {
        if (!yes) return;
        var restore = A.busy(document.getElementById("d-go"), "Declaring");
        PortalAuth.client().from("dividends").insert({
          title: title, class_id: A.val("d-class") || null, per_share: per, tax_rate: tax,
          declared_on: declared, record_date: record, payment_date: payment,
          status: A.val("d-status"), note: A.val("d-note")
        }).select("id").single().then(function (r) {
          restore();
          if (r.error) { P.toast(r.error.message, true); return; }
          P.toast(title + " declared. Entitlements are worked out and holders have been told.");
          state.open = r.data.id;
          load();
        });
      });
    });

    /* ---- the list -------------------------------------------------------- */
    function lines(id) { return state.payments.filter(function (p) { return p.dividend_id === id; }); }

    function renderList() {
      var box = document.getElementById("d-list");
      if (!state.dividends.length) { box.innerHTML = P.empty("No dividends yet", "Declare one above and it appears here."); return; }
      box.innerHTML = P.table(["Dividend", "Per share", "Record date", "Payment date", "Holders", "Net total", "Status", ""],
        state.dividends.map(function (d) {
          var ls = lines(d.id).filter(function (p) { return p.status !== "cancelled"; });
          var net = ls.reduce(function (n, p) { return n + Number(p.net); }, 0);
          var live = d.status === "announced" || d.status === "approved";
          return "<tr" + (d.id === state.open ? ' class="is-me"' : "") + ">" +
            "<td><b>" + P.escapeHtml(d.title) + "</b>" +
              '<div class="row-note">' + P.escapeHtml((d.share_classes && d.share_classes.code) || "All classes") +
              " · " + Number(d.tax_rate) + "% withheld</div></td>" +
            '<td class="money">' + P.price(d.per_share) + "</td>" +
            '<td class="num">' + P.date(d.record_date) + "</td>" +
            '<td class="num">' + P.date(d.payment_date) + "</td>" +
            '<td class="money">' + ls.length + "</td>" +
            '<td class="money">' + P.money(net) + "</td>" +
            "<td>" + P.stateTag(d.status) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-open="' + d.id + '">Entitlements</button>' +
              (d.status === "announced" ? '<button class="btn btn-sm" type="button" data-approve="' + d.id + '">Approve</button>' : "") +
              (live ? '<button class="btn btn-sm btn-key" type="button" data-pay="' + d.id + '">Mark paid</button>' : "") +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    function renderDetail() {
      var box = document.getElementById("d-detail");
      var d = state.dividends.filter(function (x) { return x.id === state.open; })[0];
      if (!d) { box.innerHTML = ""; return; }
      var ls = lines(d.id).slice().sort(function (a, b) { return Number(b.eligible_shares) - Number(a.eligible_shares); });
      var gross = ls.reduce(function (n, p) { return n + (p.status === "cancelled" ? 0 : Number(p.gross)); }, 0);
      var withheld = ls.reduce(function (n, p) { return n + (p.status === "cancelled" ? 0 : Number(p.tax_withheld)); }, 0);
      box.innerHTML = P.panel({
        title: "Entitlements: " + d.title,
        note: "Worked out from the register on " + P.date(d.record_date) + ". " + P.money(gross) + " gross, " +
          P.money(withheld) + " withheld, " + P.money(gross - withheld) + " net.",
        flush: true,
        // the rarer actions live with the detail, so the list stays readable
        actions: (d.status === "announced" || d.status === "approved"
          ? '<button class="btn btn-sm" type="button" data-recalc="' + d.id + '">Recalculate</button>' +
            '<button class="btn btn-sm btn-danger" type="button" data-cancel-div="' + d.id + '">Cancel dividend</button>'
          : "") +
          '<button class="btn btn-sm" type="button" data-close>Close</button>',
        body: !ls.length
          ? P.empty("Nobody eligible", "Nobody held shares of this class on the record date.")
          : P.table(["Holder", "Eligible shares", "Gross", "Withheld", "Net", "Status", "Reference"],
              ls.map(function (p) {
                var h = p.shareholders || {};
                return "<tr>" +
                  "<td>" + P.escapeHtml(h.full_name || "") + '<div class="row-note">' + P.escapeHtml(h.investor_ref || "") + "</div></td>" +
                  '<td class="money">' + P.shares(p.eligible_shares) + "</td>" +
                  '<td class="money">' + P.money(p.gross) + "</td>" +
                  '<td class="money">' + P.money(p.tax_withheld) + "</td>" +
                  '<td class="money">' + P.money(p.net) + "</td>" +
                  "<td>" + P.stateTag(p.status) + (p.paid_on ? '<div class="row-note">' + P.date(p.paid_on) + "</div>" : "") + "</td>" +
                  '<td class="num">' + P.escapeHtml(p.reference) + "</td>" +
                "</tr>";
              }).join(""))
      });
    }

    content.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { state.open = null; renderList(); renderDetail(); return; }
      var op = e.target.closest("[data-open]");
      if (op) {
        state.open = op.getAttribute("data-open");
        renderList(); renderDetail();
        document.getElementById("d-detail").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      var ap = e.target.closest("[data-approve]"), pay = e.target.closest("[data-pay]"),
          rc = e.target.closest("[data-recalc]"), cn = e.target.closest("[data-cancel-div]");
      var el = ap || pay || rc || cn;
      if (!el) return;
      var id = el.getAttribute(ap ? "data-approve" : pay ? "data-pay" : rc ? "data-recalc" : "data-cancel-div");
      var d = state.dividends.filter(function (x) { return x.id === id; })[0];
      if (!d) return;
      var ls = lines(d.id).filter(function (p) { return p.status === "pending"; });
      var net = ls.reduce(function (n, p) { return n + Number(p.net); }, 0);

      if (rc) {
        P.rpc("portal_recompute_dividend", { p_dividend: d.id }).then(function (r) {
          if (r.error) { P.toast(r.error, true); return; }
          P.toast("Worked out again from the register: " + r.data + " holders.");
          state.open = d.id;
          load();
        });
        return;
      }

      var action = ap ? { status: "approved", title: "Approve " + d.title,
                          text: "Record that the board has approved <b>" + P.escapeHtml(d.title) + "</b>?", button: "Approve", said: "Approved." }
                 : pay ? { status: "paid", title: "Mark " + d.title + " paid",
                          text: "Mark all <b>" + ls.length + "</b> pending lines paid on " + P.date(d.payment_date) + ", <b>" + P.money(net) +
                                "</b> net in total? Holders are told, and a paid dividend cannot be changed afterwards.",
                          button: "Mark it paid", said: "Marked paid, and holders have been told." }
                 : { status: "cancelled", title: "Cancel " + d.title,
                     text: "Cancel <b>" + P.escapeHtml(d.title) + "</b>? No holder is paid, every pending line is cancelled, and holders are told.",
                     button: "Cancel the dividend", said: "Cancelled, and holders have been told." };

      A.confirm(action.title, action.text, action.button).then(function (yes) {
        if (!yes) return;
        el.disabled = true;
        PortalAuth.client().from("dividends").update({ status: action.status }).eq("id", d.id).then(function (r) {
          if (r.error) { el.disabled = false; P.toast(r.error.message, true); return; }
          P.toast(action.said);
          state.open = d.id;
          load();
        });
      });
    });

    function load() {
      return Promise.all([
        PortalAuth.client().from("dividends").select("*,share_classes(code,name)")
          .order("declared_on", { ascending: false }).order("created_at", { ascending: false })
          .then(function (r) { return r; }),
        PortalAuth.client().from("dividend_payments")
          .select("dividend_id,eligible_shares,gross,tax_withheld,net,status,paid_on,reference,shareholders(full_name,investor_ref)")
          .then(function (r) { return r; }),
        A.classes(),
        PortalAuth.client().from("holdings").select("shareholder_id,class_id,shares").eq("status", "active")
          .then(function (r) { return r; })
      ]).then(function (res) {
        if (res[0].error) { document.getElementById("d-list").innerHTML = P.failed(res[0].error.message); return; }
        state.dividends = res[0].data || [];
        state.payments = res[1].error ? [] : (res[1].data || []);
        state.classes = res[2].error ? [] : (res[2].data || []);
        state.lots = res[3].error ? [] : (res[3].data || []);
        var sel = document.getElementById("d-class"), keep = sel.value;
        sel.innerHTML = A.options(A.classOptions(state.classes, { allLabel: "Every class" }), keep);
        renderList();
        renderDetail();
        impact();
      });
    }

    load();
  });
})();
