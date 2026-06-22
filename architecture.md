# Architecture & authoring guide

A modular, **zero-build** personal site. Every card and every long-form body is
driven by a Markdown file in `content/`. To add a project, a post, or a whole
new tab you write Markdown and push — no JS edits, no build step.

It runs on a small client-side React runtime (`support.js`) that renders each
page from an inline `<x-dc>` template. The application layer (`js/app.js` +
`js/pages/*.js`) loads the Markdown and feeds it into the existing, untouched
page templates.

---

## TL;DR — how do I…

| I want to… | Do this |
|---|---|
| Add a project | Copy the `content/projects/_template/` folder → `content/projects/my-thing/` (keep `index.md`), edit, drop any images in the folder, push. |
| Add a blog post / thought | Copy `content/thoughts/_template/` → `content/thoughts/my-post/`, edit `index.md`, push. |
| Add a book | Copy `content/reading/books/_template/` → `content/reading/books/<slug>/`, edit `index.md`, drop a `cover.jpg` in the folder. |
| Add an article / podcast / resource / restaurant | Add an entry under `items:` in the relevant single list file (e.g. `content/reading/articles.md`). |
| Edit page copy (hero, intros, people list) | Edit the `content/<page>/page.md` frontmatter. |
| Change nav, brand, footer, social links | Edit `content/site.config.json`. |
| Add a whole new tab | See **Adding a new tab** below. |
| Use bold/italic/links/images/video | Just write Markdown — it renders everywhere (see **Markdown**). |

After a push, the **build-manifests** GitHub Action regenerates the folder
indexes so new files appear. (Locally you can run it yourself —
`node .github/scripts/build-manifests.mjs` — or just edit `manifest.json` by hand.)

---

## File layout

```
support.js                  # vendored React runtime — DO NOT EDIT (it's generated)
.nojekyll                   # makes GitHub Pages serve _underscore files & folders
favicon.svg                 # site icon — linked from every page's <head>

# Pages = one index.html per folder → clean URLs (the page filename never shows):
index.html                  # HOME  → served at  <site>/
projects/index.html         #       →            <site>/projects/
thoughts/index.html         #       →            <site>/thoughts/
reading/index.html          #       →            <site>/reading/
misc/index.html             #       →            <site>/misc/
_template.dc.html           # copy to <newtab>/index.html to create a tab

# Shared components MUST stay at the site root (the runtime fetches them as
# ./<Name>.dc.html relative to <base>); they're never shown in a URL anyway:
SiteNav.dc.html             # nav — renders from site.config.json
SiteFooter.dc.html          # footer — renders from site.config.json

js/
  app.js                    # window.Site: content loading, markdown, plumbing, UI helpers
  pages/
    Home.js Projects.js Thoughts.js Reading.js Misc.js
    _Template.js            # copy to create a new tab's logic

content/
  site.config.json          # brand, nav sections, footer, socials
  home/page.md              # hero bio + featured tiles
  projects/                 # PER-ITEM FOLDERS (+ manifest.json, ideas.md list)
    _template/index.md      # copy this folder to add a project
    field-notes/index.md    # + co-located assets, e.g. field-notes/cover.png
    …
  thoughts/                 # PER-ITEM FOLDERS (+ manifest.json)
    _template/index.md   digital-notebook/index.md   …
  reading/                  # LIST files: resources.md podcasts.md articles.md + page.md
    books/                  # PER-ITEM FOLDERS (+ manifest.json)
      _template/index.md   pilgrim-at-tinker-creek/index.md   …
  misc/                     # page.md (copy + fallbacks) + restaurants.md (map pins)
  data/                     # biking.json (Strava) + pictures.json (Photos) —
                            #   committed placeholders, overwritten by the prefetch Action

.github/
  workflows/ build-manifests.yml  prefetch-data.yml
  scripts/   build-manifests.mjs  strava.mjs  photos.mjs
```

---

## URLs & routing

Clean URLs come from the static **folder + `index.html`** convention — no router,
no server. `projects/index.html` is served at `<site>/projects/`; the home page
is `index.html` at the site root. The `.dc.html` files and `support.js` never
appear in the address bar.

The one wrinkle: because pages live in subfolders, each page has a
**depth-relative `<base href>`** as the first thing in `<head>` — `./` for the
home page (at the root) and `../` for the one-folder-deep section pages. The base
resolves to the **site root**, so all relative URLs — `./support.js`, `./js/*`,
`content/*`, and the runtime's `./SiteNav.dc.html` component fetches — work
regardless of folder depth *and regardless of where the site is hosted*. (The
runtime hard-codes that sibling fetch and can't be edited, so `<base>` is what
lets shared components live at the root while pages nest.) A site-wide guard in
`app.js` cancels bare `href="#"` clicks so they don't navigate under `<base>`.

> **Hosting is path-independent.** Because the base is relative, the same files
> work unchanged at a GitHub project page (`lspaya05.github.io/lspaya/`), a user
> page (`lspaya05.github.io/`), a custom domain, or any local server — no base
> edits needed. The only rule: a page's `<base>` must match its depth (`./` at
> root, `../` one deep, `../../` two deep).

## How a page renders

1. Each page `<head>` sets a depth-relative `<base>` (here `../`, one folder deep),
   then loads three scripts in order:
   ```html
   <base href="../">                            <!-- ./ on the home page -->
   <link rel="icon" href="favicon.svg">         <!-- resolves via <base> -->
   <script src="./support.js"></script>        <!-- runtime -->
   <script src="./js/app.js"></script>          <!-- window.Site -->
   <script src="./js/pages/Projects.js"></script>
   ```
2. The page's `<script data-dc-script>` is a uniform shim:
   ```js
   class Component extends DCLogic {
     state = Site.initialState('projects');
     componentDidMount(){ Site.mount(this, 'projects'); }
     componentDidUpdate(p){ Site.updated(this, 'projects', p); }
     componentWillUnmount(){ Site.unmount(this, 'projects'); }
     renderVals(){ return Site.render(this, 'projects'); }
   }
   ```
3. `Site.mount` calls the page module's async `load()` (fetch + parse Markdown),
   stores the result via `setState`, and re-renders. `Site.render` calls the
   module's `build(self, data)`, which returns the exact object shape the HTML
   template's `{{ bindings }}` expect. Cards are empty for the brief moment
   before the local fetches resolve, then populate.

Markdown is injected as real React elements (`renderInline` → `<span>`,
`renderMarkdown` → `<div class="md">`), which the runtime renders in place — so
the finished HTML/design never had to change, only its data source.

**Images are built in JS, not written in the template.** A card/hero cover comes
from a `{{ x.cover }}` text slot whose value is a React `<img>` produced by
`Site.cover(item.image, alt)` in the page module (or `null` → the gradient
placeholder shows through). This is deliberate: an `<img src="{{ x.image }}">`
written literally in the template would make the browser eagerly fetch the
*unrendered* string `{{ x.image }}` (a guaranteed 404) while parsing the inline
`<x-dc>`, before the runtime ever runs. **Rule for adding imagery:** put a
`{{ … }}` slot in the template and build the element in the module — never place
`{{ }}` inside a `src` (or other URL attribute the browser preloads).

---

## Markdown & frontmatter

- **Frontmatter** is YAML between `---` fences at the top of a file. Values with
  a `:` followed by a space need quoting; emphasis spans like
  `<span style="color:#1f1d1a;">x</span>` are fine unquoted (no space after the colon).
- **Inline fields** (`blurb`, `excerpt`, podcast `note`, hero copy) support inline
  Markdown — `**bold**`, `_italic_`, `[links](url)`.
- **Bodies** support full Markdown: headings, lists, quotes, images, and raw HTML
  **embeds** (`<iframe>`) from a host safelist (YouTube, Vimeo, Loom, Google Maps).
  Everything is sanitized with DOMPurify — a stray `<script>` is stripped.
- **Images**: set `image: ./cover.png` in frontmatter (co-locate the file in the
  same folder), an absolute `/path`, or a full URL. Omit it to keep the design's
  placeholder gradient.
- **Ordering**: per-item collections sort by `order:` (ascending) if present,
  else by `date:` (descending). `date` can be any display string for thoughts
  (sorting falls back to file order if dates aren't comparable — use `order:` to
  be explicit).

See `content/projects/_template/index.md` and `content/thoughts/_template/index.md`
for the full annotated field list.

### List files (articles, podcasts, resources, restaurants)

For link-only collections (no per-item assets), a single file whose frontmatter
holds an `items:` array. No body needed.
```yaml
---
items:
  - title: The Garden and the Stream
    cat: Web
    source: hapgood
---
```
(Books, projects, and thoughts use per-item **folders** instead — see above.)

---

## site.config.json

```json
{
  "brand": "Leonard",
  "sections": [
    { "key": "home", "label": "Home", "href": "." },
    { "key": "projects", "label": "Projects", "href": "projects/" }
  ],
  "footer": {
    "tagline": "…",
    "socials": [{ "label": "GitHub", "href": "https://…" }]
  }
}
```
`sections` drives the nav (order + active highlight via each page's
`active="<key>"`). Footer socials are matched by `label` (GitHub / LinkedIn / Email).

---

## Adding a new tab

1. `mkdir photos && cp _template.dc.html photos/index.html` (folder name = URL)
2. `cp js/pages/_Template.js js/pages/Photos.js`
3. In **both** files replace `NEWPAGE` with your key `photos`, and point the
   page module `<script src>` at `./js/pages/Photos.js`. (Leave `<base href>` as is.)
4. Create `content/photos/` and add items as folders — `content/photos/<slug>/index.md`
   (assets co-located in each folder). Copying any `_template/` folder in opts the
   collection into manifest generation.
5. Add a section to `content/site.config.json`:
   `{ "key": "photos", "label": "Photos", "href": "photos/" }`
6. Push. The tab appears in the nav at `/lspaya/photos/`.

(`_Template.js` renders a generic card grid. For a richer layout, model the
template/module on `Projects` — including its modal.)

---

## Integrations (GitHub Actions)

Static hosting can't hold secrets, so a scheduled Action prefetches data into
`content/data/*.json`; the browser only ever reads plain JSON. Both steps
**skip themselves** if their secrets aren't set, so nothing breaks before setup.
Until then, the pages use the `*_fallback` values in `content/misc/page.md`
(and the committed sample `biking.json`).

### Strava → `biking.json`  (Misc "Biking" block)
Repo **Settings → Secrets and variables → Actions**:
`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`.
Get a refresh token by creating an API app at <https://www.strava.com/settings/api>
and running the OAuth flow once with scope `activity:read_all`.

### Google Photos → `pictures.json`  (Misc "Pictures" slideshow)
Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
`GOOGLE_PHOTOS_ALBUM_ID`. Enable the Photos Library API, create OAuth creds, and
capture a refresh token with scope `photoslibrary.readonly`.
**Caveat:** Photos `baseUrl`s expire ~60 min. The daily build can outlast them;
if images break, run the workflow more often or change `photos.mjs` to download
the bytes into `assets/photos/` and emit local paths.

Run either workflow manually from the **Actions** tab (`workflow_dispatch`).

---

## `js/app.js` — the `Site` API (reference)

| Method | Purpose |
|---|---|
| `Site.collection(name)` | Load a per-item folder collection (`name` may be nested, e.g. `"reading/books"`): reads `manifest.json` of folder slugs, fetches each `<slug>/index.md` → sorted `[{slug, …frontmatter, body, image}]`. `image: ./x.png` resolves against the item's own folder. |
| `Site.list(name, file)` | Load a single list file → `{items, meta, intro}`. |
| `Site.page(name)` | Load `content/<name>/page.md` → `{data, body}`. |
| `Site.data(file)` | Load `content/data/<file>`; `null` if absent (used for graceful fallback). |
| `Site.config()` | Cached `site.config.json`. |
| `Site.renderMarkdown(md)` | Sanitized block Markdown → `<div class="md">`. |
| `Site.renderInline(md)` | Sanitized inline Markdown → `<span>`. |
| `Site.cover(src, alt)` | A cover `<img>` React element (absolute-fill) for a `{{ x.cover }}` slot, or `null` when no image. Built in JS so templates never eager-fetch a `{{ }}` `src`. |
| `Site.segmented(self,{def})` | The shared Blocks/List toggle (styles + handlers). |
| `Site.modalControls(self,key)` | `open/close/stop` + `isOpen/item`; Esc + scroll-lock handled by base plumbing when the module sets `modalKey`. |
| `Site.register / initialState / mount / updated / unmount / render` | Page registry + async render plumbing. |

A **page module** registers `{ state, modalKey?, load(self), build(self,data), mount?, updated?, unmount? }`.

---

## Constraints & gotchas

- **Serve over HTTP**, never `file://` — everything is `fetch`-based. The base is
  relative, so just serve the repo root: `python -m http.server`, then open
  `http://localhost:8000/` (home), `http://localhost:8000/projects/`, etc.
- **Clean URLs need the folder/`index.html` layout** — don't rename a page back
  to a flat `*.dc.html`, and keep each page's depth-relative `<base href>`
  (`./` at root, `../` one folder deep).
- **`.nojekyll` must stay** or Pages drops `_template.*` and any `_`-prefixed paths.
- **Never put `{{ }}` in a `src`/URL attribute** in a template — the browser
  eager-fetches the literal string (404). Build images in the module via
  `Site.cover(...)` and drop them in through a `{{ x.cover }}` text slot.
- **Don't edit `support.js`** — it's generated from a separate `dc-runtime` source.
- **Shared components stay at the root** (`SiteNav.dc.html`, `SiteFooter.dc.html`):
  the runtime fetches them as `./<Name>.dc.html` against `<base>`, so they can't
  move into folders.
- Vendor libs (marked, DOMPurify, js-yaml) load from jsDelivr at runtime — the
  site needs internet access on first paint to render Markdown.
