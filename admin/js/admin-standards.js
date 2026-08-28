/* standards: Standards */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("standards.html", 'Standards', 'The twelve commitments, in three groups.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Commitments', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search commitments" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add commitment' + '</button>', body: A.table(['Group', 'Commitment', 'Order', ''], '') + A.empty('No commitments loaded', 'Delivery and documentation, Security and access, and Ownership and continuity will be edited here as three groups.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add commitment' + '</button>') });
  });
})();
