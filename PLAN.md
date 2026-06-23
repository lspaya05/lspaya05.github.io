# PLAN.md — Step 3: Rich manifests (kill the Home N+1 fetch)

> Handoff doc for an agent picking up the next optimization. Steps 1 & 2
> (DRY/dead-code cleanup + CSS token extraction) are already merged to `main`
> (commit `5249da0`). This file describes the remaining, optional Step 3.
> Read `architecture.md` first for the full system tour.

---

## 1. Background — how this site works (read this first)

**Zero-build static site.** No backend, no server-side render, no bundler. The
repo is plain files served by GitHub Pages. All Markdown → HTML rendering happens
**client-side, in the visitor's browser, on every page load.**

Key flow (`js/app.js` = `window.Site`):
1. `Site.collection(name)` fetches `content/<name>/manifest.json`.
2. Today that manifest is a **flat array of folder slugs** (strings), e.g.
   `["billbreak", "glyph", ...]`.
3. So `collection()` must then `fetch` **every** `content/<name>/<slug>/index.md`,
   parse its YAML frontmatter + Markdown body (`parseDoc`), and sort
   (`sortItems`, by `date`/`year` desc, then `pinned` first).

**The two GitHub Actions do NOT render anything:**
- `.github/scripts/build-manifests.mjs` (workflow `build-manifests.yml`) —
  regenerates each `manifest.json`. It opens every `index.md` only to test
  `^title:` and then writes the **slug list**. It discards all other frontmatter.
- `.github/scripts/photos.mjs` — unrelated (Google Photos → `pictures.json`).

---

## 2. The problem

The manifest carries only slugs, so the browser has no item metadata without
downloading each file. The **Home page** (`js/pages/Home.js`) loads three
collections just to show a few recent items:

| Collection | Files fetched | Used on Home |
|---|---|---|
| `projects` | 10 | first 3 cards |
| `thoughts` | 8 | first 5 titles |
| `reading/books` | 10 | first 6 spines |

= **~28 HTTP fetches + 28 Markdown parses** to render a handful of titles. It
can't slice-before-fetch because sorting needs each item's `date`/`year`, which
live inside the files.

The full `index.md` **bodies** are only needed when a modal/reader opens — which
happens **only** on the Projects page (project modal) and Thoughts page (reader).
Books, rides, Home, and all card grids need metadata only.

---

## 3. Goal

Move the "read every file's frontmatter" work from **the browser (every visit)**
to **CI (once, on push)**. Have `build-manifests.mjs` bake item metadata into
`manifest.json`; have the browser render cards from that and fetch a full body
**lazily**, only when a modal/reader opens.

Target: Home drops from ~28 fetches to ~3. Card grids on section pages: 1 fetch
each. Still zero-build, still client-side Markdown rendering — we just stop
discarding metadata the Action already reads.

---

## 4. Implementation

### 4a. `build-manifests.mjs` — emit rich manifests

Currently writes `string[]`. Change `generate(dir)` to write an **array of
objects**: `{ slug, ...selectedFrontmatter }`.

- The script runs with **bare `node` (no package.json / no deps)** — see the
  workflow. **Do not add a YAML dependency unless you also add `package.json` +
  an `npm ci` step.** Prefer a small frontmatter scalar extractor (regex) for the
  fields below. (Alternative: add `js-yaml` + install step — heavier, but matches
  the browser parser exactly. Decide and note which you chose.)
- Fields to extract (only scalars needed for cards/lists/sorting; **skip the
  body**): `title`, `date`, `year`, `tag`, `cat`, `status`, `author`, `excerpt`,
  `blurb`, `note`, `image`, `pinned`, `distance`, `link`, `art`, `source`,
  `kind`, `stack` (array — optional). Omit any that are absent.
- Keep the existing item-detection rule (folder, not `_`-prefixed, has
  `^title:`). Keep deterministic `.sort()` by slug for stable diffs.
- **Watch frontmatter quoting/multiline**: a naive regex must handle quoted
  values and `: ` inside values. Test against real files like
  `content/projects/billbreak/index.md` and
  `content/thoughts/*/index.md` (some excerpts contain colons, em-dashes,
  inline markdown). If the regex gets fragile, switch to js-yaml.

Example output (`content/projects/manifest.json`):
```json
[
  { "slug": "billbreak", "title": "BillBreak", "year": "2024", "cat": "Tool",
    "blurb": "Split a bill without the awkward math.", "image": "./cover.png" }
]
```

### 4b. `Site.collection()` (`js/app.js`) — consume rich manifests, stay backward-compatible

- Accept **both** shapes:
  - `string[]` (old) → keep current behavior (fetch each `index.md`). This is the
    safe fallback and what a hand-edited manifest may still be.
  - `object[]` (new) → build items directly from the manifest entries; **do not**
    fetch bodies. Set `item.slug`, copy frontmatter fields, set
    `item._base = base + slug + "/"`, resolve `item.image` via existing
    `resolveAsset(item._base, entry.image)`. Leave `item.body` undefined.
- Still run `sortItems` (unchanged — it already sorts by `date`/`year` then
  `pinned`).
- Add a lazy body loader, e.g.:
  ```js
  function item(name, slug) {            // fetch+parse one index.md on demand
    var itemBase = "content/" + name + "/" + encodeURIComponent(slug) + "/";
    return loadVendors()
      .then(function () { return fetchText(itemBase + "index.md"); })
      .then(function (text) {
        var d = parseDoc(text);
        d.data.body = d.body;
        d.data._base = itemBase;
        d.data.image = resolveAsset(itemBase, d.data.image);
        return d.data;
      });
  }
  ```
  Export it on `window.Site`.

### 4c. Page modules — fetch bodies lazily where modals/readers exist

Only two pages render a full body:

- **`js/pages/Projects.js`** — `modal.open(p)` stores the raw item; `build()`
  renders `Site.renderMarkdown(raw.body)`. With rich manifests, `raw.body` is now
  absent. Change the open handler to `Site.item("projects", slug)` and store the
  resolved full item in state, then render. (Show the modal immediately with the
  metadata it already has; fill the body when the fetch resolves.)
- **`js/pages/Thoughts.js`** — same pattern for the reader (`modalKey: "reader"`).
  The payload also computes `prev`/`next`/`readTime`/`coda` from the list — keep
  that; just load `body` lazily on open.

No change needed for **Home**, **Reading** (books = cards only, no modal),
**Misc rides** (cards + outbound `link`, no body), or **`_Template.js`** (but
update the template comment to mention metadata-from-manifest if you touch it).

### 4d. Regenerate manifests + docs

- Run `node .github/scripts/build-manifests.mjs` locally and commit the
  regenerated `manifest.json` files (the CI Action will also do this on push).
- Update `architecture.md`: the `Site.collection` table row (now manifest-driven),
  the new `Site.item` row, and the "How a page renders" note. Document the new
  manifest object shape next to the existing slug-list description.

---

## 5. Edge cases / gotchas

- **Books sort by manifest order** (they use `when:`/`status:`, not `date`/`year`)
  — `sortItems` already preserves manifest order when no date/year is present, so
  manifest order must stay the sorted-by-slug order CI emits. Verify book ordering
  is unchanged after the switch.
- **`pinned: true`** (thoughts) must survive as a boolean in the manifest, since
  `sortItems` floats pinned to front.
- **Image paths**: `image: ./cover.png` is relative to the item folder. Resolve
  with `resolveAsset(itemBase, ...)` exactly as `collection()` does today —
  don't resolve at build time (keep manifests host-independent).
- **List files are NOT collections** — `Site.list()` (articles/podcasts/
  resources/restaurants) reads a single file's `items:` array and is unaffected.
  Don't touch it.
- **Don't edit `support.js`** (generated runtime).
- **`.nojekyll` must stay** (serves `_`-prefixed paths).
- Keep the string-array fallback in `collection()` so a half-migrated repo or a
  manually slug-listed manifest still works.

---

## 6. Verification

1. `node .github/scripts/build-manifests.mjs` → manifests now contain objects;
   counts unchanged (projects 10, thoughts 8, reading/books 10, misc/rides 2).
2. Serve the repo root over HTTP (client-side fetch needs http, not file://):
   `python -m http.server 8000`, open `/`, `/projects/`, `/thoughts/`,
   `/reading/`, `/misc/`.
3. **DevTools → Network**, reload Home: confirm it fetches the 3 `manifest.json`
   files but **not** the individual `index.md` files (the win). Count should drop
   from ~28 to ~3.
4. Open a **project modal** and a **thought reader**: confirm the body still
   renders (now fetched lazily on open — watch the Network tab show one `index.md`
   fetch at click time).
5. Confirm card metadata, ordering (incl. pinned thoughts, book order), images,
   tags, and the Blocks/List toggle all look identical to `main`.
6. `git grep` for any code still assuming `manifest` is `string[]`.

---

## 7. Out of scope (optional follow-ups)

- Residual color sweep: migrate remaining inline-template hex colors and the
  `segmented()` JS style objects in `js/app.js` to `var(--token)` from
  `css/theme.css` (pure DRY, no behavior change).
- Misc slideshow: memoize the static parts of `build()` so the 4.2s `setInterval`
  tick doesn't rebuild ride covers / re-sanitize the map each frame.
