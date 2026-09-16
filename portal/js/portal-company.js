/* company: Company */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("company.html", 'Company', 'HaveStack Technologies, as recorded.', null, me);
    if (!content) return;
    content.innerHTML = P.loadingStats(3) + P.panel({ title: 'Loading', body: P.loadingLines(4) });

    Promise.all([
      P.one('v_share_totals'),
      P.one('v_latest_valuation'),
      P.view('valuations', 'effective_on', false),
      P.view('company_facts', 'sort', true),
      PortalAuth.client().from('share_classes').select('*').order('sort')
        .then(function (r) { return r; }),
      PortalAuth.client().from('documents').select('*')
        .is('shareholder_id', null).in('category', ['annual_report', 'company'])
        .order('issued_on', { ascending: false }).then(function (r) { return r; })
    ]).then(function (res) {
      var totals = res[0], latest = res[1], vals = res[2], facts = res[3],
          classes = res[4], docs = res[5];

      var t = (totals && totals.data) || {};
      var v = (latest && latest.data) || {};

      var stats = '<div class="stats">' +
        P.statCard('Company valuation',
                   v.total_valuation ? P.moneyBig(v.total_valuation) : '·',
                   v.effective_on ? P.escapeHtml(v.method || 'Board valuation') +
                     '<span class="asof">As at ' + P.date(v.effective_on) + '</span>'
                     : 'No valuation published') +
        P.statCard('Share price', v.price_per_share ? P.price(v.price_per_share) : '·',
                   v.effective_on ? 'Effective ' + P.date(v.effective_on) : '') +
        P.statCard('Shares in issue', P.shares(t.total_shares),
                   'Held by ' + (t.holders || 0) + ' ' +
                   ((t.holders === 1) ? 'shareholder' : 'shareholders')) +
        (Number(t.company_total) > 0
          ? P.statCard('Shares in the company', P.shares(t.company_total),
                       Number(t.unallocated) > 0
                         ? P.shares(t.unallocated) + ' of them not yet issued'
                         : 'Every one of them is allotted')
          : '') +
      '</div>';

      var history = '';
      if (vals && !vals.error && (vals.data || []).length) {
        history = P.panel({
          title: 'Valuation history',
          note: 'Each figure with the date it took effect and how it was arrived at. ' +
                'A valuation without a date and a method is not something a holder can check.',
          flush: true,
          body: P.table(['Effective', 'Price per share', 'Company valuation', 'Method'],
            vals.data.map(function (x) {
              return '<tr>' +
                '<td class="num">' + P.date(x.effective_on) + '</td>' +
                '<td class="money">' + P.price(x.price_per_share) + '</td>' +
                '<td class="money">' + P.money(x.total_valuation) + '</td>' +
                '<td>' + P.escapeHtml(x.method || '·') +
                  (x.note ? '<div class="doc-meta">' + P.escapeHtml(x.note) + '</div>' : '') +
                '</td>' +
              '</tr>';
            }).join(''))
        });
      }

      var classPanel = '';
      if (classes && !classes.error && (classes.data || []).length) {
        classPanel = P.panel({
          title: 'Share classes',
          flush: true,
          body: P.table(['Class', 'Name', 'Votes per share', 'Par value', 'Rights'],
            classes.data.map(function (c) {
              return '<tr>' +
                '<td class="num">' + P.escapeHtml(c.code) + '</td>' +
                '<td>' + P.escapeHtml(c.name) + '</td>' +
                '<td class="money">' + (Number(c.votes_per_share) || 0) + '</td>' +
                '<td class="money">' + P.price(c.par_value) + '</td>' +
                '<td>' + P.escapeHtml(c.description) + '</td>' +
              '</tr>';
            }).join(''))
        });
      }

      var factPanel = '';
      if (facts && !facts.error && (facts.data || []).length) {
        factPanel = P.panel({
          title: 'Company information',
          body: P.kv(facts.data.map(function (f) {
            return [f.label, P.escapeHtml(f.value) +
              (f.note ? '<div class="doc-meta">' + P.escapeHtml(f.note) + '</div>' : '')];
          }))
        });
      }

      var docPanel;
      if (!docs || docs.error) {
        docPanel = P.panel({ title: 'Reports and papers',
                             body: P.failed(docs ? docs.error.message : 'Unknown error') });
      } else if (!(docs.data || []).length) {
        docPanel = P.panel({ title: 'Reports and papers',
          body: P.empty('Nothing published yet',
            'Annual reports and company papers appear here once they are issued.') });
      } else {
        docPanel = P.panel({
          title: 'Reports and papers', flush: true,
          note: 'Open them from Documents, where every file you may see is listed together.',
          body: '<div class="docs">' + docs.data.map(function (d) {
            return '<div class="doc">' + P.svg(P.I.file, 19) +
              '<div><div class="doc-name">' + P.escapeHtml(d.title) + '</div>' +
                '<div class="doc-meta">' + P.escapeHtml(P.docKind(d.category)) +
                ' · ' + P.date(d.issued_on) + '</div></div>' +
              '<div class="row-actions">' +
                '<a class="btn btn-sm" href="documents.html">Open in Documents</a></div>' +
            '</div>';
          }).join('') + '</div>'
        });
      }

      content.innerHTML = stats +
        '<div class="split">' + (factPanel || '') + (classPanel || '') + '</div>' +
        history + docPanel;
    });
  });
})();
