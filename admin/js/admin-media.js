/* media: Media library */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("media.html", 'Media library', 'Photography, marks and the hero film.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Files', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search files" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Upload' + '</button>', body: A.table(['File', 'Used on', 'Dimensions', 'Size', 'Type', ''], '') + A.empty('No files listed', 'Everything in the assets folder will be listed here with what uses it, so a frame can be replaced without touching the markup.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Upload' + '</button>') });
})();
