/**
 * Kaayko storage notice — honest, non-hostile, dismissible (classic script).
 * ---------------------------------------------------------------------------
 * We store ONLY first-party functional data on the visitor's device
 * (units, favorites, "my area", a few "you've seen this" flags). We set no
 * first-party tracking cookies. A few pages load third parties that set their
 * own cookies — Stripe on checkout, PostHog on Kortex — which the Privacy page
 * spells out. This is a transparency notice, not a consent wall, because there
 * is nothing non-essential of ours to opt out of.
 *
 * It appears the FIRST time the visitor actually saves a preference (changing
 * units, starring a favorite, or locking an area) — never on page load, and only
 * on the Paddling Out surfaces where those actions exist. Dismissal is remembered
 * in localStorage (shows once per device).
 * Include on Paddling Out pages: <script src="/js/consent-notice.js" defer></script>
 */
(function () {
  'use strict';
  var ACK_KEY = 'kaayko_privacy_notice_ack';

  function acked() { try { return localStorage.getItem(ACK_KEY) === '1'; } catch (e) { return true; } }
  function ack() { try { localStorage.setItem(ACK_KEY, '1'); } catch (e) {} }

  function build() {
    if (acked()) return;
    if (document.getElementById('kaayko-consent')) return;

    var css = ''
      + '#kaayko-consent{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(0);'
      + 'z-index:99999;width:min(680px,calc(100% - 24px));'
      + 'background:linear-gradient(150deg,#0d0c0a,#111);color:#ede8df;'
      + 'border:1px solid rgba(217,189,123,0.34);border-radius:14px;'
      + 'box-shadow:0 12px 40px rgba(0,0,0,0.55);'
      + 'font-family:"Cormorant Garamond",Georgia,serif;'
      + 'padding:16px 18px;display:flex;gap:14px;align-items:center;'
      + 'animation:kkNoticeIn .45s cubic-bezier(0.16,1,0.3,1) both;}'
      + '@keyframes kkNoticeIn{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
      + '#kaayko-consent .kk-ico{flex:0 0 auto;width:34px;height:34px;border-radius:50%;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(217,189,123,0.14);border:1px solid rgba(217,189,123,0.3);color:#d9bd7b;}'
      + '#kaayko-consent .kk-copy{flex:1 1 auto;font-size:1.02rem;line-height:1.35;color:rgba(237,232,223,0.9);}'
      + '#kaayko-consent .kk-copy a{color:#d9bd7b;text-decoration:underline;text-underline-offset:2px;}'
      + '#kaayko-consent .kk-ok{flex:0 0 auto;cursor:pointer;border:none;'
      + 'background:linear-gradient(135deg,#d9bd7b,#b5935a);color:#141210;'
      + 'font-family:"Josefin Sans",Arial,sans-serif;font-weight:600;font-size:.8rem;'
      + 'letter-spacing:.08em;text-transform:uppercase;padding:.7rem 1.15rem;border-radius:10px;'
      + 'transition:filter .2s ease,transform .15s ease;}'
      + '#kaayko-consent .kk-ok:hover{filter:brightness(1.07);transform:translateY(-1px);}'
      + '#kaayko-consent.kk-hide{animation:kkNoticeOut .3s ease forwards;}'
      + '@keyframes kkNoticeOut{to{opacity:0;transform:translateX(-50%) translateY(14px)}}'
      + '@media (max-width:560px){#kaayko-consent{flex-wrap:wrap;bottom:10px;}'
      + '#kaayko-consent .kk-copy{font-size:.98rem;}#kaayko-consent .kk-ok{width:100%;}}'
      + '@media (prefers-reduced-motion:reduce){#kaayko-consent,#kaayko-consent.kk-hide{animation:none;}}';

    var style = document.createElement('style');
    style.id = 'kaayko-consent-style';
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'kaayko-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Storage notice');
    bar.innerHTML =
      '<span class="kk-ico" aria-hidden="true">'
      + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
      + '</span>'
      + '<span class="kk-copy">Kaayko saves your preferences — units, favorite lakes, your area — in this browser, on your device. '
      + 'We don’t track you across the web. A few pages load Stripe (checkout) or PostHog (Kortex analytics), which set their own cookies. '
      + '<a href="/privacy">How we handle your data</a>.</span>'
      + '<button type="button" class="kk-ok">Got it</button>';

    (document.body || document.documentElement).appendChild(bar);

    bar.querySelector('.kk-ok').addEventListener('click', function () {
      ack();
      bar.classList.add('kk-hide');
      setTimeout(function () { bar.remove(); }, 320);
      try { window.dispatchEvent(new CustomEvent('kaayko:notice-dismissed')); } catch (e) {}
    });
  }

  // Show the notice the first time the user SAVES a preference — not on load.
  // KaaykoPrefs dispatches these when a preference is written.
  function armTriggers() {
    if (acked()) return;
    var fired = false;
    function trigger() {
      if (fired || acked()) return;
      fired = true;
      build();
    }
    ['kaayko:unitschange', 'kaayko:favchange', 'kaayko:areachange'].forEach(function (evt) {
      window.addEventListener(evt, trigger);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', armTriggers, { once: true });
  } else {
    armTriggers();
  }
})();
