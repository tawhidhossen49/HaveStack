/* capabilities: Capabilities */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("capabilities.html", 'Capabilities', 'The five practice areas and the panel behind each tab.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Practice areas', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search practice areas" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add area' + '</button>', body: A.table(['Practice area', 'Tags', 'Image', 'Order', 'Status', ''], '') + A.empty('No practice areas loaded', 'The five areas on the public page will be edited here: heading, body, tags and the panel image.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add area' + '</button>') });
})();
