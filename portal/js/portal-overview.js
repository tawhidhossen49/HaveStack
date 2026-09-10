/* overview: Overview */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("index.html", 'Overview', 'Your position in HaveStack Technologies.', null, me);
    if (!content) return;
    content.innerHTML = P.loadingStats(4) + P.panel({ title: 'Loading', body: P.loadingLines(3) });

    /* Four figures, then four more, then what has happened lately. Everything
       on this page is derived from the same two reads, so nothing can
       disagree with anything else. */
    Promise.all([
      P.one('v_my_position'),
      P.one('v_latest_valuation'),
      P.mine('dividend_payments', 'net,status').then(function (r) { return r; }),
      P.mine('transactions', '*,share_classes(code)')
        .order('occurred_on', { ascending: false }).limit(5)
        .then(function (r) { return r; }),
      PortalAuth.client().from('updates')
        .select('title,kind,published_at').eq('published', true)
        .order('published_at', { ascending: false }).limit(4)
        .then(function (r) { return r; })
    ]).then(function (res) {
      var pos = res[0], val = res[1], divs = res[2], txs = res[3], ups = res[4];

      if (pos.error) { content.innerHTML = P.failed(pos.error); return; }
      var p = pos.data || {};
      var v = (val && val.data) || {};

      var paid = 0, due = 0;
      if (divs && !divs.error) {
        (divs.data || []).forEach(function (d) {
          if (d.status === 'paid') paid += Number(d.net) || 0;
          else if (d.status === 'pending') due += Number(d.net) || 0;
        });
      }

      var invested = Number(p.invested) || 0;
      var value = Number(p.current_value) || 0;

      /* A holder with nothing on the register gets a plain explanation rather
         than a wall of zeroes, which would look like a broken page. */
      if (!Number(p.shares)) {
        content.innerHTML =
          P.panel({
            title: 'Nothing on the register yet',
            body: P.empty('No shares recorded',
              'When your first allotment or purchase is entered on the register it will ' +
              'appear here, together with your certificate and the transaction behind it. ' +
              'If you believe this is wrong, contact the company secretary.')
          });
        return;
      }

      var stats =
        '<div class="stats">' +
          P.statCard('Shares owned', P.shares(p.shares),
                     'Across every class you hold') +
          P.statCard('Ownership', P.pct(p.ownership_pct),
                     'Of ' + P.shares(p.total_shares) + ' shares in issue' +
                     P.bar(p.ownership_pct, true)) +
          P.statCard('Share price', P.price(p.price_per_share),
                     v.effective_on ? 'Set ' + P.date(v.effective_on) : 'No valuation published') +
          P.statCard('Holding value', P.moneyBig(value),
                     'At the current internal price') +
        '</div>' +
        '<div class="stats">' +
          P.statCard('Total invested', P.moneyBig(invested),
                     'What these shares cost you') +
          P.statCard('Dividends received', P.moneyBig(paid),
                     due > 0 ? P.money(due) + ' approved and not yet paid'
                             : 'Net of withholding') +
          P.statCard('Performance', P.deltaBig(value, invested),
                     P.deltaHtml(value, invested, { bare: true }) +
                     '<span class="asof">Excludes dividends already paid to you</span>') +
          P.statCard('Total return', P.deltaBig(value + paid, invested),
                     P.deltaHtml(value + paid, invested, { bare: true }) +
                     '<span class="asof">Holding value plus dividends paid</span>') +
        '</div>';

      var recent;
      if (txs.error) {
        recent = P.failed(txs.error);
      } else if (!(txs.data || []).length) {
        recent = P.empty('No transactions yet',
          'Purchases, allocations, transfers and adjustments appear here as they are ' +
          'entered on the register.');
      } else {
        recent = P.table(['Date', 'Kind', 'Shares', 'Value', 'Status'],
          txs.data.map(function (t) {
            return '<tr>' +
              '<td class="num">' + P.date(t.occurred_on) + '</td>' +
              '<td>' + P.escapeHtml(P.txKind(t.kind)) +
                '<div class="doc-meta">' +
                P.escapeHtml((t.share_classes && t.share_classes.code) || '') + '</div></td>' +
              '<td class="money">' + (t.shares ? P.shares(t.shares) : '—') + '</td>' +
              '<td class="money">' + (Number(t.total_value) ? P.money(t.total_value) : '—') + '</td>' +
              '<td>' + P.stateTag(t.status) + '</td>' +
            '</tr>';
          }).join(''));
      }

      var news = '';
      if (ups && !ups.error && (ups.data || []).length) {
        news = P.panel({
          title: 'Latest updates',
          actions: '<a class="btn btn-sm" href="updates.html">All updates</a>',
          body: '<div class="tl">' + ups.data.map(function (u) {
            return '<div class="tl-item">' +
              '<div class="tl-when">' + P.escapeHtml(P.updateKind(u.kind)) + '  ' +
                P.date(u.published_at) + '</div>' +
              '<div class="tl-title">' + P.escapeHtml(u.title) + '</div>' +
            '</div>';
          }).join('') + '</div>'
        });
      }

      content.innerHTML = stats +
        '<div class="split split-wide">' +
          P.panel({ title: 'Recent activity', flush: true,
                    note: 'The last five entries against your holding.',
                    body: recent }) +
          (news || P.panel({ title: 'Latest updates',
                             body: P.empty('Nothing published yet',
                               'Company announcements and investor updates appear here.') })) +
        '</div>';
    });
  });
})();
