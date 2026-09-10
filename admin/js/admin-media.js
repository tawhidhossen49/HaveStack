/* media: Images */
(function () {
  "use strict";
  var A = window.Admin;
  // nothing renders until the session is checked against the allowlist
  AdminAuth.requireAdmin().then(function (admin) {
    var content = A.Shell("media.html", 'Images', 'Every image the site uses, and whether it is there.', null, admin);
    if (!content) return;
    content.innerHTML = A.notice('Every image the public page uses, and where it is used. A path in red is referenced by something on the site but is not in the assets folder, which is how a broken picture starts.') + A.panel({ title: 'Images in use', flush: true, body: '<div id="list">' + A.empty('Loading', 'Checking every image.') + '</div>' });

    var box = document.getElementById('list');

    /* Where an image can be referenced from. The panel does not guess: it
       reads the same rows the public page reads, so this list is what is
       actually on the site rather than a folder listing that may be stale. */
    function gather() {
      return Promise.all([
        AdminAuth.client().from('section_items').select('section_key,title,image')
          .then(function (r) { return r; }),
        AdminAuth.client().from('organisations').select('name,register,mark')
          .then(function (r) { return r; }),
        AdminAuth.client().from('site_sections').select('key,label')
          .then(function (r) { return r; })
      ]).then(function (res) {
        var labels = {};
        if (!res[2].error) (res[2].data || []).forEach(function (s) { labels[s.key] = s.label; });

        var used = {};
        function note(path, where) {
          if (!path) return;
          (used[path] = used[path] || []).push(where);
        }
        if (!res[0].error) {
          (res[0].data || []).forEach(function (i) {
            note(i.image, (labels[i.section_key] || i.section_key) + ': ' + i.title);
          });
        }
        if (!res[1].error) {
          (res[1].data || []).forEach(function (o) {
            note(o.mark, (o.register === 'client' ? 'Clients' : 'Partners') + ': ' + o.name);
          });
        }
        return used;
      });
    }

    /* Does the file actually exist? A HEAD request per image, which is cheap
       and is the only way a static site can answer the question honestly. */
    function check(path) {
      return fetch('../' + path, { method: 'HEAD' })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    }

    gather().then(function (used) {
      var paths = Object.keys(used).sort();
      if (!paths.length) {
        box.innerHTML = A.empty('No images referenced',
          'Once sections, products or partners point at an image, every one of ' +
          'them is listed here with the places it is used.');
        return;
      }

      Promise.all(paths.map(check)).then(function (found) {
        box.innerHTML = A.table(['Preview', 'File', 'Used by', 'State'],
          paths.map(function (p, i) {
            var ok = found[i];
            return '<tr>' +
              '<td>' + (ok
                ? '<img src="../' + A.escapeHtml(p) + '" alt="" class="thumb" ' +
                  'width="56" height="40" loading="lazy" decoding="async" />'
                : '<span class="thumb thumb-missing" aria-hidden="true"></span>') + '</td>' +
              '<td><code>' + A.escapeHtml(p) + '</code></td>' +
              '<td>' + used[p].map(function (u) {
                  return '<div class="row-note">' + A.escapeHtml(u) + '</div>'; }).join('') + '</td>' +
              '<td>' + (ok ? '<span class="tag tag-live">present</span>'
                           : '<span class="tag tag-missing">missing</span>') + '</td>' +
            '</tr>';
          }).join(''));
      });
    });
  });
})();
