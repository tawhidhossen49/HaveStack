/* section: Section */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("section.html", 'Section', 'Loading.', null, admin);
    if (!content) return;
    content.innerHTML = '<div id="editor">' + A.panel({ title: 'Loading', body: A.empty('Loading', 'Reading this section.') }) + '</div>';

    var KEY = new URLSearchParams(location.search).get('key') || '';
    var box = document.getElementById('editor');
    var sec = null, items = [];

    var ICONS = ['i-buildings','i-squares-four','i-seal-check','i-scales','i-users-three',
                 'i-database','i-graduation-cap','i-globe-hemisphere-west','i-plugs-connected',
                 'i-gauge','i-cpu','i-hard-drives','i-brain','i-code','i-list','i-file-text',
                 'i-magnifying-glass','i-compass-tool','i-handshake','i-pulse','i-shield',
                 'i-lock-key','i-key','i-clock-counter-clockwise'];

    /* Each section calls its rows something different and shows different
       parts of them. One description per section keeps the editor honest
       about what it is editing without needing a page each. */
    var SHAPE = {
      about:       { fields: ['icon', 'title', 'body'] },
      services:    { fields: ['meta', 'title', 'body', 'bullets', 'image'],
                     labels: { meta: 'Tab label', bullets: 'Tags', image: 'Panel image' } },
      maintenance: { fields: ['icon', 'title', 'bullets', 'link'],
                     labels: { bullets: 'What is covered', link: 'Learn more page' } },
      sectors:     { fields: ['title', 'body', 'image'] },
      process:     { fields: ['icon', 'title', 'body', 'meta'],
                     labels: { meta: 'What this stage produces' } },
      standards:   { fields: ['icon', 'title', 'bullets'],
                     labels: { bullets: 'Commitments' } },
      clients:     { fields: ['title', 'body', 'meta'],
                     labels: { title: 'Name', body: 'Detail', meta: 'Role' } }
    };

    function shape() { return SHAPE[KEY] || { fields: ['icon', 'title', 'body'] }; }
    function labelFor(f) {
      var l = (shape().labels || {})[f];
      if (l) return l;
      return { icon: 'Icon', title: 'Heading', body: 'Text', bullets: 'List',
               link: 'Link', image: 'Image', meta: 'Detail' }[f] || f;
    }

    function fieldsFor(it) {
      it = it || {};
      return shape().fields.map(function (f) {
        if (f === 'icon') {
          return { name: 'icon', label: 'Icon', value: it.icon || ICONS[0],
                   options: ICONS.map(function (i) {
                     return { value: i, label: i.slice(2).replace(/-/g, ' ') }; }) };
        }
        if (f === 'bullets') {
          return { name: 'bullets', label: labelFor('bullets'), multiline: true, rows: 5,
                   value: (it.bullets || []).join('\n'),
                   hint: 'One per line.' };
        }
        if (f === 'body') {
          return { name: 'body', label: labelFor('body'), multiline: true, rows: 3,
                   value: it.body || '' };
        }
        return { name: f, label: labelFor(f), value: it[f] || '' };
      });
    }

    function collect(v) {
      var row = { section_key: KEY };
      shape().fields.forEach(function (f) {
        if (f === 'bullets') {
          row.bullets = String(v.bullets || '').split('\n')
            .map(function (x) { return x.trim(); }).filter(Boolean);
        } else {
          row[f] = String(v[f] == null ? '' : v[f]).trim();
        }
      });
      return row;
    }

    function validate(v) {
      if (shape().fields.indexOf('title') > -1 && !String(v.title || '').trim()) {
        return 'Give it a heading.';
      }
      if (v.link && !/^([a-z0-9-]+\.html|https?:\/\/)/.test(v.link)) {
        return 'A link should be a page on this site, like maintenance-ai.html, ' +
               'or a full address starting http.';
      }
      if (v.image && !/^[A-Za-z0-9._\/-]+\.(png|jpg|jpeg|svg|webp)$/.test(v.image)) {
        return 'An image should be a path like assets/sector-education.jpg';
      }
      return null;
    }

    function preview(it) {
      var bits = [];
      if (it.body) bits.push(A.escapeHtml(it.body));
      if ((it.bullets || []).length) {
        bits.push('<span class="muted">' + it.bullets.length + ' listed</span>');
      }
      if (it.link) bits.push('<span class="muted">' + A.escapeHtml(it.link) + '</span>');
      return bits.join('<br />') || '<span class="muted">—</span>';
    }

    function render() {
      var noun = sec.item_noun || 'item';
      var head = A.panel({
        title: 'Heading and intro',
        note: 'The words at the top of this section on the public page.',
        body:
          '<div class="field"><label for="f-kicker">Kicker</label>' +
            '<input id="f-kicker" type="text" value="' + A.escapeHtml(sec.kicker || '') + '" />' +
            '<span class="hint">The small line above the heading. Leave empty for none.</span></div>' +
          '<div class="field"><label for="f-heading">Heading</label>' +
            '<input id="f-heading" type="text" value="' + A.escapeHtml(sec.heading || '') + '" /></div>' +
          '<div class="field"><label for="f-intro">Intro</label>' +
            '<input id="f-intro" type="text" value="' + A.escapeHtml(sec.intro || '') + '" /></div>' +
          (sec.key === 'about'
            ? '<div class="field"><label for="f-note">Closing note</label>' +
              '<textarea id="f-note" rows="3">' + A.escapeHtml(sec.note || '') + '</textarea></div>'
            : '') +
          '<div class="field"><label for="f-nav">Menu label</label>' +
            '<input id="f-nav" type="text" value="' + A.escapeHtml(sec.nav_label || '') + '" />' +
            '<span class="hint">What the link in the menu says. Empty means this ' +
            'section is not linked from the menu at all.</span></div>',
        foot: '<button class="btn btn-key btn-sm" type="button" id="saveHead">Save</button>'
      });

      var list;
      if (!shape().fields.length) {
        list = '';
      } else if (!items.length) {
        list = A.panel({
          title: 'Contents',
          flush: true,
          actions: '<button class="btn btn-key btn-sm" type="button" id="add">' +
            A.svg(A.I.plus, 14) + 'Add ' + A.escapeHtml(noun) + '</button>',
          body: A.empty('Nothing here yet',
            'Add the first ' + noun + ' and it appears in this section on the public page.')
        });
      } else {
        list = A.panel({
          title: 'Contents',
          note: 'These are the ' + noun + 's inside this section, in the order shown.',
          flush: true,
          actions: '<button class="btn btn-key btn-sm" type="button" id="add">' +
            A.svg(A.I.plus, 14) + 'Add ' + A.escapeHtml(noun) + '</button>',
          body: A.table(['Order', A.escapeHtml(noun.charAt(0).toUpperCase() + noun.slice(1)),
                         'Detail', 'On the page', ''],
            items.map(function (it, i) {
              return '<tr' + (it.published ? '' : ' class="is-off"') + '>' +
                '<td><div class="row-actions">' +
                  '<button class="icon-btn" type="button" data-up="' + it.id + '"' +
                    (i === 0 ? ' disabled' : '') + ' aria-label="Move up">&#8593;</button>' +
                  '<button class="icon-btn" type="button" data-down="' + it.id + '"' +
                    (i === items.length - 1 ? ' disabled' : '') + ' aria-label="Move down">&#8595;</button>' +
                '</div></td>' +
                '<td><b>' + A.escapeHtml(it.title) + '</b>' +
                  (it.icon ? '<div class="row-note">' + A.escapeHtml(it.icon) + '</div>' : '') + '</td>' +
                '<td>' + preview(it) + '</td>' +
                '<td>' + (it.published ? '<span class="tag tag-live">shown</span>'
                                       : '<span class="tag tag-draft">hidden</span>') + '</td>' +
                '<td><div class="row-actions" style="justify-content:flex-end">' +
                  '<button class="btn btn-sm" type="button" data-edit="' + it.id + '">Edit</button>' +
                  '<button class="btn btn-sm" type="button" data-toggle="' + it.id + '">' +
                    (it.published ? 'Hide' : 'Show') + '</button>' +
                  '<button class="btn btn-sm btn-danger" type="button" data-del="' + it.id + '">Delete</button>' +
                '</div></td>' +
              '</tr>';
            }).join(''))
        });
      }

      box.innerHTML =
        (sec.visible ? '' : A.notice('This whole section is currently hidden from the ' +
          'public page, so none of the changes below are visible to anyone yet. ' +
          'Turn it back on from Page sections.')) +
        head + list;
    }

    function load() {
      return Promise.all([
        AdminAuth.client().from('site_sections').select('*').eq('key', KEY).maybeSingle()
          .then(function (r) { return r; }),
        AdminAuth.client().from('section_items').select('*').eq('section_key', KEY)
          .order('sort').then(function (r) { return r; })
      ]).then(function (res) {
        if (res[0].error || !res[0].data) {
          box.innerHTML = A.failed('No section called "' + KEY + '" exists.');
          return;
        }
        sec = res[0].data;
        items = res[1].error ? [] : (res[1].data || []);
        document.querySelector('.topbar h1').textContent = sec.label;
        document.querySelector('.topbar p').textContent =
          'The "' + (sec.heading || sec.label) + '" section of the public page.';
        render();
      });
    }

    function saveItem(id, row, said) {
      var q = id
        ? AdminAuth.client().from('section_items').update(row).eq('id', id)
        : AdminAuth.client().from('section_items')
            .insert(Object.assign({ sort: (items.length + 1) * 10 }, row));
      return q.then(function (r) {
        if (r.error) { A.toast(r.error.message, true); return; }
        A.toast(said);
        load();
      });
    }

    box.addEventListener('click', function (e) {
      var t = e.target;

      if (t.closest('#saveHead')) {
        var patch = {
          kicker: document.getElementById('f-kicker').value.trim(),
          heading: document.getElementById('f-heading').value.trim(),
          intro: document.getElementById('f-intro').value.trim(),
          nav_label: document.getElementById('f-nav').value.trim()
        };
        var noteEl = document.getElementById('f-note');
        if (noteEl) patch.note = noteEl.value.trim();
        // an empty menu label and "not in the menu" are the same statement
        patch.in_nav = !!patch.nav_label;
        AdminAuth.client().from('site_sections').update(patch).eq('key', KEY)
          .then(function (r) {
            if (r.error) { A.toast(r.error.message, true); return; }
            A.toast('Saved. The public page shows it on its next load.');
            load();
          });
        return;
      }

      if (t.closest('#add')) {
        A.modal({ title: 'Add a ' + (sec.item_noun || 'item'), confirm: 'Add',
                  fields: fieldsFor(null), validate: validate })
          .then(function (v) { if (v) saveItem(null, collect(v), 'Added.'); });
        return;
      }

      var ed = t.closest('[data-edit]');
      if (ed) {
        var it = items.filter(function (x) { return x.id === ed.getAttribute('data-edit'); })[0];
        if (!it) return;
        A.modal({ title: 'Edit', confirm: 'Save',
                  fields: fieldsFor(it), validate: validate })
          .then(function (v) { if (v) saveItem(it.id, collect(v), 'Saved.'); });
        return;
      }

      var tg = t.closest('[data-toggle]');
      if (tg) {
        var q = items.filter(function (x) { return x.id === tg.getAttribute('data-toggle'); })[0];
        if (!q) return;
        tg.disabled = true;
        AdminAuth.client().from('section_items')
          .update({ published: !q.published }).eq('id', q.id)
          .then(function (r) {
            if (r.error) { A.toast(r.error.message, true); tg.disabled = false; return; }
            A.toast(q.published ? 'Hidden from the page.' : 'Back on the page.');
            load();
          });
        return;
      }

      var dl = t.closest('[data-del]');
      if (dl) {
        var d = items.filter(function (x) { return x.id === dl.getAttribute('data-del'); })[0];
        if (!d) return;
        if (!window.confirm('Delete "' + d.title + '"? This cannot be undone. ' +
                            'If you only want it off the page for now, use Hide instead.')) return;
        dl.disabled = true;
        AdminAuth.client().from('section_items').delete().eq('id', d.id)
          .then(function (r) {
            if (r.error) { A.toast(r.error.message, true); dl.disabled = false; return; }
            A.toast('Deleted.'); load();
          });
        return;
      }

      /* Order is a number in the database, but nobody wants to type numbers to
         reorder a list of four things. Swapping the two rows' sort values is
         what an arrow means. */
      var up = t.closest('[data-up]'), down = t.closest('[data-down]');
      if (up || down) {
        var id = (up || down).getAttribute(up ? 'data-up' : 'data-down');
        var i = -1;
        items.forEach(function (x, n) { if (x.id === id) i = n; });
        var j = up ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= items.length) return;
        var a = items[i], b = items[j];
        (up || down).disabled = true;
        Promise.all([
          AdminAuth.client().from('section_items').update({ sort: b.sort }).eq('id', a.id),
          AdminAuth.client().from('section_items').update({ sort: a.sort }).eq('id', b.id)
        ]).then(function () { load(); });
      }
    });

    if (!KEY) {
      box.innerHTML = A.failed('No section was named in the address.');
    } else {
      load();
    }
  });
})();
