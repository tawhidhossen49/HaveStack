/* admin-company: Company information
   The two panels a holder reads on the Company page: the facts about the
   company, and the share classes it has issued.

   Neither is worked out from anything. They are statements the company makes
   about itself, so they are typed here and nowhere else, and every change is
   written to the audit trail like any other. A fact can be hidden while it is
   being settled; a share class cannot, because holdings point at it, so the
   register refuses to delete one that is in use. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-company.html", "Company information",
      "What the Company page says about HaveStack Technologies.", null, me);
    if (!content) return;

    var state = { facts: [], classes: [], trouble: [] };

    content.innerHTML =
      A.banner("Everything on this page is shown to every shareholder on their Company page. " +
        "Nothing here is worked out by the register: these are statements the company makes about " +
        "itself, so check the wording before you publish it. Share classes are used by holdings " +
        "and ledger entries, so one that is in use cannot be deleted.") +
      '<div id="c-trouble"></div>' +
      P.panel({
        title: "Company information",
        note: "One row for each fact, in the order they are listed. A hidden fact is kept here and " +
              "shown to nobody.",
        flush: true,
        actions: '<button class="btn btn-key btn-sm" type="button" id="addFact">' +
          P.svg(P.I.plus, 14) + "Add a fact</button>",
        body: '<div id="c-facts">' + P.loadingLines(5) + "</div>"
      }) +
      P.panel({
        title: "As holders see it",
        note: "The published facts, laid out the way the Company page lays them out.",
        body: '<div id="c-preview">' + P.loadingLines(3) + "</div>"
      }) +
      P.panel({
        title: "Share classes",
        note: "Every class of share the company has issued, with the rights that go with it.",
        flush: true,
        actions: '<button class="btn btn-sm" type="button" id="addClass">' +
          P.svg(P.I.plus, 14) + "Add a share class</button>",
        body: '<div id="c-classes">' + P.loadingLines(4) + "</div>"
      });

    /* ---- the facts -------------------------------------------------------- */
    function factFields(f) {
      f = f || {};
      return [
        { name: "label", label: "Label", value: f.label || "",
          hint: "The words on the left, for example Registered office." },
        { name: "value", label: "Value", value: f.value || "",
          hint: "The words on the right." },
        { name: "note", label: "Note", value: f.note || "", multiline: true, rows: 2,
          hint: "Optional. A quieter second line under the value." },
        { name: "sort", label: "Order", type: "number", value: f.sort == null ? nextSort(state.facts) : f.sort,
          hint: "Lower numbers are listed first." },
        { name: "published", label: "Visibility", value: f.published === false ? "no" : "yes",
          options: [{ value: "yes", label: "Shown to every holder" },
                    { value: "no", label: "Hidden for now" }] }
      ];
    }

    function nextSort(list) {
      return (list.reduce(function (n, r) { return Math.max(n, Number(r.sort) || 0); }, 0) || 0) + 10;
    }

    function factValid(v) {
      if (!v.label.trim()) return "Give the fact a label.";
      if (v.label.trim().length > 60) return "Keep the label under 60 characters: it is a heading, not a sentence.";
      if (!v.value.trim()) return "Give the fact a value, or delete the row instead.";
      if (v.value.trim().length > 200) return "Keep the value under 200 characters.";
      if (v.note.trim().length > 300) return "Keep the note under 300 characters.";
      if (String(v.sort).trim() !== "" && !/^-?\d+$/.test(String(v.sort).trim())) return "The order is a whole number.";
      return null;
    }

    function factRow(v) {
      return {
        label: v.label.trim(), value: v.value.trim(), note: v.note.trim(),
        sort: parseInt(v.sort, 10) || 0, published: v.published === "yes"
      };
    }

    function renderFacts() {
      var box = document.getElementById("c-facts");
      if (!state.facts.length) {
        box.innerHTML = P.empty("No facts listed",
          "Add the first one and the Company page shows it to every holder.");
        return;
      }
      box.innerHTML = P.table(["Label", "Value", "Order", "State", ""],
        state.facts.map(function (f, i) {
          return "<tr" + (f.published ? "" : ' class="is-off"') + ">" +
            "<td><b>" + P.escapeHtml(f.label) + "</b></td>" +
            "<td>" + P.escapeHtml(f.value) +
              (f.note ? '<div class="row-note">' + P.escapeHtml(f.note) + "</div>" : "") + "</td>" +
            '<td class="num">' + (Number(f.sort) || 0) + "</td>" +
            "<td>" + (f.published ? P.tag("Shown", "live") : P.tag("Hidden", "draft")) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-up="' + f.id + '"' +
                (i === 0 ? " disabled" : "") + ' aria-label="Move ' + P.escapeHtml(f.label) + ' up">' +
                "Up</button>" +
              '<button class="btn btn-sm" type="button" data-down="' + f.id + '"' +
                (i === state.facts.length - 1 ? " disabled" : "") +
                ' aria-label="Move ' + P.escapeHtml(f.label) + ' down">Down</button>' +
              '<button class="btn btn-sm" type="button" data-edit-fact="' + f.id + '">Edit</button>' +
              '<button class="btn btn-sm" type="button" data-vis-fact="' + f.id + '">' +
                (f.published ? "Hide" : "Show") + "</button>" +
              '<button class="btn btn-sm btn-danger" type="button" data-del-fact="' + f.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    function renderPreview() {
      var box = document.getElementById("c-preview");
      var shown = state.facts.filter(function (f) { return f.published; });
      box.innerHTML = shown.length
        ? P.kv(shown.map(function (f) {
            return [f.label, P.escapeHtml(f.value) +
              (f.note ? '<div class="doc-meta">' + P.escapeHtml(f.note) + "</div>" : "")];
          }))
        : P.empty("Nothing shown", "Every fact is hidden, so the Company page leaves this panel out.");
    }

    /* ---- the share classes ------------------------------------------------ */
    function classFields(c) {
      c = c || {};
      return [
        { name: "code", label: "Code", value: c.code || "",
          hint: "Short, in capitals, for example ORD-A. It is what the register prints beside a holding." },
        { name: "name", label: "Name", value: c.name || "",
          hint: "For example Ordinary A." },
        { name: "description", label: "Rights", value: c.description || "", multiline: true, rows: 3,
          hint: "What this class carries, in a sentence." },
        { name: "votes_per_share", label: "Votes per share", type: "number",
          value: c.votes_per_share == null ? 1 : Number(c.votes_per_share) },
        { name: "par_value", label: "Par value, BDT", type: "number",
          value: c.par_value == null ? 0 : Number(c.par_value) },
        { name: "sort", label: "Order", type: "number",
          value: c.sort == null ? nextSort(state.classes) : c.sort }
      ];
    }

    function classValid(v, id) {
      var code = (v.code || "").trim().toUpperCase();
      if (!code) return "Give the class a code.";
      if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(code)) {
        return "A code is up to twelve characters: capitals, numbers and hyphens, starting with a letter or a number.";
      }
      if (state.classes.some(function (c) { return c.id !== id && (c.code || "").toUpperCase() === code; })) {
        return "There is already a share class with the code " + code + ".";
      }
      if (!(v.name || "").trim()) return "Give the class a name.";
      if (!(Number(v.votes_per_share) >= 0)) return "Votes per share is zero or more.";
      if (!(Number(v.par_value) >= 0)) return "Par value is zero or more.";
      return null;
    }

    function classRow(v) {
      return {
        code: v.code.trim().toUpperCase(), name: v.name.trim(), description: v.description.trim(),
        votes_per_share: Number(v.votes_per_share) || 0,
        par_value: Number(v.par_value) || 0,
        sort: parseInt(v.sort, 10) || 0
      };
    }

    function renderClasses() {
      var box = document.getElementById("c-classes");
      if (!state.classes.length) {
        box.innerHTML = P.empty("No share classes",
          "Add one before recording any shares: every holding belongs to a class.");
        return;
      }
      box.innerHTML = P.table(["Code", "Name", "Votes per share", "Par value", "Rights", ""],
        state.classes.map(function (c) {
          return "<tr>" +
            '<td class="num">' + P.escapeHtml(c.code) + "</td>" +
            "<td><b>" + P.escapeHtml(c.name) + "</b></td>" +
            '<td class="money">' + (Number(c.votes_per_share) || 0) + "</td>" +
            '<td class="money">' + P.price(c.par_value) + "</td>" +
            "<td>" + P.escapeHtml(c.description || "") + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-edit-class="' + c.id + '">Edit</button>' +
              '<button class="btn btn-sm btn-danger" type="button" data-del-class="' + c.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    /* ---- writing ----------------------------------------------------------- */
    // Postgres says why in a code; a reader needs it in words.
    function why(error, what) {
      var code = error && error.code;
      if (code === "23505") return "There is already a share class with that code.";
      if (code === "23503") {
        return "That share class is used by holdings or ledger entries, so the register will not " +
               "delete it. Move those shares to another class first.";
      }
      return (error && error.message) || ("Could not " + what + ".");
    }

    function done(r, said, what) {
      if (r.error) { P.toast(why(r.error, what), true); return false; }
      P.toast(said);
      load();
      return true;
    }

    function db() { return PortalAuth.client(); }

    /* ---- what the buttons do ------------------------------------------------ */
    document.getElementById("addFact").addEventListener("click", function () {
      P.modal({
        title: "Add a fact", confirm: "Add it",
        note: "It appears on every holder's Company page.",
        fields: factFields(null),
        validate: factValid
      }).then(function (v) {
        if (!v) return;
        db().from("company_facts").insert(factRow(v)).then(function (r) {
          done(r, v.published === "yes" ? "Added, and shown to every holder." : "Added, and hidden for now.", "add it");
        });
      });
    });

    document.getElementById("addClass").addEventListener("click", function () {
      P.modal({
        title: "Add a share class", confirm: "Add it",
        note: "A class is what a holding belongs to. Adding one changes nothing until shares are issued in it.",
        fields: classFields(null),
        validate: function (v) { return classValid(v, null); }
      }).then(function (v) {
        if (!v) return;
        db().from("share_classes").insert(classRow(v)).then(function (r) {
          done(r, classRow(v).code + " added.", "add it");
        });
      });
    });

    content.addEventListener("click", function (e) {
      var t = e.target;
      var fact = function (attr) {
        var el = t.closest("[" + attr + "]");
        if (!el) return null;
        var id = el.getAttribute(attr);
        return state.facts.filter(function (f) { return f.id === id; })[0] || null;
      };

      /* ---- facts ---- */
      var f = fact("data-edit-fact");
      if (f) {
        P.modal({
          title: "Edit " + f.label, confirm: "Save",
          fields: factFields(f), validate: factValid
        }).then(function (v) {
          if (!v) return;
          db().from("company_facts").update(factRow(v)).eq("id", f.id)
            .then(function (r) { done(r, "Saved.", "save it"); });
        });
        return;
      }

      f = fact("data-vis-fact");
      if (f) {
        db().from("company_facts").update({ published: !f.published }).eq("id", f.id)
          .then(function (r) {
            done(r, f.published ? "Hidden. Holders no longer see it."
                                : "Shown. Every holder sees it now.", "change it");
          });
        return;
      }

      f = fact("data-del-fact");
      if (f) {
        A.confirm("Delete this fact",
          "Delete <b>" + P.escapeHtml(f.label) + "</b> from the Company page? If you only want to " +
          "stop showing it, hide it instead. The deletion is kept in the audit trail.",
          "Delete it"
        ).then(function (yes) {
          if (!yes) return;
          db().from("company_facts").delete().eq("id", f.id)
            .then(function (r) { done(r, "Deleted.", "delete it"); });
        });
        return;
      }

      // order: swap this row's place with its neighbour's
      var up = t.closest("[data-up]"), down = t.closest("[data-down]");
      if (up || down) {
        var id = (up || down).getAttribute(up ? "data-up" : "data-down");
        var i = state.facts.findIndex(function (x) { return x.id === id; });
        var j = up ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= state.facts.length) return;
        var a = state.facts[i], b = state.facts[j];
        // equal or missing orders would make the swap do nothing
        var sa = Number(a.sort) || 0, sb = Number(b.sort) || 0;
        if (sa === sb) { sa = (i + 1) * 10; sb = (j + 1) * 10; }
        Promise.all([
          db().from("company_facts").update({ sort: sb }).eq("id", a.id),
          db().from("company_facts").update({ sort: sa }).eq("id", b.id)
        ]).then(function (res) {
          var bad = res.filter(function (r) { return r.error; })[0];
          if (bad) { P.toast(why(bad.error, "move it"), true); return; }
          load();
        });
        return;
      }

      /* ---- share classes ---- */
      var ce = t.closest("[data-edit-class]"), cd = t.closest("[data-del-class]");
      if (!ce && !cd) return;
      var cid = (ce || cd).getAttribute(ce ? "data-edit-class" : "data-del-class");
      var c = state.classes.filter(function (x) { return x.id === cid; })[0];
      if (!c) return;

      if (ce) {
        P.modal({
          title: "Edit " + c.code, confirm: "Save",
          note: "Changing a code changes it everywhere it is printed, including on existing holdings.",
          fields: classFields(c),
          validate: function (v) { return classValid(v, c.id); }
        }).then(function (v) {
          if (!v) return;
          db().from("share_classes").update(classRow(v)).eq("id", c.id)
            .then(function (r) { done(r, "Saved.", "save it"); });
        });
        return;
      }

      A.confirm("Delete " + c.code,
        "Delete the share class <b>" + P.escapeHtml(c.name) + "</b>? The register refuses this while " +
        "any holding or ledger entry belongs to it.",
        "Delete it"
      ).then(function (yes) {
        if (!yes) return;
        db().from("share_classes").delete().eq("id", c.id)
          .then(function (r) { done(r, c.code + " deleted.", "delete it"); });
      });
    });

    /* ---- load ---------------------------------------------------------------
       A read that fails says so. Showing an empty table instead would read as a
       company with nothing to say about itself. */
    function load() {
      return Promise.all([
        db().from("company_facts").select("*").order("sort").then(function (r) { return r; }),
        db().from("share_classes").select("*").order("sort").then(function (r) { return r; })
      ]).then(function (res) {
        state.trouble = [
          [res[0].error, "the company information"],
          [res[1].error, "the share classes"]
        ].filter(function (p) { return p[0]; })
         .map(function (p) { return p[1] + " (" + (p[0].message || p[0]) + ")"; });

        document.getElementById("c-trouble").innerHTML = state.trouble.length
          ? P.failed("Could not read " + state.trouble.join(", and ") +
              ". What is missing below is a fault here, not an empty page.")
          : "";

        state.facts = res[0].error ? [] : (res[0].data || []);
        state.classes = res[1].error ? [] : (res[1].data || []);
        renderFacts();
        renderPreview();
        renderClasses();
      });
    }

    load();
  });
})();
