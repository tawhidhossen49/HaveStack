/* products: Products */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("products.html", 'Products', 'Software the practice runs itself.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('These rows are the Products index on the public site. A change here shows up on the next page load, and a row that is not published is not sent to visitors at all.') + A.panel({ title: 'Product index', flush: true, actions: '<button class="btn btn-key btn-sm" type="button" id="add">' + A.svg(A.I.plus, 14) + 'Add product</button>', body: '<div id="list">' + A.empty('Loading', 'Reading the index.') + '</div>' });

    var box = document.getElementById('list');
    var ICONS = ['i-database','i-graduation-cap','i-globe-hemisphere-west','i-plugs-connected',
                 'i-gauge','i-cpu','i-hard-drives','i-brain','i-code','i-list'];

    function fields(p) {
      p = p || {};
      return [
        { name: 'name',  label: 'Name',  value: p.name || '' },
        { name: 'blurb', label: 'One line', value: p.blurb || '' },
        { name: 'icon',  label: 'Icon', value: p.icon || 'i-database',
          options: ICONS.map(function (i) { return { value: i, label: i.slice(2).replace(/-/g, ' ') }; }) },
        { name: 'link',  label: 'Link', type: 'url', value: p.link || '',
          hint: 'Leave empty and the row shows the state label instead.' },
        { name: 'state_label', label: 'State label', value: p.state_label || 'Not yet public' },
        { name: 'sort',  label: 'Order', type: 'number', value: (p.sort == null ? 50 : p.sort),
          hint: 'Lower numbers come first.' }
      ];
    }

    function clean(v) {
      var link = (v.link || '').trim();
      var icon = (v.icon || '').trim() || 'i-database';
      if (!/^i-[a-z-]+$/.test(icon)) return { error: 'Icon must look like i-database.' };
      if (link && !/^https?:\/\//.test(link)) return { error: 'A link must start with http:// or https://' };
      if (!(v.name || '').trim()) return { error: 'Give it a name.' };
      return { row: {
        name: v.name.trim(),
        blurb: (v.blurb || '').trim(),
        icon: icon,
        link: link || null,
        state_label: (v.state_label || '').trim() || 'Not yet public',
        sort: parseInt(v.sort, 10) || 0
      } };
    }

    function render(list) {
      if (!list.length) {
        box.innerHTML = A.empty('No products yet', 'Add one and it appears on the public index.');
        return;
      }
      box.innerHTML = A.table(['Product', 'One line', 'Shows as', 'Order', 'State', ''],
        list.map(function (p) {
          return '<tr>' +
            '<td>' + A.escapeHtml(p.name) + '</td>' +
            '<td>' + A.escapeHtml(p.blurb) + '</td>' +
            '<td>' + (p.link ? '<a href="' + A.escapeHtml(p.link) + '" target="_blank" rel="noopener">link</a>'
                             : A.escapeHtml(p.state_label)) + '</td>' +
            '<td class="num">' + p.sort + '</td>' +
            '<td>' + (p.published ? '<span class="tag tag-live">live</span>'
                                  : '<span class="tag tag-draft">hidden</span>') + '</td>' +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-edit="' + p.id + '">Edit</button>' +
              '<button class="btn btn-sm" type="button" data-toggle="' + p.id + '">' +
                (p.published ? 'Hide' : 'Publish') + '</button>' +
              '<button class="btn btn-sm btn-danger" type="button" data-del="' + p.id + '">Delete</button>' +
            '</div></td></tr>';
        }).join(''));
    }

    var cache = [];
    function load() {
      return A.rows('products').then(function (r) {
        if (r.error) { box.innerHTML = A.failed(r.error); return; }
        cache = r.data;
        render(cache);
      });
    }

    box.addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]'),
          tg = e.target.closest('[data-toggle]'),
          dl = e.target.closest('[data-del]');

      if (ed) {
        var p = cache.filter(function (x) { return x.id === ed.getAttribute('data-edit'); })[0];
        if (!p) return;
        A.modal({ title: 'Edit product', confirm: 'Save', fields: fields(p),
          validate: function (v) { return clean(v).error || null; } }).then(function (v) {
          if (!v) return;
          var c = clean(v);
          if (c.error) { A.toast(c.error, true); return; }
          A.update('products', p.id, c.row).then(function (r) {
            if (r.error) { A.toast(r.error, true); return; }
            A.toast('Saved. The public page shows it on its next load.');
            load();
          });
        });
        return;
      }

      if (tg) {
        var q = cache.filter(function (x) { return x.id === tg.getAttribute('data-toggle'); })[0];
        if (!q) return;
        tg.disabled = true;
        A.update('products', q.id, { published: !q.published }).then(function (r) {
          if (r.error) { A.toast(r.error, true); tg.disabled = false; return; }
          A.toast(q.published ? 'Hidden from the site' : 'Now live on the site');
          load();
        });
        return;
      }

      if (dl) {
        var id = dl.getAttribute('data-del');
        var d = cache.filter(function (x) { return x.id === id; })[0];
        if (!window.confirm('Delete ' + (d ? d.name : 'this') + '? This cannot be undone.')) return;
        dl.disabled = true;
        A.remove('products', id).then(function (r) {
          if (r.error) { A.toast(r.error, true); dl.disabled = false; return; }
          A.toast('Deleted');
          load();
        });
      }
    });

    document.getElementById('add').addEventListener('click', function () {
      A.modal({ title: 'Add a product', confirm: 'Add', fields: fields(null),
          validate: function (v) { return clean(v).error || null; } }).then(function (v) {
        if (!v) return;
        var c = clean(v);
        if (c.error) { A.toast(c.error, true); return; }
        A.insert('products', c.row).then(function (r) {
          if (r.error) { A.toast(r.error, true); return; }
          A.toast('Added. It is on the public index now.');
          load();
        });
      });
    });

    load();
  });
})();
