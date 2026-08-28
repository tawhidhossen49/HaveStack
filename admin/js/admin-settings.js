/* settings: Settings */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("settings.html", 'Settings', 'Practice details, form behaviour and access.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('This panel is the interface only. Saving is not wired up, so the fields below hold '
      + 'their current values from the public site and nothing is written anywhere.') +
    A.panel({
      title: 'Practice details',
      note: 'Used in the footer, the structured data and the request page.',
      body: '<div class="field-row">' +
        '<div class="field"><label for="s-name">Practice name</label>' +
        '<input id="s-name" type="text" value="HaveStack Technologies" /></div>' +
        '<div class="field"><label for="s-email">Contact address</label>' +
        '<input id="s-email" type="email" value="hello@havestack.tech" /></div>' +
        '<div class="field"><label for="s-city">Base</label>' +
        '<input id="s-city" type="text" value="Dhaka, Bangladesh" /></div>' +
        '<div class="field"><label for="s-domain">Live domain</label>' +
        '<input id="s-domain" type="url" value="https://havestack.tech/" />' +
        '<span class="hint">Used for the canonical tag and the social card.</span></div>' +
        '<div class="field full"><label for="s-desc">Description</label>' +
        '<textarea id="s-desc">Enterprise software built, integrated and maintained for institutions in Bangladesh.</textarea></div>' +
      '</div>',
      foot: '<button class="btn btn-sm" type="button">Discard</button>' +
            '<button class="btn btn-key btn-sm" type="button" data-stub="Saving is not wired up yet.">Save changes</button>'
    }) +
    A.panel({
      title: 'Request form',
      note: 'Where submitted briefs are delivered.',
      body: '<div class="field-row">' +
        '<div class="field"><label for="s-reply">Reply target, working days</label>' +
        '<input id="s-reply" type="number" value="2" min="1" /></div>' +
        '<div class="field"><label for="s-len">Meeting length, minutes</label>' +
        '<input id="s-len" type="number" value="40" min="10" /></div>' +
      '</div>',
      foot: '<button class="btn btn-key btn-sm" type="button" data-stub="Saving is not wired up yet.">Save changes</button>'
    }) +
    A.panel({
      title: 'Access',
      note: 'Addresses allowed to sign in. Anyone not listed is refused after Google confirms who they are.',
      flush: true,
      actions: '<button class="btn btn-key btn-sm" type="button" id="addAdmin">' + A.svg(A.I.plus, 14) + 'Add address</button>',
      body: '<div id="adminList">' + A.empty('Loading', 'Reading the admin list.') + '</div>'
    });

    /* ---- the access list -------------------------------------------------
       The only part of this panel wired to real data. Adding an address here
       is what lets somebody else sign in; the row level security policy on
       public.admins is what makes it stick. */
    var box = document.getElementById('adminList');

    function render(rows, me) {
      if (!rows.length) {
        box.innerHTML = A.empty('Nobody listed', 'Add an address to let someone sign in.');
        return;
      }
      box.innerHTML = A.table(['Address', 'Name', 'Added', ''], rows.map(function (r) {
        var self = r.email === me;
        return '<tr>' +
          '<td>' + A.escapeHtml(r.email) + (self ? ' <span class="tag tag-live">you</span>' : '') + '</td>' +
          '<td>' + A.escapeHtml(r.full_name || '') + '</td>' +
          '<td class="num">' + A.escapeHtml((r.added_at || '').slice(0, 10)) + '</td>' +
          '<td><div class="row-actions" style="justify-content:flex-end">' +
            (self ? '<span class="tag tag-draft">cannot remove yourself</span>'
                  : '<button class="btn btn-sm btn-danger" type="button" data-remove="' +
                    A.escapeHtml(r.email) + '">Remove</button>') +
          '</div></td></tr>';
      }).join(''));
    }

    function load() {
      var c = AdminAuth.client();
      var me = (admin && admin.email) || '';
      return c.from('admins').select('email,full_name,added_at').order('added_at')
        .then(function (res) {
          if (res.error) {
            box.innerHTML = A.empty('Could not read the list', res.error.message);
            return;
          }
          render(res.data || [], me);
        });
    }

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (!btn) return;
      var email = btn.getAttribute('data-remove');
      if (!window.confirm('Remove ' + email + '? They will not be able to sign in.')) return;
      btn.disabled = true;
      AdminAuth.client().from('admins').delete().eq('email', email).then(function (res) {
        if (res.error) { A.toast(res.error.message, true); btn.disabled = false; return; }
        A.toast('Removed ' + email);
        load();
      });
    });

    document.getElementById('addAdmin').addEventListener('click', function () {
      var email = (window.prompt('Address to allow, for example someone@gmail.com') || '').trim().toLowerCase();
      if (!email) return;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { A.toast('That does not look like an address.', true); return; }
      var name = (window.prompt('Their name, optional') || '').trim();
      AdminAuth.client().from('admins')
        .insert({ email: email, full_name: name || null, added_by: (admin && admin.email) || null })
        .then(function (res) {
          if (res.error) { A.toast(res.error.message, true); return; }
          A.toast('Added ' + email);
          load();
        });
    });

    load();
  });
})();
