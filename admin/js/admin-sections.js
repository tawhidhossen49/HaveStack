/* sections: Page sections */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("sections.html", 'Page sections', 'What the public page shows, and what it hides.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('Every section of the public page is listed here in the order it appears. Turning one off removes it from the page and takes its link out of the menu at the same time, so nothing is left pointing at something a visitor cannot reach.') + A.panel({ title: 'Sections of the public page', flush: true, body: '<div id="list">' + A.empty('Loading', 'Reading the page.') + '</div>' });

    var box = document.getElementById('list');
    var cache = [], counts = {};

    function render() {
      if (!cache.length) {
        box.innerHTML = A.failed('The site_sections table is empty. Run ' +
          'supabase/site-schema.sql in the SQL editor to fill it from the page.');
        return;
      }
      box.innerHTML = A.table(
        ['Section', 'Heading on the page', 'Contents', 'In the menu', 'On the page', ''],
        cache.map(function (s) {
          var n = counts[s.key] || 0;
          return '<tr' + (s.visible ? '' : ' class="is-off"') + '>' +
            '<td><b>' + A.escapeHtml(s.label) + '</b>' +
              '<div class="row-note">#' + A.escapeHtml(s.key) + '</div></td>' +
            '<td>' + A.escapeHtml(s.heading || '—') + '</td>' +
            '<td>' + (n ? n + ' ' + A.escapeHtml(s.item_noun) + (n === 1 ? '' : 's')
                        : '<span class="muted">nothing to edit</span>') + '</td>' +
            '<td>' + (s.nav_label
              ? (s.in_nav ? A.escapeHtml(s.nav_label) : '<span class="muted">hidden</span>')
              : '<span class="muted">not in the menu</span>') + '</td>' +
            '<td>' + (s.visible ? '<span class="tag tag-live">shown</span>'
                                : '<span class="tag tag-draft">hidden</span>') + '</td>' +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<a class="btn btn-sm" href="section.html?key=' + encodeURIComponent(s.key) + '">Edit</a>' +
              '<button class="btn btn-sm" type="button" data-vis="' + s.key + '">' +
                (s.visible ? 'Hide' : 'Show') + '</button>' +
            '</div></td>' +
          '</tr>';
        }).join(''));
    }

    function load() {
      return Promise.all([
        A.rows('site_sections'),
        AdminAuth.client().from('section_items').select('section_key')
          .then(function (r) { return r; })
      ]).then(function (res) {
        if (res[0].error) { box.innerHTML = A.failed(res[0].error); return; }
        cache = res[0].data;
        counts = {};
        if (!res[1].error) {
          (res[1].data || []).forEach(function (i) {
            counts[i.section_key] = (counts[i.section_key] || 0) + 1;
          });
        }
        render();
      });
    }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vis]');
      if (!b) return;
      var key = b.getAttribute('data-vis');
      var s = cache.filter(function (x) { return x.key === key; })[0];
      if (!s) return;

      /* Hiding is the one action here a visitor sees immediately, so it asks
         first and says what will happen rather than just doing it. */
      if (s.visible && !window.confirm(
            'Hide "' + s.label + '" from the public page?\n\n' +
            'It stops being sent to visitors and its link is removed from the ' +
            'menu. Nothing is deleted, and you can show it again at any time.')) {
        return;
      }
      b.disabled = true;
      AdminAuth.client().from('site_sections')
        .update({ visible: !s.visible }).eq('key', key)
        .then(function (r) {
          if (r.error) { A.toast(r.error.message, true); b.disabled = false; return; }
          A.toast(s.visible ? '"' + s.label + '" is hidden from the page.'
                            : '"' + s.label + '" is back on the page.');
          load();
        });
    });

    load();
  });
})();
