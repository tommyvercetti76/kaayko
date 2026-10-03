# Kaayko Stories: edit log

Every change to Stories gets an entry here, newest first. That covers the library
(`src/stories.html`), every chapter (`src/stories/*.html`), and their CSS and JS
(`src/css/stories*.css`, `src/js/stories/*.js`).

Each entry says what changed, why, the commit, whether it is live, and how it was
checked. Copy edits list every change made to the text. The author's voice (inverted
word order, the asides, the short sentences) is never "corrected", and an entry says
so when a reviewer suggested it.

How to edit Stories yourself: [README.md](README.md).

---

## 2026-10-03 16:40 CDT · Nothing moves on load: bar height, matched fallback fonts

- **Commit:** this entry's commit (`git log -1 -- docs/stories/EDIT-LOG.md`)
- **Live:** deployed to kaayko.com and kaay.store, after preview channel `lake-clock`.
- **Why:** after the 15:57 preload, `npm run browser-check` still measured the chapter at
  0.08–0.20 layout shift on desktop, varying run to run. Three causes, each found by the
  check naming what moved:
  1. The top bar is 73 px on desktop and 69 px on phones; CSS assumed 64 px until
     `story.js` measured it, so the whole chapter dropped 9 px.
  2. The route line ("Moran Point · Desert View · …") and the byline are Barlow Condensed,
     which was not preloaded. Its fallback is wider, so the route wrapped to two lines and
     snapped back to one when Barlow arrived: the 25 px jump.
  3. Unadjusted Georgia is 10% wider than IM Fell (title, drop cap) and 8% narrower than
     Literata (body), so the swap re-wrapped text.
- **`src/stories/never-give-up.html`, `src/stories.html`:** one inline line right after the
  bar sets `--barh` from the bar's real height before first paint. Barlow Condensed 600
  (15 KB) is preloaded.
- **`src/css/stories-fonts.css`, `src/css/stories.css`:** three fallback faces, Georgia and
  Arial Narrow scaled to each real face's measured width and line metrics (`size-adjust`,
  `ascent-override`, `descent-override`), placed second in `--f-display`, `--f-text` and
  `--f-label`. Readers see the real fonts as before; the fallbacks only fill the first
  fraction of a second, at the right size.
- **Checked:** four runs each, desktop: 0.082 / 0.097 / 0.021 / 0.097 before the Barlow fix,
  0.021 ×4 after; phone 0.000. Library 0.000. Reading-time checker: all five places agree.
- **Text:** unchanged.

---

## 2026-10-03 15:57 CDT · Preload the drop-cap font

- **Commit:** this entry's commit (`git log -1 -- docs/stories/EDIT-LOG.md`)
- **Live:** deployed to kaayko.com and kaay.store at 15:55 CDT, after preview channel `lake-clock`.
- **`src/stories/never-give-up.html`:** added a preload for
  `/fonts/stories/im-fell-double-pica-normal-400.woff2`, the face of the Part 1 drop cap
  and the title. The library page already preloaded it; the chapter did not.
- **Why:** the new `npm run browser-check` measured a 0.10–0.13 layout shift on desktop
  (over Google's 0.1 "good" line). The drop cap first painted in Georgia, which is taller,
  then the real face arrived at about 0.2 s and the lede and everything under it moved up
  25 px.
- **Checked:** browser-check on desktop, before and after: 0.103 / 0.132 before, 0.080 after;
  phone 0.000 both. Nothing a reader sees changed except that the jump is smaller.
- **Still open:** the swap is smaller but not gone, because a preload starts the download
  early and cannot promise it lands before first paint. The full fix is a size-matched
  Georgia fallback (`size-adjust`/`ascent-override` on a local `@font-face`), not done.

---

## 2026-10-02 18:10 CDT · Reading-time checker, editing guide, one word of count

- **Commit:** this entry's commit (`git log -1 -- docs/stories/EDIT-LOG.md`)
- **Live:** deployed to kaayko.com and kaay.store.
- **New:** `scripts/stories-reading-time.js`, a read-only checker. It counts a chapter's
  body words and reports whether the byline, postmark, ring, Contents and structured data
  agree. It exits 1 if they don't.
- **New:** [README.md](README.md), with where everything is and how to edit, deploy and
  add a chapter yourself.
- **`src/stories/never-give-up.html`:** structured-data `wordCount` changed from 3978 to
  3977. The checker counts one token in Part 1 differently from the one-off count used in
  `e632870`; the checker is now the reference. Nothing a reader sees changed.

---

## 2026-10-02 18:01 CDT · Review pass on the UX audit

- **Commit:** `e632870`
- **Live:** deployed to kaayko.com and kaay.store at 18:01 CDT, after preview channel `stories-pass`.
- **Source:** `~/Desktop/kaayko-stories-ux-audit.md` (2 Oct). Only findings that held up
  against the code and the live pages were acted on. About a third of the audit was stale
  (written before `2794d98`) or wrong (its tool ignored `aria-hidden`, scripts and CSS).

### `src/stories/never-give-up.html`

| What | Before | After | Why |
|---|---|---|---|
| Lake links: lede, Part 1, three stamps (6 links) | `/paddlingout/forecast?id=cottonwood` · `…taylorpark` · `…powell` | `/paddlingout/cottonwood-lake-colorado` · `/paddlingout/taylor-park-reservoir-colorado` · `/paddlingout/lake-powell-utah` | `robots.txt` disallows `/paddlingout/forecast?`, so those links gave search engines nothing. The spot pages show the live score and link on to the forecast (audit RD-10, SEO-4) |
| Part 1, last paragraph | `<em>out there. D</em>isappear` | `<em>out there</em>. Disappear` | The italic split the word in two (Appendix A #1) |
| Part 2, the old man's map | `…Desert View </em>Points<em>. </em>` | `…Desert View Points</em>.` | The place name is whole, and the full stop is upright (A #2) |
| Part 3, Wahweap Bay | `the lake<em>. </em>Ahead of my schedule I was.<em> </em>` | `the lake. Ahead of my schedule I was. ` | Italic full stop and an empty italic (A #5) |
| Part 4, the Red Jeep | `<em>Red Jeep </em>soon<em> </em>showed up` | `<em>Red Jeep</em> soon showed up` | Same class: empty italic |
| Part 4, the Marine | `<em>Marine </em>did<em> not</em> want` | `<em>Marine</em> did <em>not</em> want` | Same class: the space was inside the italic |
| Part 5, the shrubbery | `<em>Pumba.</em>` | `<em>Pumbaa</em>.` | The character is Pumbaa, and the full stop is upright (A #10) |
| Part 5, back at Lone Rock | `<em>Lone Rock </em>again<em>. </em>Scanning<em> </em>the water` | `<em>Lone Rock</em> again. Scanning the water` | Same class as A #5; the audit missed it |
| Part 6, good practice | `by<em> ‘good practice’</em>.<em> </em>They` | `by <em>‘good practice’</em>. They` | Same class: empty italic |
| Reading time: byline, postmark, ring, structured data | 15 min · `PT15M` · `wordCount 3775` | 16 min · `PT16M` · `wordCount 3977` | 3,977 words at 250 wpm is 15.9 min, and the six part times already added up to 16. The parts were right; the total was not (RD-2) |
| Top bar | one link "Kaayko Stories · Paddling Out 2" → `/stories` | "Kaayko" → `/`, "Stories" → `/stories`; "Paddling Out 2" is a plain label | There was no way home, and the label named a book while the link went to the library (IA-5, IA-6) |
| Reading-mode legend (screen readers) | `Layout` | `Reading mode` | Same name as the library's setting (IA-7) |
| After FIN | stamps, then tag chips, then the footer | stamps, then "Paddling Out 2 has seven more chapters. They are still sealed.", **Back to the library**, **Share this story**, then the tags | The story ended with nowhere to go (RD-8). The line about the next chapter does not claim which chapter opens next |

The words of the story were not changed beyond the rows above.

### `src/stories.html`

| What | Before | After | Why |
|---|---|---|---|
| Lake Powell card image | `loading="lazy"` | `loading="eager" fetchpriority="high"` | At 375 px it painted as a blank grey card for a second or two; it is the largest thing on a phone's first screen. Not in the audit |
| Cottonwood card (directly behind it) | `loading="lazy"` | `loading="eager"` | Visible on the first screen too |
| Card labels | `Story III · Paddling Out 2`, `Story I · Paddling Out 1` | `Chapter III · …`, `Chapter I · …` | One word for one thing (IA-1) |
| Chapter list, Lake Powell row | `Unlocked` | `Open` | Matches the card; the reader did not unlock anything (IA-2) |
| Display legend | `Open stories as` | `Reading mode` | Same name as in the reader (IA-7) |
| Top bar | one link "Kaayko Stories · Library" → `/stories` | "Kaayko" → `/`, "Stories" → `/stories` (`aria-current`) | A way home (IA-6) |
| Headings | Book 2: chapter title h3, book name h4. Book 1: book h3, list "Stories" h4 | Each book h3 (`Paddling Out 2 · Chapter III`, `Paddling Out 1`); chapter title and "Chapters" h4 | Books now contain their chapters in the outline (IA-4, A11Y-2) |

### `src/css/stories.css`

- `.brand-name a`: the two bar links inherit colour and underline on hover and focus,
  with 8 px vertical padding for a bigger tap target.
- `.story-end*`: layout for the new block after FIN. `.story-end .btn` overrides the
  underline that `.story-foot a` gives every link.
- `.tags li`: plain muted text with wider gaps, no border. They looked like buttons and did
  nothing (RD-9). A `·` separator was tried and dropped, because it started a wrapped line.

### `src/js/stories/story.js`

- Share: uses `navigator.share` with the canonical URL where it exists, otherwise copies
  the link and announces "Link copied." The button stays hidden where neither works. It is
  un-hidden before Book mode lays out its pages.

### How it was checked

- `npm run verify`: all checks and all 141 tests pass. `scripts/verify-seo.js` gives the
  same output before and after (its failures are older and unrelated to Stories).
- Preview channel at 375 px:
  - The library card shows its photo on first paint.
  - The heading outline reads h1 › h2 › h3 › h4.
  - Bar links go to `/` and `/stories`.
  - The six lake links go to the spot pages; all three return 200.
  - The end block, Share and the tags render, with no console errors.
- Preview channel at 1440 px, Book mode: the last spread holds the stamp, the end block and
  the tags. Share, with the share sheet stubbed, passes `https://kaayko.com/stories/never-give-up`.
- Live after deploy, all 200:
  - kaayko.com: `/stories`, `/stories/never-give-up`, `/`, `/paddlingout`, `/paddlingout/lake-powell-utah`, `/about`, `/store`
  - kaay.store: `/`, `/store`, `/cart`, `/stories`
- kaay.store home at 375 px renders. No store file was in this commit.

### Not done in this pass, and why

| Audit item | Status |
|---|---|
| Hero rebuild, one "Start reading" button, explaining "Sealed" (LIB-1–4) | Next pass; needs your call on what "sealed" means |
| Highlighter works on plain selection, without the Display toggle (RD-3) | Next pass. The keyboard path (Cmd/Ctrl+Shift+H) already exists but isn't mentioned on the page |
| Theme colour per theme, 1200×630 share card, three missing meta tags on the story page | Small; next pass |
| Responsive photo sizes and formats (RD-12) | Needs an image pipeline step |
| "Notify me" by email | Blocked: no mail sender yet (`MAIL_SMTP_URL`), and it would mean storing reader emails |
| Live Paddle Score on every stamp | Declined for now: the score misses about 2 in 3 dangerous days on clean data |
| Renaming "HIGH lighter" / "Lit" | Your call; the joke looks deliberate |
| Lake map that reshapes, day rail, passport, EPUB, narration | Out of scope with one open chapter |

---

## 2026-10-02 17:41 CDT · Never Give Up copyedit

- **Commit:** `2794d98` (live)
- Articles, tense, agreement, punctuation, compound words and the two-period ellipses, from
  `never-give-up-grammar-review.md`. The commit message lists every class of change.
- Left exactly as written, by design: "Ahead of my schedule I was", "Thoughts!", "Angels.",
  "Move now, mourn later", "God is great", the internal dialogue, the short sentences.

## 2026-10-01 · Stories built

- **Commits:** 13, `da92b18` (17:50) to `19fe11c` (22:12)
- `/reads` became `/stories`, with the library, two books and Chapter III of Paddling Out 2.
- The reader has scroll and book layouts, the HIGH lighter, the compass, and the stamps
  for lakes on Paddling Out.
- See `git log -- src/stories.html src/stories src/js/stories src/css/stories.css`.
