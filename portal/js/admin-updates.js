/* admin-updates: Announcements
   What holders read under Updates. Some are written here; others are posted
   by the register itself when a price is set, a dividend is declared or paid,
   or a company document is published. Both kinds can be edited, pinned or
   hidden, and the automatic ones are marked so nobody wonders who wrote them. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-updates.html", "Announcements",
      "What holders read under Updates.",
      '<button class="btn btn-key btn-sm" type="button" id="post">' + P.svg(P.I.plus, 14) + "Post an announcement</button>",
      me);
    if (!content) return;

    var KINDS = [
      { value: "announcement", label: "Announcement" }, { value: "investor_update", label: "Investor update" },
      { value: "meeting", label: "Meeting" }, { value: "dividend", label: "Dividend" }, { value: "document", label: "Document" }
    ];
    var state = { rows: [], show: "all" };

    content.innerHTML =
      A.banner("A published announcement reaches every holder straight away, including anyone with the " +
        "portal open. Pinned ones stay at the top of Updates.") +
      P.panel({
        title: "Announcements",
        flush: true,
        actions: '<div class="seg" role="group" aria-label="Which announcements">' +
          [["all", "All"], ["written", "Written"], ["automatic", "Automatic"]].map(function (s) {
            return '<button type="button" data-show="' + s[0] + '" aria-pressed="' + (s[0] === "all") + '">' + s[1] + "</button>";
          }).join("") + "</div>",
        body: '<div id="u-list">' + P.loadingLines(5) + "</div>"
      });

    function fields(u) {
      u = u || {};
      return [
        { name: "title", label: "Title", value: u.title || "" },
        { name: "kind", label: "Kind", value: u.kind || "announcement", options: KINDS },
        { name: "body", label: "Text", value: u.body || "", multiline: true, rows: 7 },
        { name: "pinned", label: "Position", value: u.pinned ? "yes" : "no",
          options: [{ value: "no", label: "In date order" }, { value: "yes", label: "Pinned to the top" }] },
        { name: "published", label: "Visibility", value: u.published === false ? "no" : "yes",
          options: [{ value: "yes", label: "Published to every holder" }, { value: "no", label: "Hidden draft" }] }
      ];
    }
    function valid(f) {
      if (!f.title.trim()) return "Give it a title.";
      if (f.title.trim().length > 200) return "Keep the title under 200 characters.";
      return null;
    }
    function row(f) {
      return { title: f.title.trim(), kind: f.kind, body: f.body.trim(), pinned: f.pinned === "yes", published: f.published === "yes" };
    }

    function render() {
      var box = document.getElementById("u-list");
      var list = state.rows.filter(function (u) {
        return state.show === "all" || (state.show === "automatic") === !!u.automatic;
      });
      if (!state.rows.length) { box.innerHTML = P.empty("Nothing posted yet", "Post the first announcement and every holder sees it."); return; }
      if (!list.length) { box.innerHTML = P.empty("Nothing here", state.show === "automatic" ? "Nothing has been posted automatically yet." : "Nothing has been written by hand yet."); return; }
      box.innerHTML = P.table(["Posted", "Announcement", "Source", "State", ""],
        list.map(function (u) {
          var excerpt = (u.body || "").length > 140 ? u.body.slice(0, 140).trim() + "…" : (u.body || "");
          return "<tr" + (u.published ? "" : ' class="is-off"') + ">" +
            '<td class="num">' + P.dateTime(u.published_at) + "</td>" +
            "<td><b>" + P.escapeHtml(u.title) + "</b>" +
              '<div class="row-note">' + P.escapeHtml(P.updateKind(u.kind)) + (u.pinned ? "  Pinned" : "") + "</div>" +
              (excerpt ? '<div class="row-note">' + P.escapeHtml(excerpt) + "</div>" : "") + "</td>" +
            "<td>" + (u.automatic ? P.tag("Automatic", "auto") : P.tag("Written", "draft")) + "</td>" +
            "<td>" + (u.published ? P.tag("Published", "live") : P.tag("Hidden", "draft")) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-edit="' + u.id + '">Edit</button>' +
              '<button class="btn btn-sm" type="button" data-pin="' + u.id + '">' + (u.pinned ? "Unpin" : "Pin") + "</button>" +
              '<button class="btn btn-sm" type="button" data-vis="' + u.id + '">' + (u.published ? "Hide" : "Publish") + "</button>" +
              '<button class="btn btn-sm btn-danger" type="button" data-del="' + u.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    function save(id, patch, said) {
      var q = id ? PortalAuth.client().from("updates").update(patch).eq("id", id)
                 : PortalAuth.client().from("updates").insert(patch);
      return q.then(function (r) {
        if (r.error) { P.toast(r.error.message, true); return; }
        P.toast(said);
        load();
      });
    }

    // the post button lives in the top bar, outside the content area
    document.getElementById("post").addEventListener("click", function () {
      P.modal({ title: "Post an announcement", confirm: "Post it", fields: fields(null), validate: valid })
        .then(function (f) {
          if (!f) return;
          save(null, row(f), f.published === "yes" ? "Posted. Every holder can read it now." : "Saved as a hidden draft.");
        });
    });

    content.addEventListener("click", function (e) {
      var sh = e.target.closest("[data-show]");
      if (sh) {
        state.show = sh.getAttribute("data-show");
        sh.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === sh)); });
        render();
        return;
      }
      var ed = e.target.closest("[data-edit]"), pn = e.target.closest("[data-pin]"),
          vs = e.target.closest("[data-vis]"), dl = e.target.closest("[data-del]");
      var el = ed || pn || vs || dl;
      if (!el) return;
      var id = el.getAttribute(ed ? "data-edit" : pn ? "data-pin" : vs ? "data-vis" : "data-del");
      var u = state.rows.filter(function (x) { return x.id === id; })[0];
      if (!u) return;

      if (ed) {
        P.modal({
          title: "Edit announcement",
          note: u.automatic ? "Posted automatically by the register. Editing it changes what holders read." : "",
          confirm: "Save", fields: fields(u), validate: valid
        }).then(function (f) { if (f) save(u.id, row(f), "Saved."); });
        return;
      }
      if (pn) { save(u.id, { pinned: !u.pinned }, u.pinned ? "Unpinned." : "Pinned to the top of Updates."); return; }
      if (vs) {
        A.confirm(u.published ? "Hide announcement" : "Publish announcement",
          u.published ? "Take <b>" + P.escapeHtml(u.title) + "</b> out of every holder's Updates?"
                      : "Publish <b>" + P.escapeHtml(u.title) + "</b> to every holder now?",
          u.published ? "Hide it" : "Publish it"
        ).then(function (yes) { if (yes) save(u.id, { published: !u.published }, u.published ? "Hidden." : "Published."); });
        return;
      }
      if (dl) {
        A.confirm("Delete announcement",
          "Delete <b>" + P.escapeHtml(u.title) + "</b>? If you only want holders not to see it, hide it instead. The deletion is kept in the audit trail.",
          "Delete it"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("updates").delete().eq("id", u.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast("Deleted.");
            load();
          });
        });
      }
    });

    function load() {
      return PortalAuth.client().from("updates").select("*")
        .order("published_at", { ascending: false }).then(function (r) {
          if (r.error) { document.getElementById("u-list").innerHTML = P.failed(r.error.message); return; }
          state.rows = r.data || [];
          render();
        });
    }

    load();
  });
})();
