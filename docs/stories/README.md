# Kaayko Stories: how it works and how to edit it yourself

**There is no API, database or admin editor for Stories.** Every chapter is one static HTML
file, served as it is by Firebase Hosting. The text you read on the site is the text in the
file, so editing a story means editing that file and deploying it.

## Where everything is

| What | File |
|---|---|
| The library (`/stories`) | `src/stories.html` |
| A chapter (`/stories/never-give-up`) | `src/stories/never-give-up.html` |
| That chapter's photos and stamps | `src/stories/never-give-up/` |
| Card art on the library | `src/stories/cards/*.webp` |
| The lake drawn behind the page | `src/stories/lakes/lake-powell.json` (USGS outline) |
| Styles | `src/css/stories.css`, `src/css/stories-fonts.css` |
| Reader behaviour: book mode, highlighter, Share | `src/js/stories/story.js`, `high.js` (flame and smoke), `ripples.js` (the lake lines) |
| Library behaviour | `src/js/stories/library.js` |
| What changed and when | [EDIT-LOG.md](EDIT-LOG.md) |

Clean URLs are on, so `src/stories/<slug>.html` is served at `/stories/<slug>` with no
routing changes.

## Editing the text of a chapter

1. Open `src/stories/never-give-up.html`. The story sits between
   `<div class="story-body">` and `<p class="finale">`, one `<p>` per paragraph.
   - **Italics:** `<em>…</em>`. Keep spaces and full stops outside the tags:
     `<em>Lone Rock</em> again.`, not `<em>Lone Rock </em>again<em>.</em>`.
   - **Inner monologue:** `<div class="voices"><p><em>‘…’</em></p>…</div>`
   - **A part heading:** `<h2 class="chapter" id="ch-N" …>`. Keep the `id`; Contents links to it.
   - **A photo:** `<figure class="plate">…<img … alt="…">…<figcaption>…</figcaption></figure>`.
     Every photo needs real `alt` text that describes it.
2. If you added or removed more than a few words, check the reading times:
   ```
   node scripts/stories-reading-time.js src/stories/never-give-up.html
   ```
   It lists any of the five places that disagree (byline, postmark, ring, Contents and the
   structured data) and the number each should be.
3. Update `"dateModified"` in the structured data near the top of the file.
4. Add an entry to [EDIT-LOG.md](EDIT-LOG.md): what you changed and why.
5. Commit, then deploy (next section).

## Deploying

From `~/Kaayko_v6/kaayko`:

```
git add -A src/stories src/stories.html docs/stories
git commit -m "Never Give Up: <what you changed>"
firebase hosting:channel:deploy try --only kaaykostore --expires 1d   # optional preview URL
firebase deploy --only hosting:kaaykostore,hosting:kaay-store
git push
```

- **Deploy both sites.** `kaayko.com` and `kaay.store` both serve `src/`. Leave out
  `kaay-link`: it is built from a different folder.
- **After deploying,** open the chapter on your phone, and open `kaay.store` too.
- **The pre-commit hook scans for secrets.** If it blocks a commit, do not bypass it.

## Adding a chapter

1. Copy `src/stories/never-give-up.html` to `src/stories/<slug>.html` and replace:
   - the title and description;
   - the `og:` and `twitter:` tags;
   - the structured data;
   - the postmark text, kicker, route, byline and Contents;
   - the body;
   - the "Lakes in this story" stamps.
2. Put its photos in `src/stories/<slug>/`, at about 1300 px on the long edge.
3. In `src/stories.html`, turn that chapter's sealed row into a link: copy the Lake Powell
   row's `<a class="toc-link toc-open" …>` shape. Then update "1 of 8 open", the library
   description and the structured data.
4. Add the URL to `scripts/generate-sitemap.js` and the page to `scripts/footer-links.js`
   (set `site`), then run `npm run verify`.
5. Link lake stamps to `/paddlingout/<spot-page>`, not to `/paddlingout/forecast?id=…`:
   search engines are blocked from the forecast URLs. Only lakes with a page in
   `src/paddlingout/` get a stamp.

## If you want to edit in a browser instead

That would be a real build, not a setting. It would need:
- a Firestore collection for chapters;
- an admin editor in Kortex, behind `requirePlatformAdmin` (publishing is a platform-owner
  action);
- a publish step that writes the static HTML, so search engines and Book mode keep working
  as they do now.

Ask for it as its own piece of work if editing the file gets in the way.
