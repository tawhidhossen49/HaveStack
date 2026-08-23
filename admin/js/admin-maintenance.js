/* maintenance: Maintenance */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("maintenance.html", 'Maintenance', 'The four domains and their pages.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Domains', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search domains" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add domain' + '</button>', body: A.table(['Domain', 'Page', 'Points', 'Frame', 'Updated', ''], '') + A.empty('No domains loaded', 'The four domains will be edited here along with the page behind each one, its points and its frame.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add domain' + '</button>') });
})();
