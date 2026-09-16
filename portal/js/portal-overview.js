/* overview: Overview */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("index.html", 'Overview', 'Your position in HaveStack Technologies.', null, me);
    if (!content) return;
    content.innerHTML = P.loadingStats(4) + P.panel({ title: 'Loading', body: P.loadingLines(3) });

    /* The overview is drawn from five reads, and drawn again whenever the
       register changes underneath it: a new share price, a new update or a
       change to this holder's certificates arrives over the realtime channel
       and the page recomputes without a reload. */
    var chart = null, measure = 'price', range = 'all', drawn = false, latestVal = null;

    function seg(group, label, items, current) {
      return '<div class="seg" role="group" aria-label="' + label + '">' +
        items.map(function (i) {
          return '<button type="button" data-seg="' + group + '" data-value="' + i[0] +
            '" aria-pressed="' + (i[0] === current) + '">' + i[1] + '</button>';
        }).join('') + '</div>';
    }

    function load() {
      return Promise.all([
        P.one('v_my_position'),
        PortalAuth.client().from('valuations')
          .select('effective_on,price_per_share,total_valuation,method,note,published')
          .eq('published', true).order('effective_on').then(function (r) { return r; }),
        P.mine('dividend_payments', 'net,status').then(function (r) { return r; }),
        P.mine('transactions', '*,share_classes(code)')
          .order('occurred_on', { ascending: false }).then(function (r) { return r; }),
        PortalAuth.client().from('updates')
          .select('title,kind,published_at,automatic').eq('published', true)
          .order('published_at', { ascending: false }).limit(4).then(function (r) { return r; })
      ]).then(render);
    }

    function render(res) {
      var pos = res[0], valRes = res[1], divs = res[2], txs = res[3], ups = res[4];
      if (pos.error) { content.innerHTML = P.failed(pos.error); return; }
      var p = pos.data || {};
      var vals = (valRes && !valRes.error && valRes.data) || [];
      var ledger = (txs && !txs.error && txs.data) || [];
      var latest = vals.length ? vals[vals.length - 1] : null;
      var holds = Number(p.shares) > 0;

      var paid = 0, due = 0;
      if (divs && !divs.error) {
        (divs.data || []).forEach(function (d) {
          if (d.status === 'paid') paid += Number(d.net) || 0;
          else if (d.status === 'pending') due += Number(d.net) || 0;
        });
      }
      var invested = Number(p.invested) || 0;
      var value = Number(p.current_value) || 0;
      if (!holds) measure = 'price';

      var intro = holds ? '' : P.notice(me.is_admin
        ? 'You are signed in as a portal administrator and hold no shares yourself, so there is ' +
          'no position of your own to show. The price below is what every holding is valued at. ' +
          'Use Administration to run the register.'
        : 'Nothing is registered in your name yet. When your first allotment or purchase is ' +
          'entered it appears here, with your certificate and the transaction behind it. If you ' +
          'believe this is wrong, contact the company secretary.');

      var top = !holds ? '' :
        '<div class="stats">' +
          P.statCard('Shares owned', P.shares(p.shares), 'Across every class you hold') +
          P.statCard('Ownership', P.pct(p.ownership_pct),
                     (Number(p.company_total) > 0
                       ? 'Of ' + P.shares(p.company_total) + ' shares in the company'
                       : 'Of ' + P.shares(p.total_shares) + ' shares in issue') +
                     P.bar(p.ownership_pct, true)) +
          P.statCard('Holding value', P.moneyBig(value), 'At the current internal price') +
          P.statCard('Total invested', P.moneyBig(invested), 'What these shares cost you') +
        '</div>';

      var bottom = !holds ? '' :
        '<div class="stats">' +
          P.statCard('Dividends received', P.moneyBig(paid),
                     due > 0 ? P.money(due) + ' approved and not yet paid' : 'Net of withholding') +
          P.statCard('Performance', P.deltaBig(value, invested),
                     P.deltaHtml(value, invested, { bare: true }) +
                     '<span class="asof">Excludes dividends already paid to you</span>') +
          P.statCard('Total return', P.deltaBig(value + paid, invested),
                     P.deltaHtml(value + paid, invested, { bare: true }) +
                     '<span class="asof">Holding value plus dividends paid</span>') +
        '</div>';

      var chartPanel = P.panel({
        title: 'Share price',
        note: 'Set by board valuation. A price stands until the next one is set, so the line moves in steps.',
        actions: '<div class="price-controls">' +
          (holds ? seg('px-measure', 'What to chart',
                       [['price', 'Share price'], ['value', 'Your holding value']], measure) : '') +
          seg('px-range', 'Time range', [['1y', '12 months'], ['3y', '3 years'], ['all', 'All']], range) +
          '</div>',
        body: '<div class="price-head"><div><div class="price-now" id="px-now"></div>' +
              '<div class="price-meta" id="px-meta"></div></div></div><div id="px-chart"></div>',
        foot: '<button class="btn btn-sm" type="button" id="px-table" aria-pressed="false">View as table</button>'
      });

      var recent;
      if (!holds) {
        recent = '';
      } else if (txs.error) {
        recent = P.panel({ title: 'Recent activity', flush: true, body: P.failed(txs.error.message) });
      } else {
        recent = P.panel({
          title: 'Recent activity', flush: true,
          note: 'The last five entries against your holding.',
          body: !ledger.length
            ? P.empty('No transactions yet', 'Entries appear here as they are recorded on the register.')
            : P.table(['Date', 'Kind', 'Shares', 'Value', 'Status'],
                ledger.slice(0, 5).map(function (t) {
                  return '<tr>' +
                    '<td class="num">' + P.date(t.occurred_on) + '</td>' +
                    '<td>' + P.escapeHtml(P.txKind(t.kind)) +
                      '<div class="doc-meta">' + P.escapeHtml((t.share_classes && t.share_classes.code) || '') + '</div></td>' +
                    '<td class="money">' + (t.shares ? P.shares(t.shares) : '·') + '</td>' +
                    '<td class="money">' + (Number(t.total_value) ? P.money(t.total_value) : '·') + '</td>' +
                    '<td>' + P.stateTag(t.status) + '</td>' +
                  '</tr>';
                }).join(''))
        });
      }

      var news = P.panel({
        title: 'Latest updates',
        actions: '<a class="btn btn-sm" href="updates.html">All updates</a>',
        body: (ups && !ups.error && (ups.data || []).length)
          ? '<div class="tl">' + ups.data.map(function (u) {
              return '<div class="tl-item">' +
                '<div class="tl-when">' + P.escapeHtml(P.updateKind(u.kind)) + ' · ' + P.date(u.published_at) + '</div>' +
                '<div class="tl-title">' + P.escapeHtml(u.title) + '</div>' +
              '</div>';
            }).join('') + '</div>'
          : P.empty('Nothing published yet', 'Company announcements and investor updates appear here.')
      });

      content.innerHTML = intro + top + chartPanel + bottom +
        (holds ? '<div class="split split-wide">' + recent + news + '</div>' : news);

      // drawn in once; a redraw after a live change must not animate again
      chart = PortalChart.mount(document.getElementById('px-chart'), {
        valuations: vals, ledger: ledger, measure: measure, range: range, drawnOnce: drawn
      });
      drawn = true;
      latestVal = latest;
      headline(latest);
    }

    function headline(latest) {
      var now = document.getElementById('px-now'), meta = document.getElementById('px-meta');
      if (!now || !chart) return;
      var s = chart.summary();
      if (!s.last) {
        now.textContent = '';
        meta.textContent = measure === 'value' ? 'Nothing to chart yet.' : 'No share price has been published yet.';
        return;
      }
      now.innerHTML = P.moneyBig(s.last.v);
      var span = range === '1y' ? 'over the last 12 months' : range === '3y' ? 'over the last 3 years' : 'since the first valuation';
      meta.innerHTML =
        (s.first && s.first.v > 0 && s.first.t !== s.last.t
          ? P.deltaHtml(s.last.v, s.first.v, { bare: true }) + '<span>' + span + '</span>' : '') +
        (latest ? '<span class="asof">Current price set ' + P.date(latest.effective_on) +
          (latest.method ? ', ' + P.escapeHtml(latest.method.toLowerCase()) : '') + '</span>' : '');
    }

    content.addEventListener('click', function (e) {
      var b = e.target.closest('[data-seg]');
      if (b && chart) {
        b.parentNode.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        if (b.getAttribute('data-seg') === 'px-measure') measure = b.getAttribute('data-value');
        else range = b.getAttribute('data-value');
        chart.update({ measure: measure, range: range });
        headline(latestVal);
        return;
      }
      var t = e.target.closest('#px-table');
      if (t && chart) {
        var on = t.getAttribute('aria-pressed') !== 'true';
        t.setAttribute('aria-pressed', String(on));
        t.textContent = on ? 'View as chart' : 'View as table';
        chart.showTable(on);
      }
    });

    /* Live. Row level security still applies to what arrives, so a holder only
       ever hears about rows they could have read anyway. */
    PortalAuth.client().channel('portal-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'valuations' }, function (payload) {
        load().then(function () {
          if (payload.eventType === 'INSERT' && payload.new && payload.new.published) {
            P.toast('Share price set at ' + P.price(payload.new.price_per_share) +
                    '. Every holding has been revalued.');
          }
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, function (payload) {
        var u = payload.new || {};
        // the price toast above already says this one
        if (u.published && !(u.automatic && /^Share price/.test(u.title || ''))) {
          P.toast('New update: ' + u.title);
        }
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings' }, function () { load(); })
      .subscribe();

    load();
  });
})();
