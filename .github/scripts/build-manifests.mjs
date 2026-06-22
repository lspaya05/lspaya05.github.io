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
function isItemFolder(dir) {
  const idx = path.join(dir, "index.md");
  return fs.existsSync(idx) && /^title\s*:/m.test(frontmatter(idx));
}
function isCollection(dir) {
  const e = fs.readdirSync(dir);
  return e.includes("manifest.json") || e.includes("_template");
}
function generate(dir) {
  const slugs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .filter((d) => isItemFolder(path.join(dir, d.name)))
    .map((d) => d.name)
    .sort();
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(slugs, null, 2) + "\n");
  console.log((path.relative(root, dir) || ".") + " -> " + slugs.length + " items");
}
function walk(dir) {
  if (isCollection(dir)) generate(dir);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith("_")) walk(path.join(dir, e.name));
  }
}

if (!fs.existsSync(root)) { console.log("no content/ dir"); process.exit(0); }
walk(root);
