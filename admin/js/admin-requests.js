/* requests: Meeting requests */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("requests.html", 'Meeting requests', 'Briefs submitted through the request page.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('Briefs submitted through the public request form. They arrive here on their own; there is nothing to add by hand.') + A.panel({ title: 'All requests', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" id="q" placeholder="Search" aria-label="Search requests" />' + '</div>', body: '<div id="list">' + A.empty('Loading', 'Reading submitted briefs.') + '</div>' });

    var box = document.getElementById('list');
    var all = [];

    function when(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return isNaN(d) ? '' : d.toISOString().slice(0, 10);
    }

    function render(list) {
      if (!all.length) {
        box.innerHTML = A.empty('No requests yet',
          'When somebody submits the form on the request page, their brief appears here with its reference.');
        return;
      }
      if (!list.length) {
        box.innerHTML = A.empty('Nothing matches', 'No request matches what you typed.');
        return;
      }
      box.innerHTML = A.table(['Reference', 'Organisation', 'Sector', 'Contact', 'Received', ''],
        list.map(function (r) {
          return '<tr>' +
            '<td class="num">' + A.escapeHtml(r.reference || '') + '</td>' +
            '<td>' + A.escapeHtml(r.organisation || '') + '</td>' +
            '<td>' + A.escapeHtml(r.sector || '') + '</td>' +
            '<td>' + A.escapeHtml(r.full_name || '') +
              (r.email ? '<br /><a href="mailto:' + A.escapeHtml(r.email) + '">' +
                          A.escapeHtml(r.email) + '</a>' : '') + '</td>' +
            '<td class="num">' + A.escapeHtml(when(r.created_at)) + '</td>' +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-open="' + A.escapeHtml(r.reference || '') + '">Read</button>' +
            '</div></td></tr>';
        }).join(''));
    }

    function filter() {
      var q = (document.getElementById('q').value || '').trim().toLowerCase();
      if (!q) { render(all); return; }
      render(all.filter(function (r) {
        return ['reference','organisation','sector','full_name','email','brief']
          .some(function (k) { return String(r[k] || '').toLowerCase().indexOf(q) > -1; });
      }));
    }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (!b) return;
      var ref = b.getAttribute('data-open');
      var r = all.filter(function (x) { return x.reference === ref; })[0];
      if (!r) return;
      A.modal({
        title: r.organisation || 'Request',
        note: (r.reference || '') + '   received ' + when(r.created_at),
        confirm: 'Close',
        fields: [
          { name: 'who',    label: 'From',    value: (r.full_name || '') + (r.role ? ', ' + r.role : ''), readonly: true },
          { name: 'email',  label: 'Email',   value: r.email || '', readonly: true },
          { name: 'owner',  label: 'Named owner',     value: r.named_owner || '', readonly: true },
          { name: 'system', label: 'System required', value: r.system_required || '', readonly: true },
          { name: 'start',  label: 'Intended start',  value: r.intended_start || '', readonly: true },
          { name: 'brief',  label: 'Requirement',     value: r.brief || '', readonly: true,
            multiline: true, rows: 8 }
        ]
      });
    });

    document.getElementById('q').addEventListener('input', filter);

    A.rows('meeting_requests', 'created_at').then(function (res) {
      if (res.error) { box.innerHTML = A.failed(res.error); return; }
      all = res.data.slice().reverse();   // newest first
      render(all);
    });
  });
})();
