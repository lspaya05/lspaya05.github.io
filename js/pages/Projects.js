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

      // card list — blurb rendered as inline markdown; click stores the RAW item.
      // (frontmatter uses `title`; the template binds `name`.)
      var projects = items.map(function (p) {
        var name = p.name || p.title;
        return assign({}, p, {
          name: name,
          blurb: Site.renderInline(p.blurb),
          cover: Site.cover(p.image, name),
          open: modal.open(p)
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
