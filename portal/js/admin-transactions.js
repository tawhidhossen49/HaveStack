/* admin-transactions: Share movements
   Issuing, adjusting and transferring shares. Every movement goes through a
   database function that writes the ledger entry and moves the certificates in
   the same transaction, so the ledger and the certificates cannot disagree,
   and a settled entry cannot be edited afterwards. This page describes what a
   movement will do before it is recorded, using the same arithmetic. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-transactions.html", "Share movements",
      "Issue, adjust and transfer shares. Each is recorded in the ledger and on the certificates together.",
      null, me);
    if (!content) return;

    var state = { register: [], classes: [], lots: [], ledger: [], totals: null, filter: "" };
    var KINDS = [
      { value: "allocation", label: "Allocation: shares issued to the holder" },
      { value: "purchase", label: "Purchase: shares bought from the company" },
      { value: "bonus", label: "Bonus issue: shares issued free" },
      { value: "adjustment", label: "Adjustment: a correction, up or down" }
    ];

    content.innerHTML =
      A.banner("A settled movement is permanent: it changes the holder's certificates immediately, is " +
        "written to the audit trail, and cannot be edited. A mistake is put right with an adjustment. " +
        "Any dividend not yet paid whose record date the movement falls before is worked out again " +
        "automatically.") +
      '<div class="split">' +
        P.panel({
          title: "Issue or adjust shares",
          body:
            '<form id="if" novalidate><div class="form-grid">' +
              A.field("i-holder", "Holder", A.select("i-holder", []), "", true) +
              A.field("i-class", "Share class", A.select("i-class", [])) +
              A.field("i-kind", "Kind", A.select("i-kind", KINDS, "allocation")) +
              A.field("i-shares", "Number of shares", A.input("i-shares", { type: "number", step: "1", inputmode: "numeric", placeholder: "0" }),
                "For an adjustment, a negative number reduces the holding.") +
              A.field("i-price", "Price per share, BDT", A.input("i-price", { type: "number", min: "0", step: "0.01", inputmode: "decimal", placeholder: "0.00" })) +
              A.field("i-date", "Date", A.input("i-date", { type: "date", value: A.today(), max: A.today() })) +
              A.field("i-status", "Status", A.select("i-status", [
                { value: "settled", label: "Settled: takes effect now" },
                { value: "pending", label: "Pending: recorded, not yet in effect" }], "settled")) +
              A.field("i-party", "Counterparty", A.input("i-party", { value: "HaveStack Technologies" })) +
              A.field("i-note", "Note", A.input("i-note", { placeholder: "For example, the board resolution" }), "", true) +
            "</div>" +
            '<div class="impact" id="i-impact" aria-live="polite">Choose a holder and a number of shares.</div>' +
            '<button class="btn btn-key" type="submit" id="i-go">Record it</button></form>'
        }) +
        P.panel({
          title: "Transfer between holders",
          body:
            '<form id="tf" novalidate><div class="form-grid">' +
              A.field("t-from", "From", A.select("t-from", []), "", true) +
              A.field("t-to", "To", A.select("t-to", []), "", true) +
              A.field("t-class", "Share class", A.select("t-class", [])) +
              A.field("t-shares", "Number of shares", A.input("t-shares", { type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "0" })) +
              A.field("t-price", "Price per share, BDT", A.input("t-price", { type: "number", min: "0", step: "0.01", inputmode: "decimal", placeholder: "0.00" }),
                "The receiver's cost. Leave at zero for a gift.") +
              A.field("t-date", "Date", A.input("t-date", { type: "date", value: A.today(), max: A.today() })) +
              A.field("t-note", "Note", A.input("t-note", { placeholder: "For example, the share transfer form" }), "", true) +
            "</div>" +
            '<div class="impact" id="t-impact" aria-live="polite">Choose who the shares move between.</div>' +
            '<button class="btn btn-key" type="submit" id="t-go">Transfer the shares</button></form>'
        }) +
      "</div>" +
      '<div id="m-pending"></div>' +
      P.panel({
        title: "Ledger",
        note: "Every movement on the register, newest first.",
        flush: true,
        actions: '<div class="search">' + P.svg(P.I.search, 15) +
          '<input type="search" id="l-q" placeholder="Search holder or reference" aria-label="Search the ledger" /></div>',
        body: '<div id="l-list">' + P.loadingLines(5) + "</div>"
      });

    /* ---- what someone holds, from their open certificates ------------------ */
    function held(holderId, classId) {
      return state.lots.filter(function (l) {
        return l.shareholder_id === holderId && (!classId || l.class_id === classId);
      }).reduce(function (n, l) { return n + Number(l.shares); }, 0);
    }
    function who(id) { return state.register.filter(function (h) { return h.id === id; })[0]; }
    function cls(id) { return state.classes.filter(function (c) { return c.id === id; })[0]; }

    function fill() {
      var holders = A.holderOptions(state.register, { placeholder: "Choose a holder", withShares: true });
      var classes = A.classOptions(state.classes);
      [["i-holder", holders], ["t-from", holders], ["t-to", holders]].forEach(function (pair) {
        var el = document.getElementById(pair[0]), keep = el.value;
        el.innerHTML = A.options(pair[1], keep);
      });
      ["i-class", "t-class"].forEach(function (id) {
        var el = document.getElementById(id), keep = el.value;
        el.innerHTML = A.options(classes, keep || (classes[0] && classes[0].value));
      });
    }

    function issueImpact() {
      var box = document.getElementById("i-impact");
      var h = who(A.val("i-holder")), c = cls(A.val("i-class"));
      var n = A.num("i-shares"), kind = A.val("i-kind"), status = A.val("i-status");
      if (!h || !c || !n) { box.textContent = "Choose a holder and a number of shares."; return; }
      if (n < 0 && kind !== "adjustment") { box.innerHTML = "Only an <b>adjustment</b> can reduce a holding."; return; }
      if (n % 1) { box.textContent = "Shares are whole numbers."; return; }
      var now = held(h.id, c.id), after = now + n;
      if (after < 0) {
        box.innerHTML = "<b>" + P.escapeHtml(h.full_name) + "</b> holds only " + P.shares(now) + " " + P.escapeHtml(c.code) + " shares, so this would be refused.";
        return;
      }
      var totals = state.totals || {};
      if (n > 0 && Number(totals.company_total) > 0 && n > Number(totals.unallocated)) {
        box.innerHTML = "The company has <b>" + P.shares(totals.company_total) + "</b> shares and " +
          P.shares(totals.total_shares) + " are already allotted, so only <b>" +
          P.shares(totals.unallocated) + "</b> can be issued. Raise the company total under " +
          "Register and access first.";
        return;
      }
      if (status === "pending") {
        box.innerHTML = "Recorded as <b>pending</b>. Nothing changes for " + P.escapeHtml(h.full_name) + " until you settle it below.";
        return;
      }
      var price = A.num("i-price") || 0;
      box.innerHTML = "<b>" + P.escapeHtml(h.full_name) + "</b> goes from <b>" + P.shares(now) + "</b> to <b>" + P.shares(after) + "</b> " +
        P.escapeHtml(c.code) + " shares. " +
        (n > 0 ? "A new certificate is issued" + (price > 0 ? " at " + P.price(price) + " a share, " + P.money(n * price) + " in total." : " at no cost.")
               : "Certificates are closed oldest first, and any remainder is reissued at its original cost.");
    }

    function transferImpact() {
      var box = document.getElementById("t-impact");
      var f = who(A.val("t-from")), t = who(A.val("t-to")), c = cls(A.val("t-class")), n = A.num("t-shares");
      if (!f || !t || !c) { box.textContent = "Choose who the shares move between."; return; }
      if (f.id === t.id) { box.textContent = "Choose two different holders."; return; }
      if (!(n > 0) || n % 1) { box.textContent = "Enter a whole number of shares to transfer."; return; }
      var fromNow = held(f.id, c.id), toNow = held(t.id, c.id);
      if (n > fromNow) {
        box.innerHTML = "<b>" + P.escapeHtml(f.full_name) + "</b> holds only " + P.shares(fromNow) + " " + P.escapeHtml(c.code) + " shares, so this would be refused.";
        return;
      }
      box.innerHTML = "<b>" + P.escapeHtml(f.full_name) + "</b> goes from " + P.shares(fromNow) + " to <b>" + P.shares(fromNow - n) + "</b>; " +
        "<b>" + P.escapeHtml(t.full_name) + "</b> from " + P.shares(toNow) + " to <b>" + P.shares(toNow + n) + "</b> " + P.escapeHtml(c.code) + " shares. " +
        "Two ledger entries are written, the sender's certificates are closed oldest first with any remainder reissued at its original cost, and the receiver gets a new certificate.";
    }

    ["i-holder", "i-class", "i-kind", "i-shares", "i-price", "i-status"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", issueImpact);
      document.getElementById(id).addEventListener("change", issueImpact);
    });
    ["t-from", "t-to", "t-class", "t-shares"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", transferImpact);
      document.getElementById(id).addEventListener("change", transferImpact);
    });

    document.getElementById("if").addEventListener("submit", function (e) {
      e.preventDefault();
      var h = who(A.val("i-holder")), c = cls(A.val("i-class")), n = A.num("i-shares"), kind = A.val("i-kind");
      var date = A.val("i-date"), status = A.val("i-status"), price = A.num("i-price") || 0;
      if (!h) { P.toast("Choose a holder.", true); return; }
      if (!c) { P.toast("Choose a share class.", true); return; }
      if (!n || n % 1) { P.toast("Enter a whole number of shares.", true); return; }
      if (n < 0 && kind !== "adjustment") { P.toast("Only an adjustment can reduce a holding.", true); return; }
      if (!date || date > A.today()) { P.toast("Choose a date that is not in the future.", true); return; }
      A.confirm("Record this movement",
        document.getElementById("i-impact").innerHTML + (status === "settled" ? " This cannot be edited afterwards." : ""),
        "Record it"
      ).then(function (yes) {
        if (!yes) return;
        var restore = A.busy(document.getElementById("i-go"), "Recording");
        P.rpc("portal_record_transaction", {
          p_shareholder: h.id, p_class: c.id, p_kind: kind, p_shares: n, p_unit_price: price,
          p_occurred_on: date, p_counterparty: A.val("i-party"), p_note: A.val("i-note"), p_status: status
        }).then(function (r) {
          restore();
          if (r.error) { P.toast(r.error, true); return; }
          P.toast(status === "settled" ? "Recorded, and " + h.full_name + "'s certificates updated." : "Recorded as pending.");
          document.getElementById("i-shares").value = "";
          document.getElementById("i-note").value = "";
          load();
        });
      });
    });

    document.getElementById("tf").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = who(A.val("t-from")), t = who(A.val("t-to")), c = cls(A.val("t-class")), n = A.num("t-shares");
      var date = A.val("t-date");
      if (!f || !t) { P.toast("Choose who the shares move between.", true); return; }
      if (f.id === t.id) { P.toast("Choose two different holders.", true); return; }
      if (!c) { P.toast("Choose a share class.", true); return; }
      if (!(n > 0) || n % 1) { P.toast("Enter a whole number of shares.", true); return; }
      if (n > held(f.id, c.id)) { P.toast(f.full_name + " does not hold that many " + c.code + " shares.", true); return; }
      if (!date || date > A.today()) { P.toast("Choose a date that is not in the future.", true); return; }
      A.confirm("Transfer shares",
        document.getElementById("t-impact").innerHTML + " This cannot be edited afterwards.",
        "Transfer"
      ).then(function (yes) {
        if (!yes) return;
        var restore = A.busy(document.getElementById("t-go"), "Transferring");
        P.rpc("portal_transfer_shares", {
          p_from: f.id, p_to: t.id, p_class: c.id, p_shares: n,
          p_unit_price: A.num("t-price") || 0, p_occurred_on: date, p_note: A.val("t-note")
        }).then(function (r) {
          restore();
          if (r.error) { P.toast(r.error, true); return; }
          P.toast(P.shares(n) + " shares transferred from " + f.full_name + " to " + t.full_name + ".");
          document.getElementById("t-shares").value = "";
          document.getElementById("t-note").value = "";
          load();
        });
      });
    });

    /* ---- pending entries ------------------------------------------------- */
    function renderPending() {
      var box = document.getElementById("m-pending");
      var pending = state.ledger.filter(function (t) { return t.status === "pending"; });
      if (!pending.length) { box.innerHTML = ""; return; }
      box.innerHTML = P.panel({
        title: "Waiting to be settled",
        note: "Recorded but not yet in effect. Settling one changes the certificates; cancelling keeps it in the ledger as cancelled.",
        flush: true,
        body: P.table(["Date", "Holder", "Movement", "Shares", "Reference", ""],
          pending.map(function (t) {
            var h = t.shareholders || {};
            return "<tr>" +
              '<td class="num">' + P.date(t.occurred_on) + "</td>" +
              "<td>" + P.escapeHtml(h.full_name || "") + '<div class="row-note">' + P.escapeHtml(h.investor_ref || "") + "</div></td>" +
              "<td>" + P.escapeHtml(P.txKind(t.kind)) + '<div class="row-note">' + P.escapeHtml((t.share_classes && t.share_classes.code) || "") + "</div></td>" +
              '<td class="money">' + P.shares(t.shares) + "</td>" +
              '<td class="num">' + P.escapeHtml(t.reference) + "</td>" +
              '<td><div class="row-actions" style="justify-content:flex-end">' +
                '<button class="btn btn-sm btn-key" type="button" data-settle="' + t.id + '">Settle</button>' +
                '<button class="btn btn-sm btn-danger" type="button" data-cancel-tx="' + t.id + '">Cancel</button>' +
              "</div></td>" +
            "</tr>";
          }).join(""))
      });
    }

    document.getElementById("m-pending").addEventListener("click", function (e) {
      var s = e.target.closest("[data-settle]"), c = e.target.closest("[data-cancel-tx]");
      var id = s ? s.getAttribute("data-settle") : c ? c.getAttribute("data-cancel-tx") : null;
      var t = state.ledger.filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      var name = (t.shareholders && t.shareholders.full_name) || "the holder";
      A.confirm(s ? "Settle " + t.reference : "Cancel " + t.reference,
        s ? "Put <b>" + P.shares(t.shares) + "</b> shares into effect for " + P.escapeHtml(name) + "? Their certificates change now, and it cannot be undone."
          : "Cancel this pending " + P.escapeHtml(P.txKind(t.kind).toLowerCase()) + " for " + P.escapeHtml(name) + "? It stays in the ledger as cancelled.",
        s ? "Settle it" : "Cancel it"
      ).then(function (yes) {
        if (!yes) return;
        P.rpc(s ? "portal_settle_transaction" : "portal_cancel_transaction", { p_tx: t.id }).then(function (r) {
          if (r.error) { P.toast(r.error, true); return; }
          P.toast(s ? t.reference + " settled." : t.reference + " cancelled.");
          load();
        });
      });
    });

    /* ---- the ledger ------------------------------------------------------ */
    function renderLedger() {
      var box = document.getElementById("l-list");
      var q = A.val("l-q").toLowerCase();
      var list = state.ledger.filter(function (t) {
        if (!q) return true;
        var h = t.shareholders || {};
        return [h.full_name, h.investor_ref, t.reference, t.counterparty, t.note, P.txKind(t.kind)]
          .join(" ").toLowerCase().indexOf(q) > -1;
      });
      if (!state.ledger.length) { box.innerHTML = P.empty("No movements yet", "Every issue, adjustment and transfer appears here."); return; }
      if (!list.length) { box.innerHTML = P.empty("Nothing matches", "No movement matches that search."); return; }
      box.innerHTML = P.table(["Date", "Holder", "Movement", "Shares", "Value", "Reference", "Status"],
        list.map(function (t) {
          var h = t.shareholders || {};
          return "<tr>" +
            '<td class="num">' + P.date(t.occurred_on) + "</td>" +
            "<td>" + P.escapeHtml(h.full_name || "") + '<div class="row-note">' + P.escapeHtml(h.investor_ref || "") + "</div></td>" +
            "<td>" + P.escapeHtml(P.txKind(t.kind)) + '<div class="row-note">' +
              P.escapeHtml((t.share_classes && t.share_classes.code) || "") + "</div></td>" +
            '<td class="money">' + (Number(t.shares) > 0 ? "+" : "") + P.shares(t.shares) + "</td>" +
            '<td class="money">' + (Number(t.total_value) ? P.money(t.total_value) : "·") +
              (Number(t.unit_price) ? '<div class="row-note">at ' + P.price(t.unit_price) + "</div>" : "") + "</td>" +
            '<td class="num">' + P.escapeHtml(t.reference) + "</td>" +
            "<td>" + P.stateTag(t.status) + "</td>" +
          "</tr>";
        }).join(""));
    }
    document.getElementById("l-q").addEventListener("input", renderLedger);

    function load() {
      return Promise.all([
        A.register(),
        A.classes(),
        PortalAuth.client().from("holdings").select("shareholder_id,class_id,shares").eq("status", "active")
          .then(function (r) { return r; }),
        PortalAuth.client().from("transactions")
          .select("*,shareholders(full_name,investor_ref),share_classes(code)")
          .order("occurred_on", { ascending: false }).order("created_at", { ascending: false })
          .then(function (r) { return r; }),
        A.totals()
      ]).then(function (res) {
        if (res[0].error) { document.getElementById("l-list").innerHTML = P.failed(res[0].error); return; }
        state.register = res[0].data || [];
        state.classes = res[1].error ? [] : (res[1].data || []);
        state.lots = res[2].error ? [] : (res[2].data || []);
        state.ledger = res[3].error ? [] : (res[3].data || []);
        state.totals = res[4].error ? null : res[4].data;
        fill();
        issueImpact();
        transferImpact();
        renderPending();
        renderLedger();
      });
    }

    load();
  });
})();
