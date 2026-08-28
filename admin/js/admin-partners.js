/* partners: Clients and partners */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("partners.html", 'Clients and partners', 'The marks shown in the two registers.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Marks', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search marks" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add organisation' + '</button>', body: A.table(['Organisation', 'Register', 'Mark', 'Order', ''], '') + A.empty('No organisations to show', 'The mark, which register it belongs to and the order it appears in will be managed here.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add organisation' + '</button>') });
  });
})();
