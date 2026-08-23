/* sectors: Sectors */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("sectors.html", 'Sectors', 'Where these systems run.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Sector tiles', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search sector tiles" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add sector' + '</button>', body: A.table(['Sector', 'One line', 'Photograph', 'Size', 'Order', ''], '') + A.empty('No sectors to show', 'The six tiles in the mosaic will be edited here, including which two take the wide cells.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add sector' + '</button>') });
})();
