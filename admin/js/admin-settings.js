/* settings: Settings */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("settings.html", 'Settings', 'The contact address and who can sign in.', null, admin);
    if (!content) return;
    content.innerHTML = A.panel({
      title: 'Contact address',
      note: 'Where the site tells people to write, and where a submitted brief ' +
            'goes if the database is ever unreachable.',
      body: '<div class="field"><label for="s-email">Contact address</label>' +
        '<input id="s-email" type="email" placeholder="hello@example.com" />' +
        '<span class="hint">Shown in the footer and on the request page, and used ' +
        'as the address a brief falls back to.</span></div>' +
        '<div id="s-email-note"></div>',
      foot: '<button class="btn btn-key btn-sm" type="button" id="saveContact">Save</button>'
    }) +
    A.notice('The practice name, the description and the live domain are not ' +
      'settings and are not editable here. They sit in the head of ' +
      '<code>index.html</code> because a search engine reads them before any ' +
      'script on the page has run, so a value stored in the database would ' +
      'arrive too late to be the one indexed. Change them in that file.') +
    A.panel({
      title: 'Access',
      note: 'Everyone who can sign in. Adding somebody here creates their account with the password you choose and puts them on the list, in one step.',
      flush: true,
      actions: '<button class="btn btn-key btn-sm" type="button" id="addAdmin">' + A.svg(A.I.plus, 14) + 'Add admin</button>',
      body: '<div id="adminList">' + A.empty('Loading', 'Reading the admin list.') + '</div>'
    });

    /* ---- the contact address ----------------------------------------------
       One row in site_settings. The public page reads the same row, so what is
       typed here is what a visitor sees rather than a copy of it kept in step
       by hand. */
    var emailInput = document.getElementById('s-email');
    var emailNote = document.getElementById('s-email-note');

    AdminAuth.client().from('site_settings').select('value').eq('key', 'contact_email')
      .maybeSingle().then(function (r) {
        if (r.error) {
          emailNote.innerHTML = '<span class="hint">Could not read it. Run ' +
            'supabase/site-schema.sql if you have not yet.</span>';
          return;
        }
        emailInput.value = (r.data && r.data.value) || '';
      });

    document.getElementById('saveContact').addEventListener('click', function () {
      var v = emailInput.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        A.toast('That does not look like an email address.', true);
        return;
      }
      AdminAuth.client().from('site_settings')
        .update({ value: v }).eq('key', 'contact_email')
        .then(function (r) {
          if (r.error) { A.toast(r.error.message, true); return; }
          A.toast('Saved. The site uses it on its next load.');
        });
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
