/* Projects page logic — registers with the shared Site plumbing (app.js).
 * Data: per-item markdown in content/projects/*.md (cards + modal body),
 * plus content/projects/ideas.md (the "Working on now" / "Someday" lists). */
(function () {
  "use strict";
  var assign = Site.assign;

  Site.register("projects", {
    modalKey: "open",
    state: { view: "blocks", hoverSeg: null, open: null },

    load: function () {
      return Promise.all([
        Site.collection("projects"),
        Site.list("projects", "ideas.md").catch(function () { return { items: [] }; })
      ]).then(function (res) {
        return { items: res[0], ideas: res[1].items || [] };
      });
    },

    build: function (self, d) {
      var items = d.items || [];
      var ideas = d.ideas || [];
      var seg = Site.segmented(self, { def: "blocks" });
      var modal = Site.modalControls(self, "open");

      // card list — blurb rendered as inline markdown. Click opens the modal
      // immediately with the manifest metadata, then lazily fetches the item's
      // index.md and merges the body in (rich manifests omit bodies).
      // (frontmatter uses `title`; the template binds `name`.)
      var projects = items.map(function (p) {
        var name = p.name || p.title;
        return assign({}, p, {
          name: name,
          blurb: Site.renderInline(p.blurb),
          cover: Site.cover(p.image, name),
          open: function (e) {
            if (e && e.preventDefault) e.preventDefault();
            self.setState({ open: p });
            if (p.body == null) {
              Site.item("projects", p.slug).then(function (full) {
                self.setState(function (s) {
                  return s.open && s.open.slug === p.slug ? { open: full } : null;
                });
              }).catch(function (err) { console.error("[projects] body load failed", err); });
            }
          }
        });
      });

      var raw = self.state.open || {};
      var openName = raw.name || raw.title;
      var open = assign({}, raw, {
        name: openName,
        blurb: raw.blurb != null ? Site.renderInline(raw.blurb) : null,
        body: raw.body ? Site.renderMarkdown(raw.body) : null,
        cover: Site.cover(raw.image, openName),
        stack: raw.stack || []
      });

      var working = ideas.filter(function (i) { return (i.group || "") === "working"; });
      var someday = ideas.filter(function (i) { return (i.group || "") !== "working"; });

      return assign({
        projects: projects,
        working: working,
        someday: someday,
        modalOpen: modal.isOpen,
        isReadme: modal.isOpen && open.kind !== "essay",
        isEssay: modal.isOpen && open.kind === "essay",
        open: open,
        closeModal: modal.close,
        stop: modal.stop
      }, seg);
    }
  });
})();
