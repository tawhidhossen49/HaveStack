/* =========================================================
   site-content.js
   ---------------------------------------------------------
   Lets the admin panel change what this page shows.

   Progressive enhancement, deliberately. The markup already
   holds the real content, so a crawler, a reader with no
   JavaScript, and anyone hitting the page while Supabase is
   slow or down all see the finished page. This script runs
   afterwards and replaces a section only when it has actually
   fetched rows for it. Nothing is emptied, nothing flashes,
   and a failure here is invisible.

   It talks to PostgREST directly rather than loading
   supabase-js. The library is 212KB and everything needed
   here is two GET requests with one header; putting a client
   library on a marketing page to read six rows would be a
   poor trade.
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
      // the page is already correct without this; never let it block paint
      cache: "no-store"
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---- products ---------------------------------------------------------- */
  function products(rows) {
    var box = document.querySelector("#products .idx");
    if (!box || !rows || !rows.length) return;

    box.innerHTML = rows.map(function (p) {
      var tail = p.link
        ? '<a class="idx-link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' +
            'Visit <span class="ar" aria-hidden="true">&#8599;</span></a>'
        : '<span class="idx-state">' + esc(p.state_label || "Not yet public") + "</span>";

      /* rendered already revealed: the observer that fades these in has long
         since passed over the originals, so a fresh node would otherwise sit
         at opacity zero for ever */
      return '<div class="idx-row rv in">' +
        '<svg class="ic" aria-hidden="true" focusable="false"><use href="#' + esc(p.icon || "i-database") + '"/></svg>' +
        '<div class="idx-main">' +
          "<h3>" + esc(p.name) + "</h3>" +
          "<p>" + esc(p.blurb) + "</p>" +
          tail +
        "</div></div>";
    }).join("");
  }

  /* ---- clients and partners ---------------------------------------------- */
  function marks(rows) {
    if (!rows || !rows.length) return;

    [["client", "#work"], ["partner", "#partners"]].forEach(function (pair) {
      var list = document.querySelector(pair[1] + " .marks");
      if (!list) return;
      var mine = rows.filter(function (o) { return o.register === pair[0]; });
      // an empty register would blank a section that currently reads fine, so
      // only replace when there is something to put there
      if (!mine.length) return;

      list.innerHTML = mine.map(function (o) {
        return '<li class="mark"><img src="' + esc(o.mark) + '" alt="' + esc(o.name) + '" ' +
          'width="' + (o.mark_w || 160) + '" height="' + (o.mark_h || 160) + '" ' +
          'loading="lazy" decoding="async" /></li>';
      }).join("");
    });
  }

  function run() {
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
