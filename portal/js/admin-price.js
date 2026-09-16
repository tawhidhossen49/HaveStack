/* admin-price: Share price
   Setting the internal share price. One saved row here revalues every holding
   in the portal, posts an update to every holder, and redraws any portal that
   happens to be open: the database does all three, so this page only has to
   say so clearly before anyone presses the button. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-price.html", "Share price",
      "The internal price every holding in the portal is valued at.", null, me);
    if (!content) return;

    var METHODS = ["Board valuation", "Priced round", "Independent valuation", "Par value", "Other"];
    var state = { vals: [], totals: null, chart: null };

    content.innerHTML =
      A.banner("Setting a price revalues every holding in the portal the moment it is saved, posts " +
        "an update telling every holder what changed, and redraws any portal that is open. A price " +
        "dated before the current one fills in history and leaves today's value alone.") +
      '<div class="split split-wide">' +
        P.panel({
          title: "Set a new share price",
          body:
            '<form id="pf" novalidate>' +
              '<div class="form-grid">' +
                A.field("p-date", "Effective from", A.input("p-date", { type: "date", value: A.today(), max: A.today() })) +
                A.field("p-price", "Price per share, BDT", A.input("p-price", { type: "number", min: "0.01", step: "0.01", inputmode: "decimal", placeholder: "0.00" })) +
                A.field("p-method", "How it was set", A.select("p-method", METHODS, "Board valuation")) +
                A.field("p-total", "Company valuation, BDT",
                  A.input("p-total", { type: "number", min: "0", step: "1", placeholder: "Worked out for you" }),
                  "Leave empty to use the price times every share in issue.") +
                A.field("p-note", "Note for holders", A.textarea("p-note", "", 3),
                  "Shown with the price, for example what the valuation was based on.", true) +
              "</div>" +
              '<div class="impact" id="p-impact" aria-live="polite">Enter a price to see what it will change.</div>' +
              '<button class="btn btn-key" type="submit" id="p-go">Set the price</button>' +
            "</form>"
        }) +
        P.panel({ title: "Where the price stands", body: '<div id="p-now">' + P.loadingLines(4) + "</div>" }) +
      "</div>" +
      P.panel({
        title: "Price history",
        note: "What holders see on their overview. Hover or use the arrow keys for each valuation.",
        body: '<div id="p-chart"></div>'
      }) +
      P.panel({ title: "Every valuation", flush: true, body: '<div id="p-list">' + P.loadingLines(4) + "</div>" });

    function published() {
      return state.vals.filter(function (v) { return v.published; })
        .sort(function (a, b) { return a.effective_on < b.effective_on ? 1 : -1; });
    }

    /* ---- what saving would do, said before saving ----------------------- */
    function impact() {
      var box = document.getElementById("p-impact");
      var price = A.num("p-price"), date = A.val("p-date");
      if (!(price > 0) || !date) { box.textContent = "Enter a price and a date to see what it will change."; return; }
      var current = published()[0];
      // the company is worth its price times every share it has, including
      // any it has not issued yet
      var allotted = state.totals ? Number(state.totals.total_shares) || 0 : 0;
      var issued = state.totals && Number(state.totals.company_total) > 0
        ? Number(state.totals.company_total) : allotted;
      var holders = state.totals ? Number(state.totals.holders) || 0 : 0;

      if (state.vals.some(function (v) { return v.effective_on === date; })) {
        box.innerHTML = "A price is already set for <b>" + P.date(date) + "</b>. Change that one in the list below instead.";
        return;
      }
      if (date > A.today()) {
        box.innerHTML = "A price cannot take effect in the future.";
        return;
      }
      if (current && date < current.effective_on) {
        box.innerHTML = "This is dated before the current price of <b>" + P.price(current.price_per_share) +
          "</b>, set " + P.date(current.effective_on) + ". It adds to the history and <b>does not change</b> " +
          "what any holding is worth today.";
        return;
      }
      var move = current ? P.change(price, current.price_per_share) : null;
      box.innerHTML = "All <b>" + holders + "</b> holders are revalued at <b>" + P.price(price) + "</b> a share" +
        (move && move.dir !== "flat" ? ", <b>" + move.sign + Math.abs(move.pct).toFixed(1) + "%</b> on today's " +
          P.price(current.price_per_share) : "") +
        ". The company is valued at <b>" + P.money(A.num("p-total") > 0 ? A.num("p-total") : price * issued) +
        "</b> across " + P.shares(issued) + " shares, and every holder is sent an update.";
    }

    ["p-price", "p-date", "p-total"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", impact);
    });

    document.getElementById("pf").addEventListener("submit", function (e) {
      e.preventDefault();
      var price = A.num("p-price"), date = A.val("p-date"), total = A.num("p-total");
      if (!date) { P.toast("Choose the date the price takes effect.", true); return; }
      if (date > A.today()) { P.toast("A price cannot take effect in the future.", true); return; }
      if (!(price > 0)) { P.toast("Enter a price greater than zero.", true); return; }
      if (state.vals.some(function (v) { return v.effective_on === date; })) {
        P.toast("A price is already set for that date. Change it in the list below.", true);
        return;
      }
      var current = published()[0];
      var backdated = current && date < current.effective_on;
      A.confirm("Set the share price",
        backdated
          ? "Add a price of <b>" + P.price(price) + "</b> dated " + P.date(date) + " to the history? Today's price stays " + P.price(current.price_per_share) + "."
          : "Set the share price at <b>" + P.price(price) + "</b> from " + P.date(date) + "? Every holding is revalued straight away and every holder is told.",
        "Set the price"
      ).then(function (yes) {
        if (!yes) return;
        var restore = A.busy(document.getElementById("p-go"), "Setting the price");
        PortalAuth.client().from("valuations").insert({
          effective_on: date, price_per_share: price, method: A.val("p-method"),
          note: A.val("p-note"), total_valuation: total > 0 ? total : 0, published: true
        }).then(function (r) {
          restore();
          if (r.error) { P.toast(r.error.message, true); return; }
          P.toast(backdated ? "Added to the price history." : "Price set. Every holding is revalued and holders have been told.");
          document.getElementById("pf").reset();
          document.getElementById("p-date").value = A.today();
          load();
        });
      });
    });

    /* ---- the current position ------------------------------------------- */
    function renderNow() {
      var box = document.getElementById("p-now");
      var list = published();
      var current = list[0], previous = list[1];
      if (!current) {
        box.innerHTML = P.empty("No price yet", "Set the first share price and every holding is valued from it.");
        return;
      }
      var move = previous ? P.change(current.price_per_share, previous.price_per_share) : null;
      box.innerHTML =
        '<div class="price-now">' + P.moneyBig(current.price_per_share) + "</div>" +
        '<div class="price-meta">' +
          (move ? P.deltaHtml(current.price_per_share, previous.price_per_share, { bare: true }) +
            "<span>on the previous price</span>" : "") +
        "</div>" +
        P.kv([
          ["Effective from", P.date(current.effective_on)],
          ["How it was set", P.escapeHtml(current.method || "·")],
          ["Company valuation", P.money(current.total_valuation)],
          ["Shares in the company", state.totals && Number(state.totals.company_total) > 0
            ? P.shares(state.totals.company_total) : "Not stated"],
          ["Allotted to holders", state.totals ? P.shares(state.totals.total_shares) : "·"],
          ["Not yet issued", state.totals && Number(state.totals.company_total) > 0
            ? P.shares(state.totals.unallocated) : "·"],
          ["Holders valued at it", state.totals ? String(state.totals.holders) : "·"]
        ]);
    }

    /* ---- the chart ------------------------------------------------------- */
    function renderChart() {
      var host = document.getElementById("p-chart");
      var data = state.vals.filter(function (v) { return v.published; });
      if (state.chart) { state.chart.update({ valuations: data }); return; }
      state.chart = PortalChart.mount(host, { valuations: data, measure: "price", range: "all" });
    }

    /* ---- every valuation ------------------------------------------------- */
    function renderList() {
      var box = document.getElementById("p-list");
      if (!state.vals.length) {
        box.innerHTML = P.empty("No valuations", "Every price you set is listed here, newest first.");
        return;
      }
      var ordered = state.vals.slice().sort(function (a, b) { return a.effective_on < b.effective_on ? 1 : -1; });
      var current = published()[0];
      box.innerHTML = P.table(["Effective", "Price", "Change", "Company valuation", "How it was set", "State", ""],
        ordered.map(function (v, i) {
          var prev = ordered.slice(i + 1).filter(function (x) { return x.published; })[0];
          var move = prev ? P.change(v.price_per_share, prev.price_per_share) : null;
          return "<tr>" +
            '<td class="num">' + P.date(v.effective_on) +
              (current && v.id === current.id ? '<div class="doc-meta">Current price</div>' : "") + "</td>" +
            '<td class="money">' + P.price(v.price_per_share) + "</td>" +
            '<td class="money">' + (move && move.dir !== "flat"
              ? '<span class="delta delta-' + move.dir + '">' + move.sign + Math.abs(move.pct).toFixed(1) + "%</span>"
              : '<span class="muted">·</span>') + "</td>" +
            '<td class="money">' + P.money(v.total_valuation) + "</td>" +
            "<td>" + P.escapeHtml(v.method || "·") +
              (v.note ? '<div class="doc-meta">' + P.escapeHtml(v.note) + "</div>" : "") + "</td>" +
            "<td>" + (v.published ? P.tag("Published", "live") : P.tag("Hidden", "draft")) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-edit="' + v.id + '">Edit</button>' +
              '<button class="btn btn-sm" type="button" data-toggle="' + v.id + '">' + (v.published ? "Hide" : "Publish") + "</button>" +
              '<button class="btn btn-sm btn-danger" type="button" data-del="' + v.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    function find(id) { return state.vals.filter(function (v) { return v.id === id; })[0]; }

    document.getElementById("p-list").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-edit]"), tg = e.target.closest("[data-toggle]"), dl = e.target.closest("[data-del]");
      var el = ed || tg || dl;
      if (!el) return;
      var v = find(el.getAttribute(ed ? "data-edit" : tg ? "data-toggle" : "data-del"));
      if (!v) return;
      var current = published()[0];
      var isCurrent = current && current.id === v.id;

      if (ed) {
        P.modal({
          title: "Change the price of " + P.date(v.effective_on),
          note: isCurrent ? "This is the current price. Holders are told it was corrected." : "",
          confirm: "Save",
          fields: [
            { name: "price", label: "Price per share, BDT", type: "number", value: Number(v.price_per_share) },
            { name: "method", label: "How it was set", value: v.method || "Board valuation",
              options: METHODS.indexOf(v.method) > -1 || !v.method ? METHODS : METHODS.concat([v.method]) },
            { name: "total", label: "Company valuation, BDT", type: "number", value: Number(v.total_valuation) || "",
              hint: "Clear it to work it out again from the price." },
            { name: "note", label: "Note for holders", value: v.note || "", multiline: true, rows: 3 }
          ],
          validate: function (f) { return Number(f.price) > 0 ? null : "Enter a price greater than zero."; }
        }).then(function (f) {
          if (!f) return;
          // a cleared valuation, or a new price with the old valuation left
          // alone, is worked out again by the database
          var patch = {
            price_per_share: Number(f.price), method: f.method, note: f.note.trim(),
            total_valuation: Number(f.total) > 0 ? Number(f.total) : 0
          };
          PortalAuth.client().from("valuations").update(patch).eq("id", v.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast(isCurrent && patch.price_per_share !== Number(v.price_per_share)
              ? "Saved. Holdings are revalued and holders have been told of the correction." : "Saved.");
            load();
          });
        });
        return;
      }

      if (tg) {
        var hiding = v.published;
        A.confirm(hiding ? "Hide this price" : "Publish this price",
          hiding
            ? (isCurrent ? "Hide the current price of <b>" + P.price(v.price_per_share) + "</b>? Holdings will be valued at the one before it until you publish it again." : "Hide the price of " + P.date(v.effective_on) + " from holders?")
            : "Publish the price of <b>" + P.price(v.price_per_share) + "</b> dated " + P.date(v.effective_on) + "?",
          hiding ? "Hide it" : "Publish it"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("valuations").update({ published: !hiding }).eq("id", v.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast(hiding ? "Hidden." : "Published.");
            load();
          });
        });
        return;
      }

      if (dl) {
        A.confirm("Delete this price",
          "Delete the price of <b>" + P.price(v.price_per_share) + "</b> dated " + P.date(v.effective_on) + "?" +
          (isCurrent ? " It is the current price, so every holding goes back to being valued at the one before it." : "") +
          " The deletion is kept in the audit trail.",
          "Delete it"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("valuations").delete().eq("id", v.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast("Deleted.");
            load();
          });
        });
      }
    });

    function load() {
      return Promise.all([
        PortalAuth.client().from("valuations").select("*").order("effective_on", { ascending: false })
          .then(function (r) { return r; }),
        A.totals()
      ]).then(function (res) {
        if (res[0].error) {
          document.getElementById("p-list").innerHTML = P.failed(res[0].error.message);
          return;
        }
        state.vals = res[0].data || [];
        state.totals = res[1].error ? null : res[1].data;
        renderNow();
        renderList();
        renderChart();
        impact();
      });
    }

    load();
  });
})();
