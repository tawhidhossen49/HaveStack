/* governance: Governance */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("governance.html", 'Governance', 'Corporate standing and related organisations.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Standing and organisations', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search standing and organisations" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add field' + '</button>', body: A.table(['Field', 'Value', 'Shown as', ''], '') + A.empty('Nothing loaded yet', 'The standing copy, the three related organisations and the four facts under them will be edited here.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add field' + '</button>') });
})();
