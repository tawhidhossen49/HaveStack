/* account: Account */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("account.html", 'Account', 'Your details, your password and your sign in activity.', null, me);
    if (!content) return;
    content.innerHTML = P.panel({ title: 'Loading', body: P.loadingLines(4) });

    function draw() {
      var me = PortalAuth.currentHolder() || {};

      /* What a holder may change, and what only the company may. Saying so
         plainly is better than showing a disabled field with no explanation. */
      var profile = P.panel({
        title: 'Profile',
        note: 'Your name, reference and shareholding are part of the register and can only ' +
              'be changed by the company. Everything else below is yours to edit.',
        body: P.kv([
          ['Name', P.escapeHtml(me.full_name || '')],
          ['Investor reference', '<span class="num">' + P.escapeHtml(me.investor_ref || '') + '</span>'],
          ['Holder type', P.escapeHtml(
            me.holder_type === 'entity' ? 'Entity' : me.holder_type === 'trust' ? 'Trust' : 'Individual')],
          ['On the register since', P.date(me.joined_on)],
          ['Standing', P.stateTag(me.status)],
          ['Email', P.escapeHtml(me.user_email || '')],
          ['Phone', P.escapeHtml(me.phone || 'Not given')],
          ['Address', P.escapeHtml(me.address || 'Not given')],
          ['Country', P.escapeHtml(me.country || 'Not given')],
          ['Listed in the register', me.directory_opt_in
            ? 'Yes, other holders see your name'
            : 'No, you appear as an undisclosed holder']
        ]),
        foot: me.has_holding ? '<button class="btn btn-sm" type="button" id="editProfile">Edit my details</button>' : ''
      });

      var security = P.panel({
        title: 'Password and access',
        note: 'Your portal password is separate from any admin panel password. Changing it signs out your other devices.',
        body: P.kv([
          ['Password', 'Your portal password. If you forget it, your portal administrator sets a new one.'],
          ['Two factor authentication', '<span id="mfaState">Checking</span>'],
          ['This device', P.escapeHtml(PortalAuth.shortDevice())]
        ]),
        foot:
          '<button class="btn btn-sm" type="button" id="changePw">Change password</button>' +
          '<button class="btn btn-sm" type="button" id="mfaBtn">Set up two factor</button>' +
          '<button class="btn btn-sm btn-danger" type="button" id="signOutOthers">' +
            'Sign out other devices</button>'
      });

      var activity = P.panel({
        title: 'Sign in and security activity',
        note: 'Written by the portal and not editable by anyone, including you. If you see ' +
              'something here you do not recognise, change your password and tell the company.',
        flush: true,
        body: '<div id="acts">' + P.loadingLines(3) + '</div>'
      });

      content.innerHTML =
        P.notice('This is the only page in the portal where anything can be changed, and it ' +
                 'changes only your own contact details and how you sign in. Your holding, ' +
                 'your transactions and your dividends are records kept by the company.') +
        '<div class="split">' + profile + security + '</div>' + activity;

      loadActivity();
      loadMfa();
    }

    function loadActivity() {
      var box = document.getElementById('acts');
      P.mine('portal_activity')
        .order('created_at', { ascending: false }).limit(25)
        .then(function (r) {
          if (r.error) { box.innerHTML = P.failed(r.error.message); return; }
          var list = r.data || [];
          if (!list.length) {
            box.innerHTML = P.empty('Nothing recorded yet',
              'Your sign ins and security changes will be listed here from now on.');
            return;
          }
          var LABEL = {
            sign_in: 'Signed in', sign_out: 'Signed out',
            password_change: 'Password changed', profile_change: 'Details updated',
            mfa_enrolled: 'Two factor enabled', mfa_removed: 'Two factor removed',
            document_view: 'Document opened'
          };
          box.innerHTML = P.table(['When', 'What', 'Device', 'Detail'],
            list.map(function (a) {
              return '<tr>' +
                '<td class="num">' + P.dateTime(a.created_at) + '</td>' +
                '<td>' + P.escapeHtml(LABEL[a.kind] || a.kind) + '</td>' +
                '<td>' + P.escapeHtml(a.device || '·') + '</td>' +
                '<td>' + P.escapeHtml(a.detail || '') + '</td>' +
              '</tr>';
            }).join(''));
        });
    }

    var factors = [];
    function loadMfa() {
      PortalAuth.listFactors().then(function (f) {
        factors = ((f && f.totp) || []).filter(function (x) { return x.status === 'verified'; });
        var el = document.getElementById('mfaState');
        var btn = document.getElementById('mfaBtn');
        if (!el) return;
        if (factors.length) {
          el.textContent = 'On, using an authenticator app';
          if (btn) btn.textContent = 'Turn off two factor';
        } else {
          el.textContent = 'Off. Turning it on means a code from your phone as well as your password.';
          if (btn) btn.textContent = 'Set up two factor';
        }
      });
    }

    content.addEventListener('click', function (e) {
      var t = e.target;

      if (t.closest('#editProfile')) {
        var me = PortalAuth.currentHolder() || {};
        P.modal({
          title: 'Edit my details',
          note: 'These four are yours. Everything else is part of the register.',
          confirm: 'Save',
          fields: [
            { name: 'phone',   label: 'Phone', value: me.phone || '' },
            { name: 'address', label: 'Address', value: me.address || '', multiline: true, rows: 3 },
            { name: 'country', label: 'Country', value: me.country || '' },
            { name: 'listed',  label: 'Listed in the register', value: me.directory_opt_in ? 'yes' : 'no',
              options: [{ value: 'yes', label: 'Yes, show my name to other holders' },
                        { value: 'no',  label: 'No, appear as an undisclosed holder' }],
              hint: 'Your holding is listed either way, so the percentages still add up. ' +
                    'Only the name is withheld.' }
          ]
        }).then(function (v) {
          if (!v) return;
          P.saveProfile(me.id, {
            phone: v.phone.trim(), address: v.address.trim(), country: v.country.trim(),
            directory_opt_in: v.listed === 'yes'
          }).then(function (r) {
            if (r.error) { P.toast(r.error, true); return; }
            PortalAuth.record('profile_change', 'Contact details updated');
            P.toast('Saved.');
            // the shell reads the record afresh on load
            setTimeout(function () { location.reload(); }, 600);
          });
        });
        return;
      }

      if (t.closest('#changePw')) {
        P.modal({
          title: 'Change password',
          note: 'At least ten characters. Your other devices will be signed out.',
          confirm: 'Change it',
          fields: [
            { name: 'pw1', label: 'New password', type: 'password', autocomplete: 'new-password' },
            { name: 'pw2', label: 'Type it again', type: 'password', autocomplete: 'new-password' }
          ],
          validate: function (v) {
            if ((v.pw1 || '').length < 10) return 'Use at least ten characters.';
            if (v.pw1 !== v.pw2) return 'Those two do not match.';
            return null;
          }
        }).then(function (v) {
          if (!v) return;
          PortalAuth.updatePassword(v.pw1).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            PortalAuth.record('password_change', 'Password changed');
            P.toast('Password changed.');
          });
        });
        return;
      }

      if (t.closest('#signOutOthers')) {
        if (!window.confirm('Sign out every other device? You will stay signed in here.')) return;
        PortalAuth.signOutOthers().then(function (r) {
          if (r && r.error) { P.toast(r.error.message, true); return; }
          P.toast('Every other device has been signed out.');
        });
        return;
      }

      if (t.closest('#mfaBtn')) {
        if (factors.length) {
          if (!window.confirm('Turn off two factor authentication? Your password alone will ' +
                              'then be enough to sign in.')) return;
          PortalAuth.unenroll(factors[0].id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            PortalAuth.record('mfa_removed', 'Two factor removed');
            P.toast('Two factor is off.');
            loadMfa();
          });
          return;
        }
        startEnrol();
      }
    });

    /* Enrolling is two steps on purpose: the factor is not trusted until a code
       from the app has been accepted, so a half finished setup cannot lock
       anybody out of their own account. */
    function startEnrol() {
      PortalAuth.enrollTotp().then(function (r) {
        if (r.error) { P.toast(r.error.message, true); return; }
        var d = r.data;
        var qr = d.totp && d.totp.qr_code;
        var secret = (d.totp && d.totp.secret) || '';

        var wrap = document.createElement('div');
        wrap.innerHTML = P.panel({
          title: 'Scan this with your authenticator app',
          body: (qr ? '<img src="' + qr + '" alt="Two factor setup code" ' +
                      'width="180" height="180" style="background:#fff;padding:8px" />' : '') +
                '<p style="margin-top:12px;font-size:13.5px;color:var(--ink-2)">' +
                'Cannot scan it? Enter this key by hand:</p>' +
                '<p class="num" style="margin-top:4px;word-break:break-all">' +
                  P.escapeHtml(secret) + '</p>'
        });

        P.modal({
          title: 'Set up two factor',
          note: 'Scan the code, then type the six digits your app shows.',
          confirm: 'Turn it on',
          fields: [{ name: 'code', label: 'Six digit code', autocomplete: 'one-time-code' }],
          validate: function (v) {
            return /^[0-9]{6}$/.test((v.code || '').trim()) ? null : 'That should be six digits.';
          },
          before: wrap.innerHTML
        }).then(function (v) {
          if (!v) { PortalAuth.unenroll(d.id); return; }
          PortalAuth.verifyTotp(d.id, v.code).then(function (res) {
            if (res.error) { P.toast(res.error.message, true); return; }
            PortalAuth.record('mfa_enrolled', 'Two factor enabled');
            P.toast('Two factor is on.');
            loadMfa();
          });
        });
      });
    }

    draw();
  });
})();
