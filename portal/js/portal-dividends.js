/* dividends: Dividends */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("dividends.html", 'Dividends', 'What has been declared, and what you were paid.', null, me);
    if (!content) return;
    content.innerHTML = P.loadingStats(3) + P.panel({ title: 'Loading', body: P.loadingLines(4) });

    Promise.all([
      P.mine('dividend_payments', '*,dividends(*,share_classes(code))')
        .then(function (r) { return r; }),
      PortalAuth.client().from('dividends')
        .select('*,share_classes(code)')
        .order('payment_date', { ascending: false }).then(function (r) { return r; })
    ]).then(function (res) {
      var mine = res[0], all = res[1];
      if (mine.error) { content.innerHTML = P.failed(mine.error); return; }

      var list = (mine.data || []).slice().sort(function (a, b) {
        var x = (a.dividends && a.dividends.payment_date) || '';
        var y = (b.dividends && b.dividends.payment_date) || '';
        return y < x ? -1 : y > x ? 1 : 0;
      });

      var paid = 0, pending = 0, tax = 0;
      list.forEach(function (d) {
        if (d.status === 'paid') { paid += Number(d.net) || 0; tax += Number(d.tax_withheld) || 0; }
        else if (d.status === 'pending') pending += Number(d.net) || 0;
      });

      if (!list.length) {
        content.innerHTML = P.panel({
          title: 'Dividends',
          body: P.empty('No dividends yet',
            'When the board declares a dividend, your entitlement is worked out from the ' +
            'shares you held on the record date and appears here with its statement.')
        });
        return;
      }

      /* Anything declared but not yet paid is the thing a reader came for, so
         it sits at the top rather than inside the history. */
      var upcoming = list.filter(function (d) { return d.status === 'pending'; });
      var upcomingHtml = '';
      if (upcoming.length) {
        upcomingHtml = P.panel({
          title: 'Approved and not yet paid',
          note: 'Worked out from the shares you held on the record date.',
          flush: true,
          body: P.table(['Dividend', 'Per share', 'Eligible shares', 'Gross', 'Withheld', 'Net', 'Payment date'],
            upcoming.map(function (d) {
              var dv = d.dividends || {};
              return '<tr>' +
                '<td>' + P.escapeHtml(dv.title || '') +
                  '<div class="doc-meta">' + P.escapeHtml(
                    (dv.share_classes && dv.share_classes.code) || 'All classes') + '</div></td>' +
                '<td class="money">' + P.price(dv.per_share) + '</td>' +
                '<td class="money">' + P.shares(d.eligible_shares) + '</td>' +
                '<td class="money">' + P.money(d.gross) + '</td>' +
                '<td class="money">' + P.money(d.tax_withheld) + '</td>' +
                '<td class="money">' + P.money(d.net) + '</td>' +
                '<td class="num">' + P.date(dv.payment_date) + '</td>' +
              '</tr>';
            }).join(''))
        });
      }

      var stats = '<div class="stats">' +
        P.statCard('Received to date', P.moneyBig(paid), 'Net of withholding') +
        P.statCard('Approved, not yet paid', P.moneyBig(pending),
                   upcoming.length ? 'Due ' + P.date(upcoming[0].dividends &&
                     upcoming[0].dividends.payment_date) : 'Nothing outstanding') +
        P.statCard('Tax withheld', P.moneyBig(tax), 'Shown on your tax documents') +
      '</div>';

      var history = P.table(
        ['Dividend', 'Declared', 'Record date', 'Per share', 'Eligible', 'Gross', 'Net', 'Paid', 'Status'],
        list.map(function (d) {
          var dv = d.dividends || {};
          return '<tr>' +
            '<td>' + P.escapeHtml(dv.title || '') +
              '<div class="doc-meta">' + P.escapeHtml(
                (dv.share_classes && dv.share_classes.code) || 'All classes') + '</div></td>' +
            '<td class="num">' + P.date(dv.declared_on) + '</td>' +
            '<td class="num">' + P.date(dv.record_date) + '</td>' +
            '<td class="money">' + P.price(dv.per_share) + '</td>' +
            '<td class="money">' + P.shares(d.eligible_shares) + '</td>' +
            '<td class="money">' + P.money(d.gross) + '</td>' +
            '<td class="money">' + P.money(d.net) + '</td>' +
            '<td class="num">' + (d.paid_on ? P.date(d.paid_on) : '·') + '</td>' +
            '<td>' + P.stateTag(d.status) + '</td>' +
          '</tr>';
        }).join(''));

      /* Everything the company has declared, including classes the reader does
         not hold. Useful context, clearly separated from their own money. */
      var company = '';
      if (all && !all.error && (all.data || []).length) {
        company = P.panel({
          title: 'Declared by the company',
          note: 'Every dividend on the record, whether or not you were eligible for it.',
          flush: true,
          body: P.table(['Dividend', 'Class', 'Per share', 'Record date', 'Payment date', 'Status'],
            all.data.map(function (dv) {
              return '<tr>' +
                '<td>' + P.escapeHtml(dv.title) + '</td>' +
                '<td>' + P.escapeHtml((dv.share_classes && dv.share_classes.code) || 'All classes') + '</td>' +
                '<td class="money">' + P.price(dv.per_share) + '</td>' +
                '<td class="num">' + P.date(dv.record_date) + '</td>' +
                '<td class="num">' + P.date(dv.payment_date) + '</td>' +
                '<td>' + P.stateTag(dv.status) + '</td>' +
              '</tr>';
            }).join(''))
        });
      }

      content.innerHTML = stats + upcomingHtml +
        P.panel({ title: 'Your dividend history', flush: true,
                  note: 'Gross is the entitlement, net is what reached you after withholding.',
                  body: history }) + company;
    });
  });
})();
