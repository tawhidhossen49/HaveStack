/* products: Products */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("products.html", 'Products', 'Software the practice runs itself.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('This panel is the interface only. Nothing is connected to a data source yet, so no rows are shown and no invented ones are standing in for them.') + A.panel({ title: 'Product index', flush: true, actions: '<div class="search">' + A.svg(A.I.search, 15) + '<input type="search" placeholder="Search" aria-label="Search product index" />' + '</div>' + '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add product' + '</button>', body: A.table(['Product', 'One line', 'Link', 'State', ''], '') + A.empty('No products to show', 'Entries on the public index will be managed here, including the link that replaces the not yet public label.', '<button class="btn btn-key btn-sm" type="button" data-stub>' + A.svg(A.I.plus, 14) + 'Add product' + '</button>') });
  });
})();
