# kaayko.com home page: edit log

Every change to the landing page gets an entry here, newest first. The page is
`src/index.html`, `src/js/pages/home-entrance.js`, `src/js/pages/index.js` and
`src/fonts/home/`. Each entry records what changed, why, the commit, whether it is
live, how it was checked, and how to undo it.

---

## 2026-10-03 · Follow-up 2: the scramble starts scrambled

- **Commit:** `1905751` (on top of `d76d16e`)
- **Live:** kaayko.com and kaay.store.
- **Found by:** the before-and-after filmstrip of the live site. On a fast phone, one
  frame showed the finished headlines just before they scrambled. The overlay was
  created holding the final text, and only got random letters on the first tick 38 ms
  later.
- **Change:** `home-entrance.js` fills the overlay with random letters in the same step
  that creates it.
- **Checked:** a frame check (any headline readable before its scramble ends) flagged
  the live site before the fix 3 of 3 times. After the fix: 0 of 9 on the preview and
  0 of 6 on live (phone fast ×3, phone 4G, desktop, landscape), with one headline size
  throughout and only entrance transitions.

---

## 2026-10-03 · Follow-up: the layout can never paint before it is placed

- **Commit:** `d76d16e` (on top of `9184643`)
- **Live:** kaayko.com and kaay.store, after preview channel `home-entrance`.
- **Found by:** the first recording of the live site after `9184643`. The headlines
  shrank again on desktop. The browser had painted the parsed panels while the blocking
  `home-entrance.js` was still downloading (paint at 224 ms, script at 236 ms), so the
  old layout was painted and the correction animated. The preview runs had only been
  lucky with timing.

| File | Change |
|---|---|
| `src/index.html` | `home-entrance.js` loads in `<head>`, and a one-line inline call straight after `#pg-home` runs it, so nothing between the panels and their layout waits on the network. Headlines are hidden until `.is-placed` (CSS, with a 3 s no-JavaScript fallback). Headline size transitions apply only under `#pg-home.is-in`. `.is-placing` switches all transitions off while the layout is built. |
| `src/js/pages/home-entrance.js` | Now `window.KaaykoHomeEntrance(home)`. It adds `.is-placing` first, builds and veils, adds `.is-placed`, forces one style pass (`home.offsetWidth`), then lifts `.is-placing`. Chrome sometimes computes styles mid-script, which had given dividers a "before" position and headlines a "before" colour to animate from (2 of 3 fast-phone runs). |

**Checked:**
- 12 cold loads on the preview (5 phone fast, 3 desktop, 2 phone 4G, 2 landscape),
  then 6 on live (desktop, phone fast, phone 4G, two each).
- Every run: the panel count is set before the first paint, "Paddling Out" has a single
  size (50.4 px desktop, 28.8 px phone, 29.5 px landscape), and the only transitions are
  the divider draw, the wordmark fade and the touch subheadings.
- CLS at most 0.0018.
- Hover (desktop) and tap open/close (phone) re-tested, with no console errors.

---

## 2026-10-03 · One entrance instead of a page correcting itself on load

- **Commit:** `9184643`
- **Live:** kaayko.com and kaay.store, after preview channel `home-entrance`.

### Why

Rohan: "individual ones are fine but collectively when screen loads it feels glitchy."

Recorded cold first visits in headless Chrome, frame by frame, at desktop 1440 px,
phone 390 px (fast and throttled 4G) and phone landscape. The page painted before
its script ran, so:

- the headlines painted at twice their size, broken mid-word ("PAD / DLIN / G / OUT");
- one divider painted in the middle;
- 150–420 ms later the script set the panel count and added the other dividers;
- the hover transitions then animated that correction: headlines shrinking 104 → 50 px
  (phone 58 → 29 px), a divider sliding, dividers fanning out of a stack with three
  "kaayko" wordmarks drawn over each other on phones;
- the letter-scramble ran on top while the sizes were still changing, so random letters
  rewrapped every 38 ms ("Paddling Out" went 4, 2, 3, 1 lines tall);
- the Google web fonts swapped in after the first paint (on 4G, mid-animation);
- the designed entrance (dividers draw in, wordmarks fade at 880 ms) never ran, because
  `.page` already had `active` in the HTML.

### What changed

| File | Change |
|---|---|
| `src/js/pages/home-entrance.js` (new) | A blocking classic script placed straight after `#pg-home`. Before the first paint it removes disabled panels, sets `data-panels`, creates one divider and one wordmark per division, positions them, and sets each section's `aria-label`. Then it runs the entrance in two cues: `.is-in` on the first painted frame (dividers draw, wordmarks follow), and `.is-lit` once the fonts are loaded (headlines resolve from scrambled letters; on touch screens the subheadings rise in). The scramble runs in an overlay over the real headline, which holds its box while transparent, one unbreakable line per real line, so nothing resizes or rewraps. Fonts wait at most 1.5 s, and the page is fully shown by 3 s whatever happens. With reduced motion the page simply appears finished. Exposes `KaaykoHome.place()`. |
| `src/js/pages/index.js` | The panel removal, divider engine, `wrapLabel` and scramble moved to `home-entrance.js`. `updateSeam` now calls `KaaykoHome.place()`. The `menus` filter tolerates a panel that is already removed (null): without that, `index.js` threw and hover died. Caught on the preview. |
| `src/index.html` | Google Fonts replaced by self-hosted, preloaded fonts (`font-display: block`), plus `modulepreload` for `kit.js`. The static `.seam` and `.mark` were removed (the script creates them). The entrance hangs on `.is-in` instead of `.active`. Touch subheadings hang on `.is-lit`. New CSS for the veil and the scramble overlay. |
| `src/fonts/home/` (new) | Bebas Neue 400, Cormorant Garamond 500 italic and 500 normal (latin subset, from Google Fonts), with `OFL-bebasneue.txt` and `OFL-cormorantgaramond.txt`. |

Hover, focus, the Forge menu, tap-to-open on phones, tap-outside-to-close and the
`/#store` invite modal are unchanged in behaviour.

### Measured (same probe, cold cache)

| | Before | After |
|---|---|---|
| Headline sizes seen on load ("Paddling Out", desktop) | 26 sizes, 104 → 50 px | 1 size, 50.4 px |
| Same, phone | 24 sizes, 58.5 → 28.8 px | 1 size, 28.8 px |
| Transitions that ran on load | font-size, divider left/top | divider draw, wordmark fade, touch subheading rise |
| Layout shift (CLS) desktop / phone 4G | 0.034 / 0.029 | 0.002 / 0.0004 |
| Settled, desktop / phone fast / phone 4G | 1.07 s / 1.02 s / 1.62 s | 0.91 s / 0.84 s / 1.49 s |
| First text on phone 4G | ~0.52 s (wrong size, wrong font) | ~0.9 s (final size and font). Dividers start drawing ~0.63 s |

That last row is the trade-off: on a slow phone the headlines arrive about 0.4 s later
than the old wrong-sized ones did, and nothing moves after they arrive.

### Checked

- `npm run verify`: all checks and 141 tests pass. `verify-seo.js` shows no new findings.
- Preview, desktop: hovering Forge widens it (dividers 20/40/80 %), Stories likewise,
  and leaving restores 25/50/75 %. No console errors after the fix.
- Preview, phone 375 px with touch emulation: tapping Forge opens its menu, tapping
  outside closes it, and the screenshot shows the final layout.
- Preview: `/#store` opens the invite modal with the Store panel off.
- Filmstrips before and after at desktop, phone on 4G, and phone landscape.

### To undo (all three entries)

Restore the two changed files from `c3be544`, the commit before this work, and remove the two new ones. A
plain `git revert` of the three commits stops on a conflict in this log file, so don't
use it. This route was tested on a scratch copy and leaves `src/` byte-identical to
`c3be544`:

```
cd ~/Kaayko_v6/kaayko
git checkout c3be544 -- src/index.html src/js/pages/index.js
git rm -rq src/js/pages/home-entrance.js src/fonts/home
git commit -m "Home: back to the entrance before 3 Oct"
firebase deploy --only hosting:kaaykostore,hosting:kaay-store
git push
```

Or, instantly and without git: Firebase console → Hosting → kaaykostore (and
kaay-store) → release history → roll back to the release before 2026-10-03.
