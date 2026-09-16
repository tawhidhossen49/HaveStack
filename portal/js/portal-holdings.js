/* holdings: My holdings */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("holdings.html", 'My holdings', 'Every lot on the register in your name.', null, me);
    if (!content) return;
    content.innerHTML = P.loadingStats(3) + P.panel({ title: 'Loading', body: P.loadingLines(4) });

    Promise.all([
      P.one('v_my_position'),
      P.mine('holdings', '*,share_classes(code,name,votes_per_share)')
        .order('acquired_on', { ascending: true }).then(function (r) { return r; }),
      P.mine('transactions', '*,share_classes(code)')
        .order('occurred_on', { ascending: true }).then(function (r) { return r; })
    ]).then(function (res) {
      var pos = res[0], lots = res[1], hist = res[2];
      if (lots.error) { content.innerHTML = P.failed(lots.error); return; }
      var p = (pos && pos.data) || {};
      var list = lots.data || [];

      if (!list.length) {
        content.innerHTML = P.panel({
          title: 'Your holdings',
          body: P.empty('No shares recorded',
            'Nothing is registered in your name yet. When an allotment or purchase is ' +
            'entered, each lot appears here with its certificate number, the price paid ' +
            'and the date it was acquired.')
        });
        return;
      }

      /* Per class, because a holder with two classes owns two different things
         with different rights, and adding them into one number hides that. */
      var byClass = {};
      list.forEach(function (h) {
        var c = (h.share_classes && h.share_classes.code) || 'Unclassified';
        if (!byClass[c]) {
          byClass[c] = { code: c, name: (h.share_classes && h.share_classes.name) || '',
                         votes: (h.share_classes && h.share_classes.votes_per_share),
                         shares: 0, cost: 0 };
        }
        if (h.status === 'active') {
          byClass[c].shares += Number(h.shares) || 0;
          byClass[c].cost += (Number(h.shares) || 0) * (Number(h.unit_price) || 0);
        }
      });
      var classes = Object.keys(byClass).map(function (k) { return byClass[k]; });
      var priceNow = Number(p.price_per_share) || 0;

      var summary = '<div class="stats">' +
        P.statCard('Shares owned', P.shares(p.shares), 'Active lots only') +
        P.statCard('Ownership', P.pct(p.ownership_pct),
                   (Number(p.company_total) > 0
                     ? 'Of ' + P.shares(p.company_total) + ' in the company'
                     : 'Of ' + P.shares(p.total_shares) + ' in issue') +
                   P.bar(p.ownership_pct, true)) +
        P.statCard('Current valuation', P.moneyBig(p.current_value),
                   P.deltaHtml(Number(p.current_value) || 0, Number(p.invested) || 0)) +
      '</div>';

      var classTable = P.table(
        ['Class', 'Rights', 'Shares', 'Cost', 'Value now', 'Against cost'],
        classes.map(function (c) {
          var val = c.shares * priceNow;
          return '<tr>' +
            '<td>' + P.escapeHtml(c.code) + '<div class="doc-meta">' +
              P.escapeHtml(c.name) + '</div></td>' +
            '<td>' + (Number(c.votes) > 0
              ? P.escapeHtml(String(c.votes)) + ' vote per share' : 'Non voting') + '</td>' +
            '<td class="money">' + P.shares(c.shares) + '</td>' +
            '<td class="money">' + P.money(c.cost) + '</td>' +
            '<td class="money">' + P.money(val) + '</td>' +
            '<td>' + P.deltaHtml(val, c.cost, { bare: true }) + '</td>' +
          '</tr>';
        }).join(''));

      var lotTable = P.table(
        ['Certificate', 'Class', 'Shares', 'Price paid', 'Acquired', 'Value now', 'Status'],
        list.map(function (h) {
          var cost = (Number(h.shares) || 0) * (Number(h.unit_price) || 0);
          var val = h.status === 'active' ? (Number(h.shares) || 0) * priceNow : 0;
          return '<tr>' +
            '<td class="num">' + P.escapeHtml(h.certificate_no) + '</td>' +
            '<td>' + P.escapeHtml((h.share_classes && h.share_classes.code) || '') + '</td>' +
            '<td class="money">' + P.shares(h.shares) + '</td>' +
            '<td class="money">' + P.price(h.unit_price) +
              '<div class="doc-meta">' + P.money(cost) + ' in total</div></td>' +
            '<td class="num">' + P.date(h.acquired_on) + '</td>' +
            '<td class="money">' + (h.status === 'active' ? P.money(val) : '·') + '</td>' +
            '<td>' + P.stateTag(h.status) + '</td>' +
          '</tr>';
        }).join(''));

      /* The complete ownership history: every entry that moved this holding,
         in the order it happened. */
      var history;
      if (hist.error) {
        history = P.failed(hist.error);
      } else if (!(hist.data || []).length) {
        history = P.empty('No history yet', 'Entries appear here as they are recorded.');
      } else {
        var running = 0;
        history = P.table(['Date', 'Entry', 'Class', 'Shares', 'Running total', 'Reference'],
          hist.data.map(function (t) {
            if (t.status === 'settled') running += Number(t.shares) || 0;
            return '<tr>' +
              '<td class="num">' + P.date(t.occurred_on) + '</td>' +
              '<td>' + P.escapeHtml(P.txKind(t.kind)) +
                (t.status !== 'settled' ? ' ' + P.stateTag(t.status) : '') + '</td>' +
              '<td>' + P.escapeHtml((t.share_classes && t.share_classes.code) || '') + '</td>' +
              '<td class="money">' + (t.shares ? P.shares(t.shares) : '·') + '</td>' +
              '<td class="money">' + P.shares(running) + '</td>' +
              '<td class="num">' + P.escapeHtml(t.reference) + '</td>' +
            '</tr>';
          }).join(''));
      }

      content.innerHTML = summary +
        P.panel({ title: 'By share class', flush: true,
                  note: 'Each class carries its own rights, so they are counted separately.',
                  body: classTable }) +
        P.panel({ title: 'Certificates', flush: true,
                  note: 'One row per lot. A lot keeps the price and the date it was acquired at, ' +
                        'which is what your cost basis is worked out from.',
                  body: lotTable }) +
        P.panel({ title: 'Ownership history', flush: true,
                  note: 'Every entry against your holding, oldest first. A pending or cancelled ' +
                        'entry does not move the running total.',
                  body: history });
    });
  });
})();
