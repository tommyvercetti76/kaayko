/**
 * KaaykoWaterType — the one vocabulary for naming a waterbody.
 *
 * AUDIT-2026-09-18 #8: the forecast page rendered "Lake alerts" over Trinity
 * River. `waterType` was on the payload the whole time; the presentation
 * ignored it.
 *
 * Measured against the live list (GET https://kaayko.com/api/paddlingOut,
 * 18 Sep 2026, 18 spots):
 *
 *     'lake'  -> 14      'river' -> 3      absent (undefined) -> 1
 *
 * The absent one is the community spot `community-lake-arlington-…`. That is
 * the case that decides the design: a spot with NO waterType must NOT be
 * called a lake. Guessing "lake" is exactly the over-confidence the project
 * forbids — "no data" gets the neutral noun ("water" / "Water alerts"), which
 * is true of every waterbody and claims nothing extra.
 *
 * The domain comes from the admin editor's own select
 * (src/admin/views/spots/spot-editor.js: '', lake, reservoir, river, coastal,
 * bay, canal) plus 'ramp', which src/paddlingout/forecast.html already
 * handles. Anything outside that set is treated as unknown rather than echoed
 * — an unrecognised value is not a licence to print arbitrary server text into
 * the page.
 *
 * Plain classic script, no module: every consumer here is a <script> tag.
 */
(function (global) {
  'use strict';

  var NEUTRAL = {
    key: 'unknown',
    known: false,
    noun: 'water',
    Noun: 'Water',
    theNoun: 'the water',
    alertsLabel: 'Water alerts',
    dismissLabel: 'Dismiss water alerts',
    saveLabel: 'Save this spot'
  };

  function entry(key, noun, Noun, theNoun) {
    return {
      key: key,
      known: true,
      noun: noun,
      Noun: Noun,
      theNoun: theNoun,
      alertsLabel: Noun + ' alerts',
      dismissLabel: 'Dismiss ' + noun + ' alerts',
      saveLabel: 'Save this ' + noun
    };
  }

  var TYPES = {
    lake:      entry('lake',      'lake',      'Lake',      'the lake'),
    reservoir: entry('reservoir', 'reservoir', 'Reservoir', 'the reservoir'),
    river:     entry('river',     'river',     'River',     'the river'),
    coastal:   entry('coastal',   'coast',     'Coastal',   'the coast'),
    bay:       entry('bay',       'bay',       'Bay',       'the bay'),
    canal:     entry('canal',     'canal',     'Canal',     'the canal'),
    ramp:      entry('ramp',      'boat ramp', 'Boat ramp', 'the boat ramp')
  };

  // 'Coastal alerts' reads better than 'Coast alerts'; the noun stays 'coast'.
  TYPES.coastal.alertsLabel = 'Coastal alerts';
  TYPES.coastal.dismissLabel = 'Dismiss coastal alerts';
  TYPES.coastal.saveLabel = 'Save this spot';

  /**
   * Resolve a raw waterType value to its vocabulary.
   * Missing, blank, non-string and unrecognised values all resolve to the
   * neutral entry — never to 'lake'.
   *
   * @param {*} raw - spot.waterType, straight off the API
   * @returns {{key:string, known:boolean, noun:string, Noun:string,
   *            theNoun:string, alertsLabel:string, dismissLabel:string,
   *            saveLabel:string}}
   */
  function resolve(raw) {
    if (typeof raw !== 'string') return NEUTRAL;
    var k = raw.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(TYPES, k) ? TYPES[k] : NEUTRAL;
  }

  /** Accepts a spot OR a bare waterType string. */
  function of(spotOrType) {
    if (spotOrType && typeof spotOrType === 'object') return resolve(spotOrType.waterType);
    return resolve(spotOrType);
  }

  function alertsLabel(spotOrType) { return of(spotOrType).alertsLabel; }
  function noun(spotOrType) { return of(spotOrType).noun; }

  global.KaaykoWaterType = {
    resolve: resolve,
    of: of,
    alertsLabel: alertsLabel,
    noun: noun,
    NEUTRAL: NEUTRAL,
    KNOWN_KEYS: Object.keys(TYPES)
  };
})(typeof window !== 'undefined' ? window : globalThis);
