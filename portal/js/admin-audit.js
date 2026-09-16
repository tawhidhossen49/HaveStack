/* admin-audit: Audit trail
   Every change to the register, who made it and when, with what the record
   looked like before and after. Written by the database itself and by the
   portal-users function; nobody can write to it or change it through the
   portal, including administrators. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;
  var PAGE = 100;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-audit.html", "Audit trail",
      "Every change to the register, by whom and when.", null, me);
    if (!content) return;

    var AREAS = [
      ["all", "Everything", null],
      ["price", "Share price", ["valuations"]],
      ["register", "Register", ["shareholders"]],
      ["movements", "Movements", ["transactions", "holdings"]],
      ["dividends", "Dividends", ["dividends", "dividend_payments"]],
      ["access", "Access", ["portal_accounts"]],
      ["content", "Updates and documents", ["updates", "documents", "company_facts", "share_classes"]]
    ];
    var state = { rows: [], area: "all", done: false };

    content.innerHTML =
      A.banner("This record is written by the database, not by the portal pages, so a change made any " +
        "way at all is in it. It cannot be edited or deleted from the portal.") +
      P.panel({
        title: "Changes",
        flush: true,
        actions:
          '<div class="seg" role="group" aria-label="Which changes">' +
            AREAS.map(function (a) {
              return '<button type="button" data-area="' + a[0] + '" aria-pressed="' + (a[0] === "all") + '">' + a[1] + "</button>";
            }).join("") +
          "</div>" +
          '<div class="search">' + P.svg(P.I.search, 15) +
            '<input type="search" id="a-q" placeholder="Search" aria-label="Search the audit trail" /></div>',
        body: '<div id="a-list">' + P.loadingLines(6) + "</div>",
        foot: '<button class="btn btn-sm" type="button" id="a-more" hidden>Load older changes</button>'
      });

    function tables() {
      var a = AREAS.filter(function (x) { return x[0] === state.area; })[0];
      return a ? a[2] : null;
    }

    function render() {
      var box = document.getElementById("a-list");
      var q = A.val("a-q").toLowerCase();
      var list = state.rows.filter(function (r) {
        return !q || (A.summarize(r) + " " + r.actor_email + " " + r.table_name).toLowerCase().indexOf(q) > -1;
      });
      document.getElementById("a-more").hidden = state.done;
      if (!state.rows.length) {
        box.innerHTML = P.empty("Nothing recorded", state.area === "all"
          ? "Changes to the register appear here as they are made."
          : "No changes of this kind have been made.");
        return;
      }
      if (!list.length) { box.innerHTML = P.empty("Nothing matches", "No change matches that search."); return; }
      box.innerHTML = P.table(["When", "Who", "What happened", ""],
        list.map(function (r) {
          return "<tr>" +
            '<td class="num">' + P.dateTime(r.at) + "</td>" +
            "<td>" + P.escapeHtml(r.actor_email || "system") +
              (r.actor_email === "system" ? '<div class="row-note">Automatic</div>' : "") + "</td>" +
            "<td>" + P.escapeHtml(A.summarize(r)) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              ((r.old_row || r.new_row) ? '<button class="btn btn-sm" type="button" data-detail="' + r.id + '">Details</button>' : "") +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    function show(value) {
      if (value === null || value === undefined) return "·";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    }

    content.addEventListener("click", function (e) {
      var ar = e.target.closest("[data-area]");
      if (ar) {
        state.area = ar.getAttribute("data-area");
        ar.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === ar)); });
        load(true);
        return;
      }
      if (e.target.closest("#a-more")) { load(false); return; }
      var dt = e.target.closest("[data-detail]");
      if (dt) {
        var r = state.rows.filter(function (x) { return String(x.id) === dt.getAttribute("data-detail"); })[0];
        if (!r) return;
        var changes = A.diff(r.old_row, r.new_row);
        P.modal({
          title: A.summarize(r),
          note: P.dateTime(r.at) + ", " + (r.actor_email || "system"),
          confirm: "Close",
          fields: [],
          before: !changes.length ? '<p class="confirm-text">No field values changed.</p>' :
            '<div class="table-wrap"><table class="table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>' +
              changes.map(function (c) {
                return "<tr><td>" + P.escapeHtml(c.field) + "</td>" +
                  '<td class="audit-diff">' + P.escapeHtml(show(c.before)) + "</td>" +
                  '<td class="audit-diff">' + P.escapeHtml(show(c.after)) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
        });
      }
    });
    document.getElementById("a-q").addEventListener("input", render);

    function load(fresh) {
      if (fresh) { state.rows = []; state.done = false; }
      var q = PortalAuth.client().from("portal_audit").select("*")
        .order("at", { ascending: false }).order("id", { ascending: false })
        .range(state.rows.length, state.rows.length + PAGE - 1);
      var t = tables();
      if (t) q = q.in("table_name", t);
      return q.then(function (r) {
        if (r.error) { document.getElementById("a-list").innerHTML = P.failed(r.error.message); return; }
        var got = r.data || [];
        state.rows = state.rows.concat(got);
        state.done = got.length < PAGE;
        render();
      });
    }

    load(true);
  });
})();
