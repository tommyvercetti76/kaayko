/**
 * Kaayko store access modal — shared by the landing page and /about.
 *
 * One card serves both Store actions, so there is always a way back out:
 * the close button, the scrim, or Escape. Markup is injected on first use;
 * styling lives in css/storeAccess.css.
 *
 *   KaaykoStoreAccess.open("access",  { returnFocus: el, onOpen, onClose })
 *   KaaykoStoreAccess.open("request", { returnFocus: el })
 *   KaaykoStoreAccess.isOpen()
 *   KaaykoStoreAccess.close()
 */
(function (global) {
  "use strict";

  var MODES = {
    access:  { title: "Access",  sub: "Enter your invite code to open the store" },
    request: { title: "Request", sub: "No code yet? Ask us for one" }
  };

  var MAIL_TO = "rohan@kaayko.com";

  var SARCASM = [
    "Wrong, dumbass. Try again.",
    "Oh my God, you suck at this.",
    "That's not it, genius.",
    "Dude, seriously? That's your guess?",
    "This is pretty sad to watch.",
    "Are you actually stupid or just pretending?",
    "Holy crap, you're terrible at this.",
    "I've seen rocks with better problem-solving skills.",
    "Just give up. This isn't for you.",
    "Even Butters could do better.",
    "I'm actually impressed by how bad you are at this."
  ];

  var el = null;          // cached node references, built on first open
  var failures = 0;
  var returnFocus = null;
  var hooks = {};

  /* ── Code validation (same keys as js/secretStore.js) ───────────────── */
  function validateCode(v) {
    var decoys = ["admin", "password", "secret", "unlock", "kaayko"];
    if (decoys.indexOf(v.toLowerCase()) !== -1) return false;
    var keys = [
      function () { return String.fromCharCode(0x4d, 0x61, 0x61, 0x75); },
      function () { return global.atob("Q2hhcml6YXJk"); },
      function () { return [78, 97, 103, 112, 117, 114].map(function (c) { return String.fromCharCode(c); }).join(""); }
    ];
    return keys.some(function (fn) { return fn() === v; });
  }

  function requestMailto() {
    var subject = encodeURIComponent("Kaayko Store — Access Request");
    var body = encodeURIComponent(
      "Hi Kaayko team,\n\n" +
      "I'd like an invite code for the Kaayko store.\n\n" +
      "Name:\n" +
      "How I found Kaayko:\n" +
      "What I'm looking for:\n\n" +
      "Thanks,\n"
    );
    return "mailto:" + MAIL_TO + "?subject=" + subject + "&body=" + body;
  }

  /* ── Markup ─────────────────────────────────────────────────────────── */
  function build() {
    var root = document.createElement("div");
    root.className = "modal";
    root.id = "store-modal";
    root.hidden = true;
    root.innerHTML =
      '<div class="modal-scrim" data-close></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<button class="modal-close" type="button" data-close aria-label="Close">&times;</button>' +
        '<p class="modal-eyebrow">Kaayko Store</p>' +
        '<h2 class="modal-title" id="modal-title">Access</h2>' +
        '<p class="modal-sub" id="modal-sub"></p>' +
        '<div class="modal-body" id="modal-body-code">' +
          '<div class="store-field-wrap" id="code-wrap">' +
            '<input class="store-input" id="code-input" type="text" inputmode="text" ' +
              'placeholder="A1B2C3D4" autocomplete="off" autocorrect="off" ' +
              'autocapitalize="characters" spellcheck="false" maxlength="20" aria-label="Invite code">' +
            '<button class="store-arrow" id="code-submit" type="button" aria-label="Submit code">&rarr;</button>' +
          '</div>' +
          '<p class="store-hint" id="code-hint" aria-live="polite"></p>' +
        '</div>' +
        '<div class="modal-body" id="modal-body-request" hidden>' +
          '<p class="modal-copy">We\'ll open a draft in your mail app — tell us who you are and we\'ll send a code back.</p>' +
          '<a class="modal-action" id="request-mail" href="' + requestMailto() + '">Open email draft</a>' +
          '<p class="modal-fallback">Or write to <a href="mailto:' + MAIL_TO + '">' + MAIL_TO + '</a></p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    el = {
      root:    root,
      title:   root.querySelector("#modal-title"),
      sub:     root.querySelector("#modal-sub"),
      code:    root.querySelector("#modal-body-code"),
      request: root.querySelector("#modal-body-request"),
      input:   root.querySelector("#code-input"),
      wrap:    root.querySelector("#code-wrap"),
      hint:    root.querySelector("#code-hint"),
      submit:  root.querySelector("#code-submit"),
      mail:    root.querySelector("#request-mail")
    };

    root.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]")) close();
    });

    // Keep focus inside the card while it is open
    root.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusables = Array.prototype.slice
        .call(root.querySelectorAll("button, a[href], input:not([disabled])"))
        .filter(function (node) { return node.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last  = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    el.submit.addEventListener("click", submitCode);
    el.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") submitCode();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) close();
    });

    return el;
  }

  /* ── Form state ─────────────────────────────────────────────────────── */
  function setHint(msg, state /* "error" | "ok" | null */) {
    el.wrap.classList.remove("error", "ok");
    el.hint.classList.remove("error", "ok", "visible");
    el.hint.textContent = msg;
    if (state) {
      el.wrap.classList.add(state);
      el.hint.classList.add(state, "visible");
    }
  }

  function reset() {
    failures = 0;
    el.input.value = "";
    el.input.disabled = false;
    el.submit.disabled = false;
    el.wrap.classList.remove("error", "ok");
    el.hint.textContent = "";
    el.hint.classList.remove("error", "ok", "visible");
  }

  function submitCode() {
    var val = el.input.value.trim();

    if (!val) return setHint("Enter your invite code.", "error");
    if (!/^[a-zA-Z0-9]+$/.test(val)) {
      return setHint("Letters and numbers only — no spaces or symbols.", "error");
    }
    if (val.length < 4) return setHint("Code must be at least 4 characters.", "error");

    if (!validateCode(val)) {
      failures++;
      setHint(SARCASM[Math.min(failures - 1, SARCASM.length - 1)], "error");
      el.input.value = "";
      el.input.focus();
      return;
    }

    global.localStorage.setItem(global.atob("a2FheWtvU3RvcmVBY2Nlc3M="), global.atob("Z3JhbnRlZA=="));

    // Haptic confirmation (gentle double-pulse)
    if (global.navigator.vibrate) global.navigator.vibrate([30, 60, 30]);

    // On a store-only domain (kaay.store) we are already standing on the
    // store, so opening a second tab to /store is wrong. The caller passes
    // onGranted to reveal the page in place instead.
    if (typeof hooks.onGranted === "function") {
      hooks.onGranted();
      setHint("Access granted.", "ok");
      el.input.disabled = true;
      el.submit.disabled = true;
      global.setTimeout(close, 900);
      return;
    }

    // Open the tab NOW — must be synchronous inside the user gesture, or the
    // browser treats it as a blocked popup
    global.open("/store", "_blank", "noopener,noreferrer");

    setHint("Access granted. Opening store.", "ok");
    el.input.disabled = true;
    el.submit.disabled = true;
    global.setTimeout(close, 1400);
  }

  /* ── Open / close ───────────────────────────────────────────────────── */
  function isOpen() {
    return !!el && !el.root.hidden;
  }

  function open(mode, opts) {
    if (!el) build();
    opts = opts || {};
    hooks = opts;

    var copy = MODES[mode] || MODES.access;
    el.title.textContent = copy.title;
    el.sub.textContent   = copy.sub;
    el.code.hidden    = mode !== "access";
    el.request.hidden = mode !== "request";
    returnFocus = opts.returnFocus || null;

    reset();
    el.root.hidden = false;
    // Next frame, so the entry transition actually runs
    global.requestAnimationFrame(function () { el.root.classList.add("modal--open"); });
    global.setTimeout(function () {
      (mode === "access" ? el.input : el.mail).focus();
    }, 260);

    if (typeof opts.onOpen === "function") opts.onOpen();
  }

  function close() {
    if (!isOpen()) return;
    el.root.classList.remove("modal--open");
    global.setTimeout(function () {
      el.root.hidden = true;
      reset();
    }, 320);

    if (returnFocus) {
      returnFocus.focus();
      returnFocus = null;
    }

    if (typeof hooks.onClose === "function") hooks.onClose();
    hooks = {};
  }

  global.KaaykoStoreAccess = { open: open, close: close, isOpen: isOpen };
})(window);
