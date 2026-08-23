/* settings: Settings */
(function () {
  "use strict";
  var A = window.Admin;
  var content = A.Shell("settings.html", 'Settings', 'Practice details, form behaviour and access.', null);
  if (!content) return;
  content.innerHTML = A.notice('This panel is the interface only. Saving is not wired up, so the fields below hold '
      + 'their current values from the public site and nothing is written anywhere.') +
    A.panel({
      title: 'Practice details',
      note: 'Used in the footer, the structured data and the request page.',
      body: '<div class="field-row">' +
        '<div class="field"><label for="s-name">Practice name</label>' +
        '<input id="s-name" type="text" value="HaveStack Technologies" /></div>' +
        '<div class="field"><label for="s-email">Contact address</label>' +
        '<input id="s-email" type="email" value="hello@havestack.tech" /></div>' +
        '<div class="field"><label for="s-city">Base</label>' +
        '<input id="s-city" type="text" value="Dhaka, Bangladesh" /></div>' +
        '<div class="field"><label for="s-domain">Live domain</label>' +
        '<input id="s-domain" type="url" value="https://havestack.tech/" />' +
        '<span class="hint">Used for the canonical tag and the social card.</span></div>' +
        '<div class="field full"><label for="s-desc">Description</label>' +
        '<textarea id="s-desc">Enterprise software built, integrated and maintained for institutions in Bangladesh.</textarea></div>' +
      '</div>',
      foot: '<button class="btn btn-sm" type="button">Discard</button>' +
            '<button class="btn btn-key btn-sm" type="button" data-stub="Saving is not wired up yet.">Save changes</button>'
    }) +
    A.panel({
      title: 'Request form',
      note: 'Where submitted briefs are delivered.',
      body: '<div class="field-row">' +
        '<div class="field"><label for="s-reply">Reply target, working days</label>' +
        '<input id="s-reply" type="number" value="2" min="1" /></div>' +
        '<div class="field"><label for="s-len">Meeting length, minutes</label>' +
        '<input id="s-len" type="number" value="40" min="10" /></div>' +
      '</div>',
      foot: '<button class="btn btn-key btn-sm" type="button" data-stub="Saving is not wired up yet.">Save changes</button>'
    }) +
    A.panel({
      title: 'Access',
      note: 'Who can sign in to this panel.',
      flush: true,
      body: A.empty('No accounts yet', 'Administrator accounts will be listed here once sign in is connected.')
    });
})();
