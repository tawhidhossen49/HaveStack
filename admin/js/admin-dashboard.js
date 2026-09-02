/* dashboard: Dashboard */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("index.html", 'Dashboard', 'An overview of the site and what needs attention.', null, admin);
    if (!content) return;
    content.innerHTML = '<div class="stats" id="stats">' +
      [['requests','Meeting requests'],['products','Products'],
       ['orgs','Clients and partners'],['admins','Admins']]
        .map(function (x) {
          return '<div class="stat">' +
            '<div class="label">' + x[1] + '</div>' +
            '<div class="value" id="n-' + x[0] + '">&#8212;</div>' +
            '<div class="sub" id="s-' + x[0] + '">Counting</div>' +
          '</div>';
        }).join('') +
    '</div>' +
    A.panel({
      title: 'Quick actions',
      note: 'The things you will reach for most.',
      body: '<div class="row-actions">' +
        [['requests.html', 'Meeting requests'],
         ['products.html', 'Products'],
         ['partners.html', 'Clients and partners'],
         ['media.html', 'Media library'],
         ['settings.html', 'Settings']]
        .map(function (x) { return '<a class="btn btn-sm" href="' + x[0] + '">' + x[1] + '</a>'; })
        .join('') + '</div>'
    }) +
    A.panel({
      title: 'Latest requests',
      note: 'The five most recent briefs. Open the requests page to read one.',
      flush: true,
      body: '<div id="latest">' + A.empty('Loading', 'Reading submitted briefs.') + '</div>'
    });

    /* ---- real counts -----------------------------------------------------
       head:true asks Postgres to count without sending rows, so a table with
       ten thousand requests costs the same as one with three. Reading
       data.length instead would both transfer everything and silently cap at
       PostgREST's row limit. */
    function count(table, el, sub) {
      return AdminAuth.client().from(table).select('*', { count: 'exact', head: true })
        .then(function (r) {
          var n = document.getElementById('n-' + el), t = document.getElementById('s-' + el);
          if (r.error) { n.textContent = '?'; t.textContent = 'Not readable'; return null; }
          n.textContent = r.count == null ? '0' : String(r.count);
          if (t && sub) t.textContent = sub;
          return r.count;
        });
    }

    count('meeting_requests', 'requests', 'Submitted through the site');
    count('products',      'products', 'On the public index');
    count('organisations', 'orgs',     'Across both registers');
    count('admins',        'admins',   'Can sign in here');

    /* ---- the five most recent briefs ------------------------------------- */
    var latest = document.getElementById('latest');
    AdminAuth.client().from('meeting_requests')
      .select('reference,organisation,sector,created_at')
      .order('created_at', { ascending: false }).limit(5)
      .then(function (r) {
        if (r.error) { latest.innerHTML = A.failed(r.error.message); return; }
        var list = r.data || [];
        if (!list.length) {
          latest.innerHTML = A.empty('No requests yet',
            'When somebody submits the form on the request page, it appears here.');
          return;
        }
        latest.innerHTML = A.table(['Reference', 'Organisation', 'Sector', 'Received'],
          list.map(function (x) {
            var d = new Date(x.created_at);
            return '<tr>' +
              '<td class="num">' + A.escapeHtml(x.reference || '') + '</td>' +
              '<td>' + A.escapeHtml(x.organisation || '') + '</td>' +
              '<td>' + A.escapeHtml(x.sector || '') + '</td>' +
              '<td class="num">' + (isNaN(d) ? '' : d.toISOString().slice(0, 10)) + '</td>' +
            '</tr>';
          }).join(''));
      });
  });
})();
