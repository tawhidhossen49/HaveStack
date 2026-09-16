/* media: Images
   Every picture on the public site in one place, with the file behind it and
   a way to replace it.

   Three kinds of picture, one way of working with them. A capability or a
   sector picture is a column on its own row. A client or partner mark is a
   column on the organisation. The rest, the logo and the tab icon and the
   photographs behind the page, are fixed parts of the layout and have a row
   each in site_images, keyed by where they appear.

   A replacement is uploaded to storage and the row is pointed at it. The file
   that ships with the site is never touched and never forgotten, so "Put the
   original back" is always available and always works. */
(function () {
  "use strict";
  var A = window.Admin;
  var BUCKET = "site-media";
  var MAX = 5 * 1024 * 1024;
  var TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/avif"];

  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("media.html", "Images",
      "Every picture on the public site, and the file behind it.", null, admin);
    if (!content) return;

    content.innerHTML =
      A.notice("Replacing a picture changes the public site as soon as it finishes uploading. " +
        "The file that ships with the site stays where it is, so you can always put the original " +
        "back. PNG, JPEG, WebP, AVIF or SVG, up to 5 MB.") +
      A.panel({
        title: "Brand and page furniture",
        note: "The mark, the tab icon, the sharing card and the photographs built into the layout.",
        flush: true, body: '<div id="g-slot">' + A.empty("Loading", "Reading the site.") + "</div>"
      }) +
      A.panel({
        title: "Services and sectors",
        note: "One picture for each block in those two sections.",
        flush: true, body: '<div id="g-item"></div>'
      }) +
      A.panel({
        title: "Clients and partners",
        note: "The marks in the two registers. The size is measured from the file you upload, so a " +
              "new mark keeps its proportions on the page.",
        flush: true, body: '<div id="g-org"></div>'
      }) +
      '<input type="file" id="picker" accept="' + TYPES.join(",") + '" hidden />';

    var picker = document.getElementById("picker");
    var state = { rows: [], missing: {} };

    /* ---- what a row is, whatever table it came from ---------------------- */
    function gather() {
      return Promise.all([
        A.db().from("site_images").select("*").order("sort").then(function (r) { return r; }),
        A.db().from("section_items").select("id,section_key,title,image,image_default,sort")
          .order("sort").then(function (r) { return r; }),
        A.db().from("organisations").select("id,name,register,mark,mark_default,mark_w,mark_h,sort")
          .order("sort").then(function (r) { return r; }),
        A.db().from("site_sections").select("key,label").then(function (r) { return r; })
      ]).then(function (res) {
        var labels = {};
        if (!res[3].error) (res[3].data || []).forEach(function (s) { labels[s.key] = s.label; });

        var out = [];
        (res[0].error ? [] : res[0].data || []).forEach(function (s) {
          out.push({
            kind: "slot", id: s.slot, name: s.label, where: s.hint,
            current: s.url || s.fallback, shipped: s.fallback, replaced: !!s.url
          });
        });
        (res[1].error ? [] : res[1].data || []).forEach(function (i) {
          if (!i.image && !i.image_default) return;      // a block with no picture
          out.push({
            kind: "item", id: i.id, name: i.title,
            where: (labels[i.section_key] || i.section_key),
            current: i.image, shipped: i.image_default,
            replaced: !!(i.image_default && i.image !== i.image_default)
          });
        });
        (res[2].error ? [] : res[2].data || []).forEach(function (o) {
          out.push({
            kind: "org", id: o.id, name: o.name,
            where: o.register === "client" ? "Clients" : "Partners",
            current: o.mark, shipped: o.mark_default,
            replaced: !!(o.mark_default && o.mark !== o.mark_default)
          });
        });
        return out;
      });
    }

    /* Is the file actually there? A HEAD request per picture: the only honest
       way to answer it, and how a broken image is caught before a visitor
       finds it. */
    function check(row) {
      var src = href(row.current);
      if (!src) return Promise.resolve(false);
      return fetch(src, { method: "HEAD" })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    }

    function href(path) {
      if (!path) return "";
      return /^https?:\/\//.test(path) ? path : "../" + path;
    }

    function card(row) {
      var src = href(row.current);
      var gone = state.missing[row.kind + ":" + row.id];
      return '<div class="media-card' + (gone ? " is-gone" : "") + '">' +
        '<div class="media-shot">' +
          (src ? '<img src="' + A.escapeHtml(src) + '" alt="" loading="lazy" decoding="async" />' : "") +
        "</div>" +
        '<div class="media-name">' + A.escapeHtml(row.name) + "</div>" +
        '<div class="media-where">' + A.escapeHtml(row.where || "") + "</div>" +
        '<div class="media-src" title="' + A.escapeHtml(row.current) + '">' +
          A.escapeHtml(row.current || "No file") + "</div>" +
        '<div class="media-foot">' +
          (gone ? '<span class="tag tag-missing">File not found</span>'
                : row.replaced ? '<span class="tag tag-new">Replaced</span>'
                               : '<span class="tag tag-draft">As shipped</span>') +
          '<div class="row-actions">' +
            '<button class="btn btn-sm" type="button" data-put="' + row.kind + ":" + row.id + '">Replace</button>' +
            (row.replaced
              ? '<button class="btn btn-sm" type="button" data-undo="' + row.kind + ":" + row.id + '">Undo</button>'
              : "") +
          "</div>" +
        "</div>" +
      "</div>";
    }

    function render() {
      ["slot", "item", "org"].forEach(function (kind) {
        var mine = state.rows.filter(function (r) { return r.kind === kind; });
        var box = document.getElementById("g-" + kind);
        box.innerHTML = mine.length
          ? '<div class="media">' + mine.map(card).join("") + "</div>"
          : A.empty("Nothing here yet", "Pictures appear here once the section has blocks.");
      });
    }

    /* ---- replacing one --------------------------------------------------- */
    function find(handle) {
      var bits = handle.split(":");
      return state.rows.filter(function (r) { return r.kind === bits[0] && String(r.id) === bits.slice(1).join(":"); })[0];
    }

    // the natural size of a mark, so the register reserves the right space
    function measure(file) {
      return new Promise(function (done) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { done({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = function () { done(null); URL.revokeObjectURL(url); };
        img.src = url;
      });
    }

    function safeName(name) {
      return String(name).toLowerCase().replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "").slice(0, 60) || "image";
    }

    // a replacement that is itself an upload leaves a file behind; take it out
    function forget(url) {
      var at = String(url || "").indexOf("/" + BUCKET + "/");
      if (at < 0) return;
      A.db().storage.from(BUCKET).remove([decodeURIComponent(url.slice(at + BUCKET.length + 2))]);
    }

    var pending = null;
    function replace(row) {
      pending = row;
      picker.value = "";
      picker.click();
    }

    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      var row = pending;
      pending = null;
      if (!file || !row) return;
      if (TYPES.indexOf(file.type) < 0) {
        A.toast("That is a " + (file.type || "file of unknown type") + ". Use a PNG, JPEG, WebP, AVIF or SVG.", true);
        return;
      }
      if (file.size > MAX) {
        A.toast("That file is " + Math.round(file.size / 1048576 * 10) / 10 + " MB, over the 5 MB limit.", true);
        return;
      }

      var folder = row.kind === "slot" ? "slots/" + row.id
                 : row.kind === "item" ? "items/" + row.id
                 : "marks/" + row.id;
      var path = folder + "/" + Date.now() + "-" + safeName(file.name);
      var was = row.current;

      A.toast("Uploading " + file.name + ".");
      Promise.all([
        A.db().storage.from(BUCKET).upload(path, file, {
          contentType: file.type, cacheControl: "31536000", upsert: false
        }),
        row.kind === "org" ? measure(file) : Promise.resolve(null)
      ]).then(function (res) {
        if (res[0].error) { A.toast("The upload failed: " + res[0].error.message, true); return; }
        var url = A.db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        var size = res[1];

        var write;
        if (row.kind === "slot") {
          write = A.db().from("site_images")
            .update({ url: url, updated_by: (admin && admin.email) || "" })
            .eq("slot", row.id)
            .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
        } else if (row.kind === "item") {
          write = A.update("section_items", row.id, { image: url });
        } else {
          var patch = { mark: url };
          if (size) { patch.mark_w = size.w; patch.mark_h = size.h; }
          write = A.update("organisations", row.id, patch);
        }

        write.then(function (r) {
          if (r.error) {
            // never leave a file in storage that nothing points at
            A.db().storage.from(BUCKET).remove([path]);
            A.toast(r.error, true);
            return;
          }
          forget(was);
          A.toast(row.name + " replaced. The site is showing the new picture.");
          load();
        });
      });
    });

    /* ---- putting the original back ---------------------------------------- */
    function undo(row) {
      A.modal({
        title: "Put the original back",
        note: row.name,
        confirm: "Put it back",
        fields: [],
        before: '<p style="font-size:14px;line-height:1.6;color:var(--ink-2);margin:0">' +
          "The site goes back to <b>" + A.escapeHtml(row.shipped) + "</b>, the picture that ships " +
          "with it. The file you uploaded is deleted.</p>"
      }).then(function (ok) {
        if (!ok) return;
        var was = row.current;
        var write;
        if (row.kind === "slot") {
          write = A.db().from("site_images")
            .update({ url: "", updated_by: (admin && admin.email) || "" })
            .eq("slot", row.id)
            .then(function (r) { return r.error ? { error: r.error.message } : { ok: true }; });
        } else if (row.kind === "item") {
          write = A.update("section_items", row.id, { image: row.shipped });
        } else {
          write = A.update("organisations", row.id, { mark: row.shipped });
        }
        write.then(function (r) {
          if (r.error) { A.toast(r.error, true); return; }
          forget(was);
          A.toast("Put back.");
          load();
        });
      });
    }

    content.addEventListener("click", function (e) {
      var put = e.target.closest("[data-put]"), un = e.target.closest("[data-undo]");
      if (put) { var a = find(put.getAttribute("data-put")); if (a) replace(a); return; }
      if (un) { var b = find(un.getAttribute("data-undo")); if (b) undo(b); }
    });

    /* ---- load ------------------------------------------------------------- */
    function load() {
      return gather().then(function (rows) {
        state.rows = rows;
        state.missing = {};
        render();
        // then say which of them are not actually there
        return Promise.all(rows.map(function (r) {
          return check(r).then(function (ok) {
            if (!ok) state.missing[r.kind + ":" + r.id] = true;
          });
        })).then(render);
      });
    }

    load();
  });
})();
