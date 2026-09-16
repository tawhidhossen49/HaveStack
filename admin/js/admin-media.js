/* media: Images
   Every picture on the public site in one place, with the file behind it, what
   that place requires, and a way to replace it.

   Three kinds of picture, one way of working with them. A capability or a
   sector picture is a column on its own row. A client or partner mark is a
   column on the organisation. The rest, the logo and the tab icon and the
   photographs behind the page, are fixed parts of the layout and have a row
   each in site_images, keyed by where they appear.

   Nothing is uploaded until it fits. Every place on the page has a shape, a
   smallest useful size and sometimes a demand for a transparent background,
   because the page treats these pictures differently: a mark is tinted to one
   flat grey, a capability picture is cropped to a 21 by 8 band, a sector
   picture fills a tile. A file that does not fit is refused before it reaches
   storage, and the reason says what this place needs and what the file was.

   The file that ships with the site is never touched and never forgotten, so
   "Undo" is always available and always works. */
(function () {
  "use strict";
  var A = window.Admin;
  var BUCKET = "site-media";
  var MAX = 5 * 1024 * 1024;

  /* ---------- what each place on the page will accept ----------------------
     ratio is width divided by height; tol is how far from it a picture may sit
     before the crop starts throwing away the subject. alpha "required" means
     the page tints or overlays the picture and a solid background would show
     as a block. */
  var PHOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  var FLAT = ["image/png", "image/svg+xml", "image/webp"];

  var SLOT_SPEC = {
    logo_mark: {
      types: FLAT, minW: 96, minH: 96, ratio: 1, tol: 0.12, alpha: "required",
      say: "Square, transparent background, at least 96 by 96. It is drawn 23 pixels wide beside the wordmark, so fine detail is lost."
    },
    favicon: {
      types: FLAT, minW: 64, minH: 64, ratio: 1, tol: 0.06, alpha: "better",
      say: "Square, at least 64 by 64. A transparent or solid background both work, but it is shown very small, so a simple mark reads best."
    },
    og_card: {
      types: PHOTO, minW: 1200, minH: 630, ratio: 1200 / 630, tol: 0.06,
      say: "1200 by 630, the shape chats and social posts crop to. Anything else is cut off at the sides or the top."
    },
    logo_full: {
      types: FLAT, minW: 112, minH: 112, ratio: 1, tol: 0.25, alpha: "better",
      say: "Square, at least 112 by 112. This is the mark search engines are handed for the organisation."
    },
    hero_poster: {
      types: PHOTO, minW: 1280, minH: 720, ratio: 16 / 9, tol: 0.10,
      say: "Landscape 16 by 9, at least 1280 by 720. It stands in for the film until it plays."
    },
    products_floor: {
      types: PHOTO, minW: 1600, minH: 600, ratio: 8 / 3, tol: 0.55,
      say: "A wide landscape photograph, at least 1600 across. It runs along the bottom of the section as a band and is graded dark."
    }
  };
  var OPS_SPEC = {
    types: PHOTO, minW: 1200, minH: 700, ratio: 3 / 2, tol: 0.40,
    say: "Landscape photograph, at least 1200 by 700. It is cropped to fill a wide frame and graded dark, so keep the subject away from the edges."
  };
  var ITEM_SPEC = {
    services: {
      types: PHOTO, minW: 1200, minH: 457, ratio: 21 / 8, tol: 0.14,
      say: "A wide banner, 21 by 8. The shipped pictures are 1200 by 457. A squarer picture is cropped top and bottom."
    },
    sectors: {
      types: PHOTO, minW: 1000, minH: 750, ratio: 4 / 3, tol: 0.30,
      say: "Landscape, at least 1000 by 750. It fills a tile and is graded dark, so a busy picture loses its subject."
    },
    other: {
      types: PHOTO, minW: 900, minH: 600, ratio: 3 / 2, tol: 0.45,
      say: "Landscape, at least 900 by 600."
    }
  };
  var ORG_SPEC = {
    types: FLAT, minW: 120, minH: 120, maxRatio: 10, alpha: "required",
    say: "Transparent background, at least 120 pixels tall. The row tints every mark to one flat grey, so a mark on a white box becomes a grey block."
  };

  function specFor(row) {
    if (row.kind === "slot") return SLOT_SPEC[row.id] || OPS_SPEC;
    if (row.kind === "org") return ORG_SPEC;
    return ITEM_SPEC[row.section] || ITEM_SPEC.other;
  }

  /* ---------- laid out the way the page reads ------------------------------
     Down the page, section by section, so a picture is found where a reader
     would look for it rather than where it happens to be stored. The three
     tables behind these rows are an implementation detail and are not worth
     making anybody think about. */
  var GROUPS = [
    { id: "brand", title: "Brand",
      note: "The mark, the tab icon, and the pictures that stand for the site somewhere else.",
      slots: ["logo_mark", "favicon", "og_card", "logo_full"] },
    { id: "hero", title: "Hero",
      note: "The film itself is not replaced from here. This is the frame shown before it plays.",
      slots: ["hero_poster"] },
    { id: "capabilities", title: "Capabilities section",
      note: "One banner for each practice area.",
      sections: ["services"] },
    { id: "maintenance", title: "Maintenance section",
      note: "The photograph beside the heading, and one for each row. A row's picture is also the " +
            "one across the top of that row's own page.",
      slots: ["ops_systems", "ops_ai", "ops_data", "ops_infra", "ops_report"] },
    { id: "products", title: "Products section",
      note: "The band along the bottom of the section.",
      slots: ["products_floor"] },
    { id: "sectors", title: "Sectors section",
      note: "One picture for each tile in the mosaic.",
      sections: ["sectors"] },
    { id: "marks", title: "Clients and partners",
      note: "Each mark keeps the height chosen for that organisation, so a replacement sits at the " +
            "same size as the one it replaced.",
      orgs: true },
    { id: "other", title: "Elsewhere on the page",
      note: "Pictures on blocks in the other sections." }
  ];

  function groupOf(row) {
    for (var i = 0; i < GROUPS.length; i++) {
      var g = GROUPS[i];
      if (row.kind === "slot" && g.slots && g.slots.indexOf(row.id) > -1) return g.id;
      if (row.kind === "item" && g.sections && g.sections.indexOf(row.section) > -1) return g.id;
      if (row.kind === "org" && g.orgs) return g.id;
    }
    return "other";
  }

  function kindName(type) {
    return ({ "image/png": "a PNG", "image/jpeg": "a JPEG", "image/webp": "a WebP",
              "image/svg+xml": "an SVG", "image/avif": "an AVIF" })[type] || "that kind of file";
  }
  function typeList(types) {
    var names = types.map(function (t) {
      return ({ "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP",
                "image/svg+xml": "SVG", "image/avif": "AVIF" })[t];
    });
    return names.slice(0, -1).join(", ") + " or " + names[names.length - 1];
  }

  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("media.html", "Images",
      "Every picture on the public site, and the file behind it.", null, admin);
    if (!content) return;

    content.innerHTML =
      A.notice("Replacing a picture changes the public site as soon as it finishes uploading. " +
        "Each place has a shape and a smallest size, written under the picture; a file that does " +
        "not fit is refused before it uploads, so a replacement cannot break the layout. The file " +
        "that ships with the site stays where it is, so you can always put the original back.") +
      '<div id="m-trouble"></div>' +
      GROUPS.map(function (g, i) {
        return '<div id="p-' + g.id + '">' + A.panel({
          title: g.title, note: g.note, flush: true,
          body: '<div id="g-' + g.id + '">' +
            (i === 0 ? A.empty("Loading", "Reading the site.") : "") + "</div>"
        }) + "</div>";
      }).join("") +
      '<input type="file" id="picker" hidden />';

    var picker = document.getElementById("picker");
    var state = { rows: [], missing: {}, trouble: [] };

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

        /* A read that fails must say so. Treating it as "nothing here" hides a
           whole group of pictures and looks exactly like a page that has none,
           which is how a policy that forgot the signed in role went unnoticed. */
        state.trouble = [
          [res[0].error, "the fixed pictures"],
          [res[1].error, "the pictures on section blocks"],
          [res[2].error, "the client and partner marks"]
        ].filter(function (p) { return p[0]; })
         .map(function (p) { return p[1] + " (" + (p[0].message || p[0]) + ")"; });

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
            kind: "item", id: i.id, name: i.title, section: i.section_key,
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
        '<div class="media-needs">' + A.escapeHtml(specFor(row).say) + "</div>" +
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
      document.getElementById("m-trouble").innerHTML = state.trouble.length
        ? A.failed("Could not read " + state.trouble.join(", and ") +
            ". Those pictures are not listed below, which is a fault here rather than a page with " +
            "no pictures in it.")
        : "";
      GROUPS.forEach(function (g) {
        var mine = state.rows.filter(function (r) { return groupOf(r) === g.id; });
        var box = document.getElementById("g-" + g.id);
        var panel = document.getElementById("p-" + g.id);
        if (!box || !panel) return;
        // a section with no pictures of its own says nothing at all
        panel.hidden = !mine.length;
        box.innerHTML = mine.length ? '<div class="media">' + mine.map(card).join("") + "</div>" : "";
      });
    }

    /* ---- reading the file before it goes anywhere ------------------------- */
    function decode(file) {
      return new Promise(function (done) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { done({ img: img, url: url, w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = function () { URL.revokeObjectURL(url); done(null); };
        img.src = url;
      });
    }

    /* Has it a transparent background? The four corners answer it for a mark
       on clear ground, and the share of fully clear pixels catches a picture
       cut out in some other shape. Read small: a 64 pixel copy is plenty and
       costs nothing. */
    function isCutOut(img) {
      var n = 64;
      var c = document.createElement("canvas");
      c.width = n; c.height = n;
      var x = c.getContext("2d", { willReadFrequently: true });
      if (!x) return true;                       // cannot tell, do not block
      x.drawImage(img, 0, 0, n, n);
      var d;
      try { d = x.getImageData(0, 0, n, n).data; }
      catch (e) { return true; }                 // cannot tell, do not block
      var clearCorners = [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]
        .every(function (p) { return d[(p[1] * n + p[0]) * 4 + 3] < 24; });
      var clear = 0;
      for (var i = 3; i < d.length; i += 4) if (d[i] < 24) clear++;
      return clearCorners || clear / (n * n) > 0.12;
    }

    /* The whole gate. Resolves with the measurements, or with why not. */
    function vet(file, spec) {
      if (spec.types.indexOf(file.type) < 0) {
        return Promise.resolve({ no: "This place takes " + typeList(spec.types) + ". You chose " +
          kindName(file.type) + "." });
      }
      if (file.size > MAX) {
        return Promise.resolve({ no: "That file is " + (Math.round(file.size / 1048576 * 10) / 10) +
          " MB. The limit is 5 MB, because every visitor downloads it." });
      }
      // an SVG draws at any size and carries no pixel grid to measure
      if (file.type === "image/svg+xml") return Promise.resolve({ w: 0, h: 0, vector: true });

      return decode(file).then(function (got) {
        if (!got) return { no: "That file could not be opened as an image. It may be damaged, or named with the wrong extension." };
        var w = got.w, h = got.h, out = null;

        if (w < spec.minW || h < spec.minH) {
          out = { no: "That picture is " + w + " by " + h + ". This place needs at least " +
            spec.minW + " by " + spec.minH + ", or it will look soft on a good screen." };
        } else if (spec.ratio) {
          var off = Math.abs((w / h) - spec.ratio) / spec.ratio;
          if (off > spec.tol) {
            out = { no: "That picture is " + w + " by " + h + ", which is " + shape(w / h) +
              ". This place needs " + shape(spec.ratio) + ", near " + near(spec.ratio, w) +
              ". Crop it first, or the page will cut off part of it." };
          }
        } else if (spec.maxRatio && (w / h) > spec.maxRatio) {
          out = { no: "That mark is " + w + " by " + h + ", far wider than it is tall. A mark wider " +
            "than " + spec.maxRatio + " to 1 shrinks to nothing in the row." };
        }

        if (!out && spec.alpha === "required" && !isCutOut(got.img)) {
          out = { no: "That picture has a solid background. This one must be cut out, on a " +
            "transparent background, because the page tints every mark to one flat grey and a " +
            "solid background becomes a grey block. Save it as a PNG with transparency." };
        }

        URL.revokeObjectURL(got.url);
        return out || { w: w, h: h };
      });
    }

    function shape(r) {
      if (Math.abs(r - 1) < 0.06) return "square";
      if (r < 1) return "taller than it is wide";
      if (r > 3) return "a very wide band";
      return Math.round(r * 100) / 100 + " to 1";
    }
    function near(ratio, w) {
      var width = Math.max(w || 0, 1200);
      return width + " by " + Math.round(width / ratio);
    }

    /* ---- replacing one --------------------------------------------------- */
    function find(handle) {
      var bits = handle.split(":");
      return state.rows.filter(function (r) { return r.kind === bits[0] && String(r.id) === bits.slice(1).join(":"); })[0];
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

    function refuse(row, why) {
      A.modal({
        title: "That picture will not fit here",
        note: row.name,
        confirm: "Choose another",
        fields: [],
        before: '<p class="media-refuse">' + A.escapeHtml(why) + "</p>" +
                '<p class="media-refuse-need"><b>What this place needs:</b> ' +
                A.escapeHtml(specFor(row).say) + "</p>"
      }).then(function (again) {
        if (again) replace(row);          // straight back to the file picker
      });
    }

    var pending = null;
    function replace(row) {
      pending = row;
      picker.value = "";
      picker.setAttribute("accept", specFor(row).types.join(","));
      picker.click();
    }

    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      var row = pending;
      pending = null;
      if (!file || !row) return;
      var spec = specFor(row);

      vet(file, spec).then(function (verdict) {
        if (verdict.no) { refuse(row, verdict.no); return; }

        var folder = row.kind === "slot" ? "slots/" + row.id
                   : row.kind === "item" ? "items/" + row.id
                   : "marks/" + row.id;
        var path = folder + "/" + Date.now() + "-" + safeName(file.name);
        var was = row.current;

        A.toast("Uploading " + file.name + ".");
        A.db().storage.from(BUCKET).upload(path, file, {
          contentType: file.type, cacheControl: "31536000", upsert: false
        }).then(function (up) {
          if (up.error) { A.toast("The upload failed: " + up.error.message, true); return; }
          var url = A.db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

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
            // the real pixel size, so the row reserves the right space
            if (verdict.w) { patch.mark_w = verdict.w; patch.mark_h = verdict.h; }
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
    });

    /* ---- putting the original back ---------------------------------------- */
    function undo(row) {
      A.modal({
        title: "Put the original back",
        note: row.name,
        confirm: "Put it back",
        fields: [],
        before: '<p class="media-refuse">' +
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
