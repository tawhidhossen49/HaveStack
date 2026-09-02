/* partners: Clients and partners */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("partners.html", 'Clients and partners', 'The marks shown in the two registers.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('These are the marks in the Clients and Partners rows on the public site. Upload the image into the assets folder first, then point a row at it.') + A.panel({ title: 'Marks', flush: true, actions: '<button class="btn btn-key btn-sm" type="button" id="add">' + A.svg(A.I.plus, 14) + 'Add organisation</button>', body: '<div id="list">' + A.empty('Loading', 'Reading the registers.') + '</div>' });

    var box = document.getElementById('list');

    function fields(o) {
      o = o || {};
      return [
        { name: 'name', label: 'Organisation', value: o.name || '' },
        { name: 'register', label: 'Register', value: o.register || 'partner',
          options: [{ value: 'client', label: 'Client' }, { value: 'partner', label: 'Partner' }] },
        { name: 'mark', label: 'Mark', value: o.mark || 'assets/',
          hint: 'Path to the image, for example assets/mark-acme.png' },
        { name: 'mark_w', label: 'Image width', type: 'number', value: (o.mark_w == null ? 160 : o.mark_w) },
        { name: 'mark_h', label: 'Image height', type: 'number', value: (o.mark_h == null ? 160 : o.mark_h),
          hint: 'The real pixel size, so the row reserves the right space.' },
        { name: 'sort', label: 'Order', type: 'number', value: (o.sort == null ? 50 : o.sort) }
      ];
    }

    function clean(v) {
      var reg = (v.register || '').trim().toLowerCase();
      var mark = (v.mark || '').trim();
      if (!(v.name || '').trim()) return { error: 'Give it a name.' };
      if (reg !== 'client' && reg !== 'partner') return { error: 'Register must be client or partner.' };
      if (!/^[A-Za-z0-9._\/-]+\.(png|jpg|jpeg|svg|webp)$/.test(mark)) {
        return { error: 'The mark must be a path to an image file, like assets/mark-acme.png' };
      }
      return { row: {
        name: v.name.trim(), register: reg, mark: mark,
        mark_w: parseInt(v.mark_w, 10) || 160,
        mark_h: parseInt(v.mark_h, 10) || 160,
        sort: parseInt(v.sort, 10) || 0
      } };
    }

    function render(list) {
      if (!list.length) {
        box.innerHTML = A.empty('Nothing listed', 'Add an organisation and its mark appears on the site.');
        return;
      }
      box.innerHTML = A.table(['Organisation', 'Register', 'Mark', 'Order', 'State', ''],
        list.map(function (o) {
          return '<tr>' +
            '<td>' + A.escapeHtml(o.name) + '</td>' +
            '<td>' + A.escapeHtml(o.register) + '</td>' +
            '<td><code style="font-size:12.5px">' + A.escapeHtml(o.mark) + '</code></td>' +
            '<td class="num">' + o.sort + '</td>' +
            '<td>' + (o.published ? '<span class="tag tag-live">live</span>'
                                  : '<span class="tag tag-draft">hidden</span>') + '</td>' +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-edit="' + o.id + '">Edit</button>' +
              '<button class="btn btn-sm" type="button" data-toggle="' + o.id + '">' +
                (o.published ? 'Hide' : 'Publish') + '</button>' +
              '<button class="btn btn-sm btn-danger" type="button" data-del="' + o.id + '">Delete</button>' +
            '</div></td></tr>';
        }).join(''));
    }

    var cache = [];
    function load() {
      return A.rows('organisations').then(function (r) {
        if (r.error) { box.innerHTML = A.failed(r.error); return; }
        cache = r.data; render(cache);
      });
    }

    box.addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]'),
          tg = e.target.closest('[data-toggle]'),
          dl = e.target.closest('[data-del]');

      if (ed) {
        var o = cache.filter(function (x) { return x.id === ed.getAttribute('data-edit'); })[0];
        if (!o) return;
        A.modal({ title: 'Edit organisation', confirm: 'Save', fields: fields(o),
          validate: function (v) { return clean(v).error || null; } }).then(function (v) {
          if (!v) return;
          var c = clean(v);
          if (c.error) { A.toast(c.error, true); return; }
          A.update('organisations', o.id, c.row).then(function (r) {
            if (r.error) { A.toast(r.error, true); return; }
            A.toast('Saved. The public page shows it on its next load.'); load();
          });
        });
        return;
      }
      if (tg) {
        var q = cache.filter(function (x) { return x.id === tg.getAttribute('data-toggle'); })[0];
        if (!q) return;
        tg.disabled = true;
        A.update('organisations', q.id, { published: !q.published }).then(function (r) {
          if (r.error) { A.toast(r.error, true); tg.disabled = false; return; }
          A.toast(q.published ? 'Hidden from the site' : 'Now live on the site'); load();
        });
        return;
      }
      if (dl) {
        var id = dl.getAttribute('data-del');
        var d = cache.filter(function (x) { return x.id === id; })[0];
        if (!window.confirm('Delete ' + (d ? d.name : 'this') + '? This cannot be undone.')) return;
        dl.disabled = true;
        A.remove('organisations', id).then(function (r) {
          if (r.error) { A.toast(r.error, true); dl.disabled = false; return; }
          A.toast('Deleted'); load();
        });
      }
    });

    document.getElementById('add').addEventListener('click', function () {
      A.modal({ title: 'Add an organisation', confirm: 'Add', fields: fields(null),
          validate: function (v) { return clean(v).error || null; } }).then(function (v) {
        if (!v) return;
        var c = clean(v);
        if (c.error) { A.toast(c.error, true); return; }
        A.insert('organisations', c.row).then(function (r) {
          if (r.error) { A.toast(r.error, true); return; }
          A.toast('Added. It is on the public page now.'); load();
        });
      });
    });

    load();
  });
})();
