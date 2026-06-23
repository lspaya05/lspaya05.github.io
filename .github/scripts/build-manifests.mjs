/* Regenerate manifest.json for every per-item collection.
 *
 * Items are FOLDERS: content/<collection>/<slug>/index.md (so each item can
 * carry co-located assets — cover.png, screenshots, etc.). A directory is a
 * per-item collection if it contains a manifest.json OR a _template/ folder
 * (so copying _template/ into a new folder opts it in). Collections may be
 * nested (e.g. content/reading/books). Items = sub-folders (not starting with
 * "_") whose index.md has a `title:` — naturally skipping page.md and list
 * files like ideas.md / books-less reading lists. */
import fs from "fs";
import path from "path";

const root = "content";

function frontmatter(fp) {
  const t = fs.readFileSync(fp, "utf8").replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t);
  return m ? m[1] : "";
}

// Strip matching surrounding quotes from a scalar.
function unquote(s) {
  s = s.trim();
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    return s.slice(1, -1);
  }
  return s;
}
// Minimal flat-YAML reader for item frontmatter. The browser parses full YAML
// (js-yaml) on lazy body load; here we only need the top-level scalars/arrays
// the cards/lists/sorting use. Frontmatter in this repo is flat — no nested
// maps, no folded/multiline scalars — so a line scan matches js-yaml's output.
// Coerces booleans (so `pinned` floats in sortItems) and inline `[a, b]` arrays.
function parseFrontmatter(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim()[0] === "#") continue;   // blank / comment
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;                                        // not top-level key
    const key = m[1];
    let val = m[2].trim();
    if (val === "") continue;                                // empty value -> skip
    if (val[0] === "[" && val[val.length - 1] === "]") {     // inline array
      const inner = val.slice(1, -1).trim();
      out[key] = inner ? inner.split(",").map((x) => unquote(x)) : [];
    } else if (val === "true" || val === "false") {
      out[key] = val === "true";
    } else {
      out[key] = unquote(val);
    }
  }
  return out;
}
function isItemFolder(dir) {
  const idx = path.join(dir, "index.md");
  return fs.existsSync(idx) && /^title\s*:/m.test(frontmatter(idx));
}
function isCollection(dir) {
  const e = fs.readdirSync(dir);
  return e.includes("manifest.json") || e.includes("_template");
}
function generate(dir) {
  // Rich manifest: { slug, ...frontmatter } per item. Carries the metadata the
  // browser used to read by fetching every index.md (cards/lists/sorting); the
  // body is fetched lazily only when a modal/reader opens. Sorted by slug for
  // stable diffs. Images stay relative (resolved client-side, host-independent).
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .filter((d) => isItemFolder(path.join(dir, d.name)))
    .map((d) => d.name)
    .sort()
    .map((slug) => ({ slug, ...parseFrontmatter(frontmatter(path.join(dir, slug, "index.md"))) }));
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(items, null, 2) + "\n");
  console.log((path.relative(root, dir) || ".") + " -> " + items.length + " items");
}
function walk(dir) {
  if (isCollection(dir)) generate(dir);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith("_")) walk(path.join(dir, e.name));
  }
}

if (!fs.existsSync(root)) { console.log("no content/ dir"); process.exit(0); }
walk(root);
