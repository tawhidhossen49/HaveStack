/* =========================================================
   site-content.js
   ---------------------------------------------------------
   Lets the admin panel change what this page shows: which
   sections appear at all, what their headings say, and the
   blocks inside them.

   Progressive enhancement, deliberately. The markup already
   holds the real content, so a crawler, a reader with no
   JavaScript, and anyone hitting the page while Supabase is
   slow or down all see the finished page. This script runs
   afterwards and replaces a part of it only when it has
   actually fetched rows for that part. Nothing is emptied,
   nothing flashes, and a failure here is invisible.

   Two rules worth knowing before editing this file.

   First: items are rendered by cloning the markup already on
   the page and refilling it, never by writing new HTML from
   scratch. The page's own classes, icons and structure are
   therefore impossible to get wrong from here, and a design
   change to index.html needs no matching change down here.

   Second: hiding a section is a server side decision. The row
   level security policy will not send a hidden section or its
   items to an anonymous reader at all, so this file removes
   what it never received rather than styling away something
   it was given.

   It talks to PostgREST directly rather than loading
   supabase-js. The library is 212KB and everything needed
   here is four GET requests with one header.
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var URL_ = CFG.supabaseUrl || "";
  var KEY_ = CFG.supabaseKey || "";
  if (!URL_ || !KEY_) return;          // nothing configured: leave the page alone

  function get(path) {
    return fetch(URL_ + "/rest/v1/" + path, {
      headers: { apikey: KEY_, Authorization: "Bearer " + KEY_ },
      cache: "no-store"
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function text(root, sel, value) {
    if (value == null || value === "") return;
    var el = root.querySelector(sel);
    if (el) el.textContent = value;
  }

  /* ---- items ---------------------------------------------------------------
     Clone the first child as a template and refill it once per row. Every
     class, wrapper and attribute the design relies on comes along for free. */
  function repaint(container, itemSel, rows, fill) {
    if (!container || !rows || !rows.length) return false;
    var template = container.querySelector(itemSel);
    if (!template) return false;

    var made = rows.map(function (row, i) {
      var node = template.cloneNode(true);
      fill(node, row, i);
      // the reveal observer has long since passed over the originals, so a
      // fresh node would otherwise sit at opacity zero for ever
      node.classList.add("in");
      return node;
    });

    Array.prototype.slice.call(container.querySelectorAll(itemSel))
      .forEach(function (n) { n.remove(); });
    made.forEach(function (n) { container.appendChild(n); });
    return true;
  }

  function setIcon(node, icon) {
    if (!icon) return;
    var use = node.querySelector("svg.ic use");
    if (use) use.setAttribute("href", "#" + icon);
  }

  function setList(node, sel, bullets) {
    var ul = node.querySelector(sel);
    if (!ul || !bullets) return;
    ul.innerHTML = bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("");
  }

  /* ---- sections ------------------------------------------------------------ */
  function applySections(rows) {
    if (!rows || !rows.length) return null;

    var byKey = {};
    rows.forEach(function (s) { byKey[s.key] = s; });

    /* Anything the server did not send is either hidden or not a section this
       build knows about. Only the first is our business, so compare against
       the sections actually present in the page. */
    Array.prototype.slice.call(document.querySelectorAll("section[id]"))
      .forEach(function (el) {
        var key = el.id;
        // hero and anything not under the panel's control stays as it is
        if (!(key in byKey) && !KNOWN[key]) return;
        var s = byKey[key];

        if (!s) {
          el.remove();
          dropNav(key);
          return;
        }
        if (!s.in_nav) dropNav(key);

        text(el, ".kicker", s.kicker);
        text(el, ".h2", s.heading);
        text(el, ".lead.sect-intro", s.intro);
        if (s.note) text(el, ".priority p", s.note);
      });

    return byKey;
  }

  /* Every link that points at a section: the header nav, the mobile menu and
     the footer all use the same fragment, so one selector covers them. A link
     left pointing at a section that is no longer on the page is worse than no
     link at all. */
  function dropNav(key) {
    Array.prototype.slice.call(document.querySelectorAll('a[href="#' + key + '"]'))
      .forEach(function (a) {
        var li = a.closest("li");
        (li || a).remove();
      });
  }

  /* The sections this file knows how to manage. Anything else on the page is
     left alone even if a row appears for it, so a stray row cannot blank part
     of the site. */
  var KNOWN = {
    about: 1, services: 1, maintenance: 1, products: 1, work: 1,
    partners: 1, sectors: 1, process: 1, standards: 1, clients: 1, book: 1
  };

  /* ---- one renderer per section -------------------------------------------- */
  var RENDER = {
    about: function (items) {
      repaint(document.querySelector("#about .cond-grid"), ".cond", items,
        function (n, it) {
          setIcon(n, it.icon);
          text(n, ".h3", it.title);
          text(n, "p", it.body);
        });
    },

    services: function (items) {
      var list = document.querySelector("#services .tablist");
      var wrap = document.querySelector("#services .tabs");
      if (!list || !wrap || !items.length) return;

      var tabTemplate = list.querySelector(".tab");
      var panelTemplate = wrap.querySelector(".panel");
      if (!tabTemplate || !panelTemplate) return;

      var tabs = [], panels = [];
      items.forEach(function (it, i) {
        var key = it.item_key || ("cap" + i);
        var t = tabTemplate.cloneNode(true);
        t.id = "t-" + key;
        t.setAttribute("aria-controls", "p-" + key);
        t.setAttribute("data-cap", key);
        t.setAttribute("aria-selected", i === 0 ? "true" : "false");
        t.tabIndex = i === 0 ? 0 : -1;
        t.textContent = it.meta || it.title;
        tabs.push(t);

        var p = panelTemplate.cloneNode(true);
        p.id = "p-" + key;
        p.setAttribute("aria-labelledby", "t-" + key);
        p.hidden = i !== 0;
        text(p, ".panel-body .h3", it.title);
        text(p, ".panel-body p", it.body);
        var img = p.querySelector(".panel-media img");
        if (img && it.image) { img.src = it.image; img.removeAttribute("srcset"); }
        var tagbox = p.querySelector(".tags");
        if (tagbox) {
          tagbox.innerHTML = (it.bullets || []).map(function (b) {
            return '<span class="tag">' + esc(b) + "</span>";
          }).join("");
        }
        p.classList.add("in");
        panels.push(p);
      });

      Array.prototype.slice.call(list.querySelectorAll(".tab")).forEach(function (n) { n.remove(); });
      tabs.forEach(function (n) { list.appendChild(n); });
      Array.prototype.slice.call(wrap.querySelectorAll(".panel")).forEach(function (n) { n.remove(); });
      panels.forEach(function (n) { wrap.appendChild(n); });
    },

    maintenance: function (items) {
      repaint(document.querySelector("#maintenance .ops"), ".op", items, function (n, it) {
        // the variant class carries the hover image, so it travels with the row
        n.className = n.className.replace(/\bop-[a-z]+\b/g, "").trim();
        if (it.meta) n.classList.add(it.meta);
        setIcon(n, it.icon);
        text(n, ".h3", it.title);
        setList(n, ".op-list", it.bullets);
        var more = n.querySelector(".op-more");
        if (more) {
          if (it.link) {
            more.href = it.link;
            var vh = more.querySelector(".vh");
            if (vh) vh.textContent = " about " + it.title;
          } else {
            more.remove();
          }
        }
      });
    },

    sectors: function (items) {
      repaint(document.querySelector("#sectors .mosaic"), ".scard", items,
        function (n, it) {
          /* sc-a to sc-f are what place a tile in the mosaic, so the variant
             travels with the row. Without it every tile would land in the
             same cell. */
          n.className = n.className.replace(/\bsc-[a-z]\b/g, "").trim();
          if (it.meta) n.classList.add(it.meta);
          text(n, ".h3", it.title);
          text(n, "p", it.body);
          var img = n.querySelector("img");
          if (img && it.image) { img.src = it.image; img.removeAttribute("srcset"); }
        });
    },

    process: function (items) {
      repaint(document.querySelector("#process .stages"), ".stage", items,
        function (n, it) {
          setIcon(n, it.icon);
          text(n, ".h3", it.title);
          text(n, "p", it.body);
          // meta is what the stage produces, shown beneath it
          var out = n.querySelector(".stage-out b");
          if (out && it.meta) out.textContent = it.meta;
        });
    },

    standards: function (items) {
      repaint(document.querySelector("#standards .std-grid"), ".std", items,
        function (n, it, i) {
          setIcon(n, it.icon);
          var h = n.querySelector(".h3");
          if (h) {
            h.textContent = it.title;
            // the group is labelled by its own heading, so the id has to
            // follow the heading rather than the position it used to be in
            h.id = "s-" + (i + 1);
            n.setAttribute("aria-labelledby", h.id);
          }
          setList(n, ".std-list", it.bullets);
        });
    },

    clients: function (items) {
      var standing = items.filter(function (i) { return i.meta === "standing"; })[0];
      if (standing) {
        var say = document.querySelector("#clients .gov-say");
        if (say) {
          text(say, ".h3", standing.title);
          var ps = say.querySelectorAll("p");
          var paras = String(standing.body || "").split(/\n{2,}/);
          if (ps.length && paras.length) {
            // keep the first paragraph node and rebuild the rest from it
            for (var i = ps.length - 1; i > 0; i--) ps[i].remove();
            ps[0].textContent = paras[0];
            for (var j = 1; j < paras.length; j++) {
              var p = ps[0].cloneNode(false);
              p.textContent = paras[j];
              say.appendChild(p);
            }
          }
        }
      }

      var orgs = items.filter(function (i) {
        return i.meta !== "standing" && i.meta !== "fact" && i.item_key !== "fact";
      });
      var lin = document.querySelector("#clients .lin");
      repaint(lin, ".lin-item", orgs, function (n, it) {
        var role = String(it.meta || "").split("|")[0];
        var self = /\|self$/.test(it.meta || "");
        n.classList.toggle("is-self", self);
        var b = n.querySelector("b"), s = n.querySelector("span:not(.lin-dot)");
        if (b) b.textContent = it.title;
        if (s) s.textContent = role;
      });

      var facts = items.filter(function (i) {
        return i.meta === "fact" || i.item_key === "fact";
      });
      var dl = document.querySelector("#clients .gov-facts");
      repaint(dl, ".gov-fact", facts, function (n, it) {
        var dt = n.querySelector("dt"), dd = n.querySelector("dd");
        if (dt) dt.textContent = it.title;
        if (dd) dd.textContent = it.body;
      });
    }
  };

  /* ---- settings ------------------------------------------------------------
     Only what the page actually renders. Changing the address here changes
     every place the site offers it, rather than leaving the footer and the
     request page to be kept in step by hand. */
  function settings(rows) {
    if (!rows || !rows.length) return;
    var map = {};
    rows.forEach(function (r) { map[r.key] = r.value; });

    var email = map.contact_email;
    if (email) {
      Array.prototype.slice.call(document.querySelectorAll('a[href^="mailto:"]'))
        .forEach(function (a) {
          var was = a.getAttribute("href").replace(/^mailto:/, "").split("?")[0];
          a.setAttribute("href", a.getAttribute("href").replace(was, email));
          // only relabel a link whose text is the address itself
          if (a.textContent.trim() === was) a.textContent = email;
        });
      if (window.SITE_CONFIG) window.SITE_CONFIG.contactEmail = email;
    }
  }

  /* ---- products and the two registers, unchanged --------------------------- */
  function products(rows) {
    var box = document.querySelector("#products .idx");
    if (!box || !rows || !rows.length) return;

    box.innerHTML = rows.map(function (p) {
      var tail = p.link
        ? '<a class="idx-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' +
            'Visit <span class="ar" aria-hidden="true">&#8599;</span></a>'
        : '<span class="idx-state">' + esc(p.state_label || "Not yet public") + "</span>";

      return '<div class="idx-row rv in">' +
        '<svg class="ic" aria-hidden="true" focusable="false"><use href="#' + esc(p.icon || "i-database") + '"/></svg>' +
        '<div class="idx-main">' +
          "<h3>" + esc(p.name) + "</h3>" +
          "<p>" + esc(p.blurb) + "</p>" +
          tail +
        "</div></div>";
    }).join("");
  }

  function marks(rows) {
    if (!rows || !rows.length) return;
    [["client", "#work"], ["partner", "#partners"]].forEach(function (pair) {
      var list = document.querySelector(pair[1] + " .marks");
      if (!list) return;
      var mine = rows.filter(function (o) { return o.register === pair[0]; });
      if (!mine.length) return;
      list.innerHTML = mine.map(function (o) {
        return '<li class="mark"><img src="' + esc(o.mark) + '" alt="' + esc(o.name) + '" ' +
          'width="' + (o.mark_w || 160) + '" height="' + (o.mark_h || 160) + '" ' +
          'loading="lazy" decoding="async" /></li>';
      }).join("");
    });
  }

  /* ---- go ------------------------------------------------------------------ */
  function run() {
    Promise.all([
      get("site_sections?select=key,nav_label,kicker,heading,intro,note,in_nav&order=sort"),
      get("section_items?select=section_key,item_key,icon,title,body,bullets,link,image,meta,sort&order=sort")
    ]).then(function (res) {
      var sections = res[0], items = res[1];
      if (!sections || !sections.length) return;   // say nothing rather than guess

      applySections(sections);
      if (!items) return;

      var bySection = {};
      items.forEach(function (it) {
        (bySection[it.section_key] = bySection[it.section_key] || []).push(it);
      });
      Object.keys(RENDER).forEach(function (key) {
        var rows = bySection[key];
        if (!rows || !rows.length) return;         // never blank a section
        try { RENDER[key](rows); }
        catch (e) { /* one broken section must not take the others down */ }
      });
    });

    get("site_settings?select=key,value").then(settings);
    get("products?select=name,blurb,icon,link,state_label,sort&published=eq.true&order=sort")
      .then(products);
    get("organisations?select=name,register,mark,mark_w,mark_h,sort&published=eq.true&order=sort")
      .then(marks);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
