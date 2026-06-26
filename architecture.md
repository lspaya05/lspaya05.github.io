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
| Add a book | Add an entry under `items:` in `content/reading/books/index.md`; drop its cover in `content/reading/books/images/` and reference it `./images/<file>`. |
| Add an article / podcast / resource | Add an entry under `items:` in the relevant single list file (e.g. `content/reading/articles.md`). |
| Add a restaurant pin | Add an entry under `items:` in `content/misc/restaurants/index.md` (the map itself is `restaurants/map.html`). |
| Add a biking ride | Copy `content/misc/rides/_template/` → `rides/<slug>/`, edit `index.md`, drop a route image in the folder. |
| Edit page copy (hero, intros, people list) | Edit the `content/<page>/page.md` frontmatter. |
| Change footer text / social links | Edit `content/footer/page.md`. |
| Change nav or brand | Edit `content/site.config.json`. |
| Add a whole new tab | See **Adding a new tab** below. |
| Use bold/italic/links/images/video | Just write Markdown — it renders everywhere (see **Markdown**). |

After a push, the **build-manifests** GitHub Action regenerates the folder
indexes so new files appear. (Locally you can run it yourself —
`node .github/scripts/build-manifests.mjs` — or just edit `manifest.json` by hand.)

Each `manifest.json` is a **rich manifest**: an array of item objects baking in
the frontmatter cards/lists need — `[{ "slug": "billbreak", "title": "Billbreak",
"year": "2024", "cat": "iOS", "blurb": "…", "stack": ["Swift"] }, …]`. The Action
reads every `index.md`'s frontmatter once (at push time) so the **browser doesn't
have to** (it used to fetch every file on every visit just to title the cards —
Home alone was ~28 fetches; now ~3). Full **bodies** load lazily, only when a
modal/reader opens (`Site.item`). The browser also still accepts a legacy
**slug-list** manifest (`["billbreak", …]`) — a hand-edited one works, it just
costs the old per-file fetches. Images stay relative (resolved client-side), so
manifests are host-independent.

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
SiteFooter.dc.html          # footer — renders from content/footer/page.md

css/
  theme.css                 # design tokens (color / type / layout) — the LOOK lives here
  base.css                  # shared global stylesheet (resets, scrollbar, animations)

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
    books/                  # books LIST file: index.md (items: array) + images/ covers
      index.md   images/
  misc/                     # page.md (copy + fallbacks)
    rides/                  #   PER-ITEM FOLDERS — curated biking rides
    restaurants/            #   index.md (pin list) + map.html (My Maps embed)
    pictures/               #   index.md (items: caption + image) + images/ photos

.github/
  workflows/ build-manifests.yml
  scripts/   build-manifests.mjs
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
   <link rel="stylesheet" href="css/theme.css"> <!-- design tokens -->
   <link rel="stylesheet" href="css/base.css">  <!-- shared global styles -->
   <script src="./support.js"></script>        <!-- runtime -->
   <script src="./js/app.js"></script>          <!-- window.Site -->
   <script src="./js/pages/Projects.js"></script>
   ```
   Each page's inline `<style>` now holds only page-specific rules (grid
   breakpoints, the Thoughts reader type, the restaurants map). Global resets,
   the scrollbar, card-hover, and the modal/slide `@keyframes` live in
   `css/base.css`; all colors/fonts/spacing tokens live in `css/theme.css`.
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
- **Ordering**: per-item collections sort by a date-like key **descending**
  (newest first) — `date:` if present, else `year:` (so thoughts sort by `date`,
  projects by `year`). Items with neither (books use `when:`/`status:`) keep
  their manifest order. **Thoughts** also support `pinned: true`, which floats a
  post to the top and shows a bookmark icon on its card/list row. The Thoughts
  **reader's Prev/Next** links walk this same sorted order (respecting the active
  tag filter), so adding a post automatically slots into the sequence on push —
  no hardcoded ordering. Bodies load lazily as you navigate.

See `content/projects/_template/index.md` and `content/thoughts/_template/index.md`
for the full annotated field list.

### List files (books, articles, podcasts, resources, restaurants)

For link-only collections (no per-item assets), a single file whose frontmatter
holds an `items:` array. No body needed.
```yaml
---
items:
  - title: The Garden and the Stream
    cat: Web
    source: hapgood
    link: "https://example.com/essay"   # opens in a new tab on click
    image: ./images/garden.png          # optional thumbnail (else placeholder)
---
```
Articles, podcasts, and resources each support an optional **`link:`** (full URL —
the row opens it in a new tab; omit for a no-op) and **`image:`** (a thumbnail
shown in the icon/cover box; omit to keep the gradient placeholder). Drop list
thumbnails in **`content/reading/images/`** and reference them `./images/<file>`
(resolved relative to `content/reading/`, like any list `image`).

**Books** are a list file too — `content/reading/books/index.md` — with one
`items:` entry per book: `title`, `author`, `status` (Reading | Read | Re-read |
Shelf), `when`, `link` (clicking the cover/row opens it — e.g. the Amazon page),
and `image:` — either `./images/<file>` (covers live in
`content/reading/books/images/`) or a full image URL (e.g. an Open Library
cover). The "N read this year" count tallies `Read`/`Re-read` books whose `when`
year matches the current year. Leave `status`/`when` blank to fill in later.

(Projects and thoughts use per-item **folders** instead — see above.)

---

## site.config.json

```json
{
  "brand": "Leonard",
  "sections": [
    { "key": "home", "label": "Home", "href": "." },
    { "key": "projects", "label": "Projects", "href": "projects/" }
  ]
}
```
`sections` drives the nav (order + active highlight via each page's
`active="<key>"`).

### content/footer/page.md
The footer (every page) renders from this file's frontmatter:
```yaml
---
tagline: A line under the social icons.
github: https://github.com/you
linkedin: "#"
email: mailto:you@example.com
---
```
The three icons (GitHub / LinkedIn / Email) are fixed; just set their hrefs.

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

### Misc "Pictures" slideshow
Photos are committed to the repo. List them in `content/misc/pictures/index.md`
(`items:` array of `caption` + `image: ./images/<file>`); the image files live
in `content/misc/pictures/images/`. While that list is empty the slideshow falls
back to the `pictures_fallback` captions in `content/misc/page.md`.

> **Biking** is no longer a Strava integration — it's a curated collection.
> Add a ride by copying `content/misc/rides/_template/` → `rides/<slug>/` with an
> `index.md` (name, distance, click-through `link:`) and a route image.

---

## `js/app.js` — the `Site` API (reference)

| Method | Purpose |
|---|---|
| `Site.collection(name)` | Load a per-item folder collection (`name` may be nested): reads `manifest.json` → sorted `[{slug, …frontmatter, image}]`. A **rich** manifest (array of objects, see below) is used as-is — no per-item fetch, `body` is omitted. A legacy **slug-list** manifest (array of strings) falls back to fetching+parsing each `<slug>/index.md` (and includes `body`). `image: ./x.png` resolves against the item's own folder at runtime either way. |
| `Site.item(name, slug)` | Lazily fetch+parse one item's `index.md` → `{…frontmatter, body, image, _base}`. Used when a modal/reader needs the full **body** (rich manifests omit it): Projects modal, Thoughts reader. |
| `Site.list(name, file)` | Load a single list file → `{items, meta, intro}`. |
| `Site.page(name)` | Load `content/<name>/page.md` → `{data, body}`. |
| `Site.config()` | Cached `site.config.json`. |
| `Site.renderMarkdown(md)` | Sanitized block Markdown → `<div class="md">`. |
| `Site.renderInline(md)` | Sanitized inline Markdown → `<span>`. |
| `Site.cover(src, alt)` | A cover `<img>` React element (absolute-fill) for a `{{ x.cover }}` slot, or `null` when no image. Built in JS so templates never eager-fetch a `{{ }}` `src`. |
| `Site.assign(t, …src)` | Shallow-merge helper (shared by every page module). |
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
