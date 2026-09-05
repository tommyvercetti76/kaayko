/**
 * The one buyer-facing support address.
 *
 * It used to be hardcoded in six places across Terms, Returns, Shipping and the
 * store Privacy page — all of them a personal Gmail. Changing it meant six edits
 * and missing one meant a buyer emailing an address nobody reads.
 *
 * OWNER ACTION REQUIRED before live sales:
 *   The backend already treats `orders@kaayko.com` as the support address
 *   (kaayko-api/functions/api/email/policy.js:36). If that mailbox is real and
 *   monitored, change SUPPORT_EMAIL below to it and this whole surface follows.
 *   It is deliberately NOT changed here: a returns page pointing at a mailbox
 *   that bounces is worse than one pointing at a personal inbox that works.
 *
 * This is the BUYER address. The OWNER notification address is separate and
 * lives server-side in api/email/notifyAddress.js (ORDER_NOTIFY_EMAIL env var),
 * because the person who gets "you have a new order" is not necessarily the
 * address a customer should write to. Keep them distinct.
 */
(function () {
  var SUPPORT_EMAIL = 'rohanramekar17@gmail.com';

  // Every anchor marked data-support-email gets the address as both href and,
  // when it has no text of its own, its label. The markup keeps a working
  // mailto: inline, so the page is still correct with JavaScript disabled.
  function apply() {
    document.querySelectorAll('a[data-support-email]').forEach(function (a) {
      a.href = 'mailto:' + SUPPORT_EMAIL;
      if (a.dataset.supportEmail === 'text' || !a.textContent.trim()) {
        a.textContent = SUPPORT_EMAIL;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  window.KAAYKO_SUPPORT_EMAIL = SUPPORT_EMAIL;
})();
