/*
 * Kortex campaign-tag helper, shared by the public page and the admin app.
 * Reads the UTM tags a pasted address already carries and says what they mean
 * in plain words. No dependencies; defines window.KortexUtm.
 */
(function () {
  'use strict';
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var LABELS = { utm_source: 'source', utm_medium: 'medium', utm_campaign: 'campaign', utm_term: 'term', utm_content: 'content' };

  function decode(input) {
    var url;
    try { url = new URL(String(input || '').trim()); } catch (e) { return { ok: false, tags: {}, cleanUrl: null, hasTags: false }; }
    var tags = {};
    for (var i = 0; i < KEYS.length; i++) {
      var v = url.searchParams.get(KEYS[i]);
      if (v) { tags[KEYS[i]] = v; url.searchParams.delete(KEYS[i]); }
    }
    return { ok: true, tags: tags, cleanUrl: url.toString(), hasTags: Object.keys(tags).length > 0 };
  }

  function sentence(tags) {
    var parts = [];
    if (tags.utm_source) parts.push('from ' + tags.utm_source);
    if (tags.utm_medium) parts.push('via ' + tags.utm_medium);
    if (tags.utm_campaign) parts.push('for the campaign “' + tags.utm_campaign + '”');
    if (tags.utm_term) parts.push('term “' + tags.utm_term + '”');
    if (tags.utm_content) parts.push('variant “' + tags.utm_content + '”');
    return parts.length ? 'Your analytics will count these visits as coming ' + parts.join(', ') + '.' : '';
  }

  function chips(tags) {
    return KEYS.filter(function (k) { return tags[k]; }).map(function (k) { return { key: k, label: LABELS[k], value: tags[k] }; });
  }

  window.KortexUtm = { KEYS: KEYS, LABELS: LABELS, decode: decode, sentence: sentence, chips: chips };
})();
