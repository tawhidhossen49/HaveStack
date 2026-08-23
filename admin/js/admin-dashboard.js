/* dashboard: Dashboard */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("index.html", 'Dashboard', 'An overview of the site and what needs attention.', null);
  if (!content) return;
  content.innerHTML = '<div class="stats">' +
      ['Meeting requests', 'Products', 'Clients and partners', 'Maintenance pages']
        .map(function (label) {
          return '<div class="stat">' +
            '<div class="label">' + label + '</div>' +
            '<div class="value">0</div>' +
            '<div class="sub">Not connected</div>' +
          '</div>';
        }).join('') +
    '</div>' +
    A.notice('This is the admin interface with nothing behind it yet. The counts above read zero '
      + 'because no data source is attached, not because the site is empty. Tell me what each '
      + 'section should manage and the panels will be wired to it.') +
    A.panel({
      title: 'Quick actions',
      note: 'The things you will reach for most once this is live.',
      body: '<div class="row-actions">' +
        [['requests.html', 'Meeting requests'],
         ['products.html', 'Products'],
         ['partners.html', 'Clients and partners'],
         ['media.html', 'Media library'],
         ['settings.html', 'Settings']]
        .map(function (x) { return '<a class="btn btn-sm" href="' + x[0] + '">' + x[1] + '</a>'; })
        .join('') + '</div>'
    }) +
    A.panel({
      title: 'Recent activity',
      note: 'Edits, publishes and sign ins will appear here.',
      flush: true,
      body: A.empty('No activity yet', 'Once the panel is connected, everything changed here is logged so you can see who did what and when.')
    });
})();
