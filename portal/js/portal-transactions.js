/* transactions: Transactions */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("transactions.html", 'Transactions', 'Every entry recorded against your holding.', null, me);
    if (!content) return;
    content.innerHTML = P.panel({ title: 'Loading', body: P.loadingLines(5) });

    var KINDS = [['all', 'All'], ['purchase', 'Purchases'], ['allocation', 'Allocations'],
                 ['transfer_in', 'Transfers in'], ['transfer_out', 'Transfers out'],
                 ['bonus', 'Bonus'], ['adjustment', 'Adjustments']];
    var all = [], filter = 'all', term = '';

    function toolbar() {
      return '<div class="seg" role="group" aria-label="Filter by kind">' +
        KINDS.map(function (k) {
          return '<button type="button" data-kind="' + k[0] + '" aria-pressed="' +
            (k[0] === filter) + '">' + P.escapeHtml(k[1]) + '</button>';
        }).join('') + '</div>';
    }

    function render() {
      var list = all.filter(function (t) {
        if (filter !== 'all' && t.kind !== filter) return false;
        if (!term) return true;
        var hay = [t.reference, t.counterparty, t.note, P.txKind(t.kind),
                   (t.share_classes && t.share_classes.code)].join(' ').toLowerCase();
        return hay.indexOf(term) > -1;
      });

      var box = document.getElementById('rows');
      if (!all.length) {
        box.innerHTML = P.empty('No transactions yet',
          'Purchases, allocations, transfers, bonus issues and adjustments all appear here ' +
          'with the reference they were recorded under.');
        return;
      }
      if (!list.length) {
        box.innerHTML = P.empty('Nothing matches',
          'No entry matches that filter. Clear the search or choose All.');
        return;
      }
      box.innerHTML = P.table(
        ['Date', 'Kind', 'Class', 'Shares', 'Unit price', 'Total value', 'Reference', 'Status', ''],
        list.map(function (t) {
          return '<tr>' +
            '<td class="num">' + P.date(t.occurred_on) + '</td>' +
            '<td>' + P.escapeHtml(P.txKind(t.kind)) + '</td>' +
            '<td>' + P.escapeHtml((t.share_classes && t.share_classes.code) || '') + '</td>' +
            '<td class="money">' + (t.shares ? P.shares(t.shares) : '·') + '</td>' +
            '<td class="money">' + (Number(t.unit_price) ? P.price(t.unit_price) : '·') + '</td>' +
            '<td class="money">' + (Number(t.total_value) ? P.money(t.total_value) : '·') + '</td>' +
            '<td class="num">' + P.escapeHtml(t.reference) + '</td>' +
            '<td>' + P.stateTag(t.status) + '</td>' +
            '<td><div class="row-actions" style="justify-content:flex-end">' +
              '<button class="btn btn-sm" type="button" data-open="' +
                P.escapeHtml(t.reference) + '">Detail</button>' +
            '</div></td>' +
          '</tr>';
        }).join(''));
    }

    content.innerHTML = P.panel({
      title: 'Transaction history',
      note: 'A record, not a form. Nothing here can be edited from the portal: a correction ' +
            'is made by the company as a new adjustment entry, so the history stays intact.',
      flush: true,
      actions: toolbar() +
        '<div class="search">' + P.svg(P.I.search, 15) +
        '<input type="search" id="q" placeholder="Search" aria-label="Search transactions" /></div>',
      body: '<div id="rows">' + P.loadingLines(4) + '</div>'
    });

    content.addEventListener('click', function (e) {
      var k = e.target.closest('[data-kind]');
      if (k) {
        filter = k.getAttribute('data-kind');
        content.querySelectorAll('[data-kind]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === k));
        });
        render();
        return;
      }
      var o = e.target.closest('[data-open]');
      if (o) {
        var t = all.filter(function (x) { return x.reference === o.getAttribute('data-open'); })[0];
        if (!t) return;
        P.modal({
          title: P.txKind(t.kind),
          note: t.reference + ' · ' + P.date(t.occurred_on),
          confirm: 'Close',
          fields: [
            { name: 'cls',   label: 'Share class', readonly: true,
              value: (t.share_classes && t.share_classes.code) || '' },
            { name: 'qty',   label: 'Shares', readonly: true, value: P.shares(t.shares) },
            { name: 'unit',  label: 'Unit price', readonly: true, value: P.price(t.unit_price) },
            { name: 'total', label: 'Total value', readonly: true, value: P.money(t.total_value) },
            { name: 'party', label: 'Counterparty', readonly: true, value: t.counterparty || '·' },
            { name: 'state', label: 'Status', readonly: true, value: t.status },
            { name: 'note',  label: 'Note', readonly: true, multiline: true, rows: 3,
              value: t.note || 'No note recorded.' }
          ]
        });
      }
    });

    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () {
      term = (q.value || '').trim().toLowerCase(); render();
    });

    P.mine('transactions', '*,share_classes(code)')
      .order('occurred_on', { ascending: false })
      .then(function (r) {
        if (r.error) { document.getElementById('rows').innerHTML = P.failed(r.error.message); return; }
        all = r.data || [];
        render();
      });
  });
})();
