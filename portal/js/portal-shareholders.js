/* shareholders: Shareholders */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("shareholders.html", 'Shareholders', 'The register, as other holders may see it.', null, me);
    if (!content) return;
    content.innerHTML = P.panel({ title: 'Loading', body: P.loadingLines(5) });

    P.view('v_shareholder_directory', 'shares', false).then(function (r) {
      if (r.error) { content.innerHTML = P.failed(r.error); return; }
      var list = r.data || [];

      if (!list.length) {
        content.innerHTML = P.panel({
          title: 'Shareholder register',
          body: P.empty('Nothing to show', 'The register has no active holders on it yet.')
        });
        return;
      }

      var body = P.table(['Rank', 'Holder', 'Type', 'Class', 'Shares', 'Ownership'],
        list.map(function (s) {
          return '<tr' + (s.is_me ? ' class="is-me"' : '') + '>' +
            '<td><span class="pill">' + s.ranking + '</span></td>' +
            '<td>' + P.escapeHtml(s.full_name) +
              (s.is_me ? ' ' + P.tag('You', 'me') : '') +
              (s.investor_ref ? '<div class="doc-meta">' + P.escapeHtml(s.investor_ref) + '</div>'
                              : '<div class="doc-meta">Listing withheld at the holder&#39;s request</div>') +
            '</td>' +
            '<td>' + P.escapeHtml(
              s.holder_type === 'entity' ? 'Entity'
              : s.holder_type === 'trust' ? 'Trust' : 'Individual') + '</td>' +
            '<td>' + P.escapeHtml(s.classes || '—') + '</td>' +
            '<td class="money">' + P.shares(s.shares) + '</td>' +
            '<td class="money">' + P.pct(s.ownership_pct) +
              P.bar(s.ownership_pct, s.is_me) + '</td>' +
          '</tr>';
        }).join(''));

      content.innerHTML =
        P.notice('This is the register of members, which every holder is entitled to see. ' +
                 'It shows names, classes and sizes of holdings and nothing else. Contact ' +
                 'details, addresses and tax information are never shown here, to you or to ' +
                 'anybody else. A holder who has asked not to be listed appears without a ' +
                 'name, so the percentages still add up.') +
        P.panel({
          title: 'Register of members',
          note: list.length + ' active ' + (list.length === 1 ? 'holder' : 'holders') +
                ', largest first.',
          flush: true, body: body
        });
    });
  });
})();
