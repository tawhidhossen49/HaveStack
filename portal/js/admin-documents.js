/* admin-documents: Publish documents
   Uploading a file puts it in the private portal-documents bucket and records
   who may read it. A company paper goes to every holder, and the register
   posts an update saying so. A certificate or statement goes to one holder and
   nobody else can list it or open it: the storage policy checks the documents
   row before handing over the file. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;
  var BUCKET = "portal-documents";
  var MAX_BYTES = 20 * 1024 * 1024;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-documents.html", "Publish documents",
      "Company papers for every holder, and private documents for one.", null, me);
    if (!content) return;

    var CATS = [
      { value: "company", label: "Company document" }, { value: "annual_report", label: "Annual report" },
      { value: "certificate", label: "Share certificate" }, { value: "dividend_statement", label: "Dividend statement" },
      { value: "tax", label: "Tax document" }, { value: "agreement", label: "Agreement" }
    ];
    var state = { docs: [], register: [] };

    content.innerHTML =
      A.banner("A document for every holder is announced to all of them when it is published. A document " +
        "for one holder is private to them: no other holder can see it in their list or open the file. " +
        "Files are stored privately and opened through a link that expires after a minute.") +
      P.panel({
        title: "Publish a document",
        body:
          '<form id="uf" novalidate><div class="form-grid">' +
            A.field("u-file", "File", A.input("u-file", { type: "file", accept: ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt" }),
              "PDF is best. Up to 20 MB.", true) +
            A.field("u-title", "Title", A.input("u-title", { placeholder: "For example, Annual report 2026" })) +
            A.field("u-cat", "Kind", A.select("u-cat", CATS, "company")) +
            A.field("u-for", "Who can read it", A.select("u-for", [{ value: "", label: "Every holder" }])) +
            A.field("u-date", "Issued on", A.input("u-date", { type: "date", value: A.today() })) +
            A.field("u-pub", "Visibility", A.select("u-pub", [
              { value: "yes", label: "Published now" }, { value: "no", label: "Hidden for now" }], "yes")) +
          "</div>" +
          '<div class="impact" id="u-impact" aria-live="polite">Choose a file.</div>' +
          '<button class="btn btn-key" type="submit" id="u-go">Upload and publish</button></form>'
      }) +
      P.panel({ title: "Documents", note: "Newest first.", flush: true, body: '<div id="u-list">' + P.loadingLines(5) + "</div>" });

    function holder(id) { return state.register.filter(function (h) { return h.id === id; })[0]; }

    function impact() {
      var box = document.getElementById("u-impact");
      var file = document.getElementById("u-file").files[0];
      if (!file) { box.textContent = "Choose a file."; return; }
      if (file.size > MAX_BYTES) { box.innerHTML = "That file is <b>" + P.bytes(file.size) + "</b>, over the 20 MB limit."; return; }
      var h = holder(A.val("u-for")), published = A.val("u-pub") === "yes";
      box.innerHTML = "<b>" + P.escapeHtml(file.name) + "</b>, " + P.bytes(file.size) + ". " +
        (!published ? "Stored, and <b>hidden</b> until you publish it."
          : h ? "Only <b>" + P.escapeHtml(h.full_name) + "</b> will be able to see and open it."
              : "Every holder will be able to open it, and every holder is told it is there.");
      if (!A.val("u-title")) document.getElementById("u-title").value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    }
    ["u-file", "u-for", "u-pub", "u-title"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", impact);
    });

    function safeName(name) {
      return String(name).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
    }

    document.getElementById("uf").addEventListener("submit", function (e) {
      e.preventDefault();
      var file = document.getElementById("u-file").files[0];
      var title = A.val("u-title"), h = holder(A.val("u-for"));
      if (!file) { P.toast("Choose a file to upload.", true); return; }
      if (file.size > MAX_BYTES) { P.toast("That file is over the 20 MB limit.", true); return; }
      if (!title) { P.toast("Give the document a title.", true); return; }

      var path = (h ? "holders/" + h.investor_ref : "company") + "/" + Date.now() + "-" + safeName(file.name);
      var restore = A.busy(document.getElementById("u-go"), "Uploading");
      var storage = PortalAuth.client().storage.from(BUCKET);

      storage.upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false }).then(function (up) {
        if (up.error) { restore(); P.toast("The upload failed: " + up.error.message, true); return; }
        return PortalAuth.client().from("documents").insert({
          title: title, category: A.val("u-cat"), shareholder_id: h ? h.id : null,
          storage_path: path, file_size: file.size, issued_on: A.val("u-date") || A.today(),
          published: A.val("u-pub") === "yes"
        }).then(function (r) {
          restore();
          if (r.error) {
            // do not leave a file behind with no record saying who may read it
            storage.remove([path]);
            P.toast(r.error.message, true);
            return;
          }
          P.toast(A.val("u-pub") !== "yes" ? "Uploaded and hidden." : h ? "Published to " + h.full_name + " only." : "Published. Every holder has been told.");
          document.getElementById("uf").reset();
          document.getElementById("u-date").value = A.today();
          impact();
          load();
        });
      });
    });

    function render() {
      var box = document.getElementById("u-list");
      if (!state.docs.length) { box.innerHTML = P.empty("No documents yet", "Upload one above and it appears here."); return; }
      box.innerHTML = P.table(["Document", "Who can read it", "Issued", "Size", "State", ""],
        state.docs.map(function (d) {
          var h = d.shareholders;
          return "<tr" + (d.published ? "" : ' class="is-off"') + ">" +
            "<td><b>" + P.escapeHtml(d.title) + "</b>" +
              '<div class="row-note">' + P.escapeHtml(P.docKind(d.category)) + "</div></td>" +
            "<td>" + (h ? P.escapeHtml(h.full_name) + '<div class="row-note">' + P.escapeHtml(h.investor_ref) + " only</div>" : "Every holder") + "</td>" +
            '<td class="num">' + P.date(d.issued_on) + "</td>" +
            '<td class="money">' + (P.bytes(d.file_size) || "·") + "</td>" +
            "<td>" + (d.published ? P.tag("Published", "live") : P.tag("Hidden", "draft")) + "</td>" +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-open="' + d.id + '">Open</button>' +
              '<button class="btn btn-sm" type="button" data-vis="' + d.id + '">' + (d.published ? "Hide" : "Publish") + "</button>" +
              '<button class="btn btn-sm btn-danger" type="button" data-del="' + d.id + '">Delete</button>' +
            "</div></td>" +
          "</tr>";
        }).join(""));
    }

    document.getElementById("u-list").addEventListener("click", function (e) {
      var op = e.target.closest("[data-open]"), vs = e.target.closest("[data-vis]"), dl = e.target.closest("[data-del]");
      var el = op || vs || dl;
      if (!el) return;
      var d = state.docs.filter(function (x) { return x.id === el.getAttribute(op ? "data-open" : vs ? "data-vis" : "data-del"); })[0];
      if (!d) return;

      if (op) {
        if (!d.storage_path) { P.toast("No file is attached to this document.", true); return; }
        el.disabled = true;
        PortalAuth.client().storage.from(BUCKET).createSignedUrl(d.storage_path, 60).then(function (r) {
          el.disabled = false;
          if (r.error || !r.data || !r.data.signedUrl) {
            P.toast("There is no file stored for this document. It may have been listed before files were uploaded here.", true);
            return;
          }
          window.open(r.data.signedUrl, "_blank", "noopener");
        });
        return;
      }

      if (vs) {
        var hide = d.published;
        A.confirm(hide ? "Hide document" : "Publish document",
          hide ? "Take <b>" + P.escapeHtml(d.title) + "</b> out of holders' Documents?"
               : "Publish <b>" + P.escapeHtml(d.title) + "</b>? " + (d.shareholder_id ? "Only its holder can see it." : "Every holder is told it is there."),
          hide ? "Hide it" : "Publish it"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("documents").update({ published: !hide }).eq("id", d.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast(hide ? "Hidden." : "Published.");
            load();
          });
        });
        return;
      }

      if (dl) {
        A.confirm("Delete document",
          "Delete <b>" + P.escapeHtml(d.title) + "</b> and its file? Holders can no longer open it. The deletion is kept in the audit trail.",
          "Delete it"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("documents").delete().eq("id", d.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            if (d.storage_path) PortalAuth.client().storage.from(BUCKET).remove([d.storage_path]);
            P.toast("Deleted.");
            load();
          });
        });
      }
    });

    function load() {
      return Promise.all([
        PortalAuth.client().from("documents").select("*,shareholders(full_name,investor_ref)")
          .order("issued_on", { ascending: false }).order("created_at", { ascending: false })
          .then(function (r) { return r; }),
        A.register()
      ]).then(function (res) {
        if (res[0].error) { document.getElementById("u-list").innerHTML = P.failed(res[0].error.message); return; }
        state.docs = res[0].data || [];
        state.register = res[1].error ? [] : (res[1].data || []);
        var sel = document.getElementById("u-for"), keep = sel.value;
        sel.innerHTML = A.options(A.holderOptions(state.register, { placeholder: "Every holder" }), keep);
        render();
      });
    }

    load();
  });
})();
