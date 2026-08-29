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
      note: 'Everyone who can sign in. Adding somebody here creates their account with the password you choose and puts them on the list, in one step.',
      flush: true,
      actions: '<button class="btn btn-key btn-sm" type="button" id="addAdmin">' + A.svg(A.I.plus, 14) + 'Add admin</button>',
      body: '<div id="adminList">' + A.empty('Loading', 'Reading the admin list.') + '</div>'
    });

    /* ---- the access list -------------------------------------------------
       The one part of this panel wired to real data.

       Creating an account with a chosen password needs the service role key,
       and that key must never reach a browser. So the panel does not do it:
       it asks the admin-users edge function, which holds the key server side
       and checks the caller is on the admin list before it acts. */
    var box = document.getElementById('adminList');
    var FN = (window.SITE_CONFIG && SITE_CONFIG.supabaseUrl || '') + '/functions/v1/admin-users';

    function callFn(payload) {
      return AdminAuth.client().auth.getSession().then(function (r) {
        var token = r.data && r.data.session && r.data.session.access_token;
        if (!token) return { error: 'Your session expired. Sign in again.' };
        return fetch(FN, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'apikey': SITE_CONFIG.supabaseKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (res) {
          return res.json().then(function (b) { return res.ok ? b : { error: b.error || ('HTTP ' + res.status) }; });
        }).catch(function (e) {
          return { error: 'Could not reach the server. ' + (e.message || e) };
        });
      });
    }

    function render(rows, me) {
      if (!rows.length) {
        box.innerHTML = A.empty('Nobody listed', 'Add an admin to let someone sign in.');
        return;
      }
      box.innerHTML = A.table(['Address', 'Name', 'Added', ''], rows.map(function (r) {
        var self = r.email === me;
        return '<tr>' +
          '<td>' + A.escapeHtml(r.email) + (self ? ' <span class="tag tag-live">you</span>' : '') + '</td>' +
          '<td>' + A.escapeHtml(r.full_name || '') + '</td>' +
          '<td class="num">' + A.escapeHtml((r.added_at || '').slice(0, 10)) + '</td>' +
          '<td><div class="row-actions" style="justify-content:flex-end">' +
            '<button class="btn btn-sm" type="button" data-pw="' + A.escapeHtml(r.email) + '">Set password</button>' +
            (self ? '<span class="tag tag-draft">cannot remove yourself</span>'
                  : '<button class="btn btn-sm btn-danger" type="button" data-remove="' +
                    A.escapeHtml(r.email) + '">Remove</button>') +
          '</div></td></tr>';
      }).join(''));
    }

    function load() {
      var me = (admin && admin.email) || '';
      return AdminAuth.client()
        .from('admins').select('email,full_name,added_at').order('added_at')
        .then(function (res) {
          if (res.error) { box.innerHTML = A.empty('Could not read the list', res.error.message); return; }
          render(res.data || [], me);
        });
    }

    box.addEventListener('click', function (e) {
      var pwBtn = e.target.closest('[data-pw]');
      var rmBtn = e.target.closest('[data-remove]');

      if (pwBtn) {
        var addr = pwBtn.getAttribute('data-pw');
        A.modal({
          title: 'Set a new password',
          note: 'They will use this the next time they sign in. Tell it to them yourself; nothing is emailed.',
          confirm: 'Set password',
          fields: [
            { name: 'email', label: 'Address', value: addr, readonly: true },
            { name: 'password', label: 'New password', type: 'password',
              autocomplete: 'new-password', hint: 'At least eight characters.' }
          ]
        }).then(function (v) {
          if (!v) return;
          if ((v.password || '').length < 8) { A.toast('Use at least eight characters.', true); return; }
          pwBtn.disabled = true;
          callFn({ action: 'set-password', email: addr, password: v.password }).then(function (res) {
            pwBtn.disabled = false;
            if (res.error) { A.toast(res.error, true); return; }
            A.toast('Password set for ' + addr);
          });
        });
        return;
      }

      if (rmBtn) {
        var email = rmBtn.getAttribute('data-remove');
        if (!window.confirm('Remove ' + email + '? Their account is deleted and they can no longer sign in.')) return;
        rmBtn.disabled = true;
        callFn({ action: 'remove', email: email }).then(function (res) {
          if (res.error) { A.toast(res.error, true); rmBtn.disabled = false; return; }
          A.toast('Removed ' + email);
          load();
        });
      }
    });

    document.getElementById('addAdmin').addEventListener('click', function () {
      A.modal({
        title: 'Add an admin',
        note: 'This creates their account with the password you choose and adds them to the list. Give them the password yourself.',
        confirm: 'Create account',
        fields: [
          { name: 'email', label: 'Email', type: 'email', autocomplete: 'off' },
          { name: 'full_name', label: 'Name', hint: 'Optional.' },
          { name: 'password', label: 'Password', type: 'password',
            autocomplete: 'new-password', hint: 'At least eight characters. You choose it, so tell them what it is.' }
        ]
      }).then(function (v) {
        if (!v) return;
        var email = (v.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { A.toast('That does not look like an address.', true); return; }
        if ((v.password || '').length < 8) { A.toast('Use a password of at least eight characters.', true); return; }
        A.toast('Creating the account');
        callFn({ action: 'create', email: email, password: v.password, full_name: (v.full_name || '').trim() })
          .then(function (res) {
            if (res.error) { A.toast(res.error, true); return; }
            A.toast(email + ' can now sign in');
            load();
          });
      });
    });

    load();
  });
})();
