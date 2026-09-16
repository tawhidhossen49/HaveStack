/* updates: Updates */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("updates.html", 'Updates', 'Announcements, investor updates and notices.', null, me);
    if (!content) return;
    content.innerHTML = P.panel({ title: 'Loading', body: P.loadingLines(6) });

    var KINDS = [['all', 'All'], ['announcement', 'Announcements'],
                 ['investor_update', 'Investor updates'], ['dividend', 'Dividends'],
                 ['meeting', 'Meetings'], ['document', 'Documents']];
    var all = [], filter = 'all';

    function render() {
      var box = document.getElementById('feed');
      var list = filter === 'all' ? all : all.filter(function (u) { return u.kind === filter; });

      if (!all.length) {
        box.innerHTML = P.empty('Nothing published yet',
          'Company announcements, investor updates, dividend notices and meeting papers ' +
          'appear here as they are issued.');
        return;
      }
      if (!list.length) {
        box.innerHTML = P.empty('Nothing of that kind',
          'No update of that kind has been published yet.');
        return;
      }

      box.innerHTML = '<div class="tl">' + list.map(function (u) {
        return '<div class="tl-item' + (u.pinned ? ' is-key' : '') + '">' +
          '<div class="tl-when">' + P.escapeHtml(P.updateKind(u.kind)) +
            ' · ' + P.dateTime(u.published_at) +
            (u.pinned ? '  Pinned' : '') + '</div>' +
          '<div class="tl-title">' + P.escapeHtml(u.title) + '</div>' +
          (u.body ? '<div class="tl-body">' + P.escapeHtml(u.body) + '</div>' : '') +
        '</div>';
      }).join('') + '</div>';
    }

    content.innerHTML = P.panel({
      title: 'Company updates',
      flush: false,
      actions: '<div class="seg" role="group" aria-label="Filter by kind">' +
        KINDS.map(function (k) {
          return '<button type="button" data-kind="' + k[0] + '" aria-pressed="' +
            (k[0] === filter) + '">' + P.escapeHtml(k[1]) + '</button>';
        }).join('') + '</div>',
      body: '<div id="feed">' + P.loadingLines(5) + '</div>'
    });

    content.addEventListener('click', function (e) {
      var k = e.target.closest('[data-kind]');
      if (!k) return;
      filter = k.getAttribute('data-kind');
      content.querySelectorAll('[data-kind]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === k));
      });
      render();
    });

    PortalAuth.client().from('updates').select('*').eq('published', true)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .then(function (r) {
        if (r.error) { document.getElementById('feed').innerHTML = P.failed(r.error.message); return; }
        all = r.data || [];
        render();
      });
  });
})();
