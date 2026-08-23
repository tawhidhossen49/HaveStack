/* requests: Meeting requests */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("requests.html", 'Meeting requests', 'Briefs submitted through the request page.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'All requests', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search all requests" />' + '</div>' + '<button class="btn btn-sm" type="button" data-stub>' + A.svg(A.I.ext, 14) + 'Export' + '</button>', body: A.table(['Reference', 'Organisation', 'Sector', 'Contact', 'Received', 'Status', ''], '') + A.empty('No requests to show', 'Submitted briefs will be listed here with their reference, so one can be opened, marked as read and replied to.') });
})();
