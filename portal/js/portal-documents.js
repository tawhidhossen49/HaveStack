/* documents: Documents */
(function () {
  "use strict";
  var P = window.Portal;
  // nothing renders until the session is checked against the share register
  PortalAuth.requireShareholder().then(function (me) {
    var content = P.Shell("documents.html", 'Documents', 'Your certificates and statements, and the company papers.', null, me);
    if (!content) return;
    content.innerHTML = P.panel({ title: 'Loading', body: P.loadingLines(5) });

    var CATS = [['all', 'All'], ['certificate', 'Certificates'], ['agreement', 'Agreements'],
                ['dividend_statement', 'Dividend statements'], ['tax', 'Tax'],
                ['annual_report', 'Annual reports'], ['company', 'Company']];
    var all = [], filter = 'all';

    function render() {
      var box = document.getElementById('docs');
      var list = filter === 'all' ? all
               : all.filter(function (d) { return d.category === filter; });

      if (!all.length) {
        box.innerHTML = P.empty('No documents yet',
          'Your share certificates, subscription agreements, dividend statements and tax ' +
          'documents appear here as they are issued, along with company papers such as the ' +
          'annual report.');
        return;
      }
      if (!list.length) {
        box.innerHTML = P.empty('Nothing in this category',
          'No document of that kind has been issued to you yet.');
        return;
      }

      box.innerHTML = '<div class="docs">' + list.map(function (d) {
        var mine = !!d.shareholder_id;
        return '<div class="doc">' +
          P.svg(P.I.file, 19) +
          '<div><div class="doc-name">' + P.escapeHtml(d.title) + '</div>' +
            '<div class="doc-meta">' + P.escapeHtml(P.docKind(d.category)) +
              '  ' + (mine ? 'Issued to you' : 'Company wide') +
              '  ' + P.date(d.issued_on) +
              (P.bytes(d.file_size) ? '  ' + P.bytes(d.file_size) : '') +
            '</div></div>' +
          '<div class="row-actions">' +
            '<button class="btn btn-sm" type="button" data-doc="' + d.id + '">' +
              P.svg(P.I.download, 14) + 'Open</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    content.innerHTML =
      P.notice('A document addressed to you is private to you. Another shareholder cannot ' +
               'list it or open it, and the link below is generated when you ask for it and ' +
               'expires shortly afterwards, so it cannot be forwarded and reused.') +
      P.panel({
        title: 'Documents',
        flush: true,
        actions: '<div class="seg" role="group" aria-label="Filter by kind">' +
          CATS.map(function (c) {
            return '<button type="button" data-cat="' + c[0] + '" aria-pressed="' +
              (c[0] === filter) + '">' + P.escapeHtml(c[1]) + '</button>';
          }).join('') + '</div>',
        body: '<div id="docs">' + P.loadingLines(4) + '</div>'
      });

    content.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cat]');
      if (c) {
        filter = c.getAttribute('data-cat');
        content.querySelectorAll('[data-cat]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === c));
        });
        render();
        return;
      }

      var btn = e.target.closest('[data-doc]');
      if (!btn) return;
      var doc = all.filter(function (d) { return d.id === btn.getAttribute('data-doc'); })[0];
      if (!doc) return;

      if (!doc.storage_path) {
        P.toast('That document has no file attached yet. Contact the company secretary.', true);
        return;
      }

      /* A short lived signed URL, minted per request. The bucket itself stays
         private, so a path on its own is worth nothing to anybody who has one. */
      btn.disabled = true;
      var bucket = doc.storage_path.indexOf('/') > -1
        ? doc.storage_path.slice(0, doc.storage_path.indexOf('/')) : 'documents';
      var key = doc.storage_path.indexOf('/') > -1
        ? doc.storage_path.slice(doc.storage_path.indexOf('/') + 1) : doc.storage_path;

      PortalAuth.client().storage.from(bucket).createSignedUrl(key, 60)
        .then(function (r) {
          btn.disabled = false;
          if (r.error || !r.data || !r.data.signedUrl) {
            P.toast('That file is not available to download yet. The document is on your ' +
                    'record, but its file has not been uploaded to storage.', true);
            return;
          }
          PortalAuth.record('document_view', doc.title);
          window.open(r.data.signedUrl, '_blank', 'noopener');
        }, function () {
          btn.disabled = false;
          P.toast('Could not reach document storage. Try again in a moment.', true);
        });
    });

    P.myDocuments()
      .order('issued_on', { ascending: false })
      .then(function (r) {
        if (r.error) { document.getElementById('docs').innerHTML = P.failed(r.error.message); return; }
        all = r.data || [];
        render();
      });
  });
})();
