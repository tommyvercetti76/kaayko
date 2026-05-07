/**
 * Posthog Product Analytics — Kortex
 * Tracks activation funnel: page_view → signup → first_link → first_campaign → upgrade
 */
(function() {
  const POSTHOG_KEY = 'phc_kortex_placeholder';
  const POSTHOG_HOST = 'https://us.i.posthog.com';

  // Load Posthog SDK
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing startSessionRecording stopSessionRecording sessionRecordingStarted loadToolbar get_property getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSurvey getSurveyResponse".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false
  });

  // Identify user if logged in
  function identifyUser() {
    const tenantId = localStorage.getItem('kaayko_tenant_id');
    const uid = localStorage.getItem('kaayko_uid');
    if (uid) {
      posthog.identify(uid, { tenant_id: tenantId || 'unknown' });
    }
  }

  // Track key activation events
  window.phTrack = function(event, properties) {
    if (window.posthog) {
      posthog.capture(event, properties || {});
    }
  };

  // Auto-identify on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', identifyUser);
  } else {
    identifyUser();
  }
})();
