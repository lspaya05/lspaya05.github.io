/* Thoughts page logic. Data: per-item markdown in content/thoughts/*.md
 * (cards + reader body) and content/thoughts/page.md (header copy). */
(function () {
  "use strict";
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) t[k] = s[k];
    }
    return t;
  }
  var CHIP = {
    border: "none", cursor: "pointer", fontFamily: "var(--ui)", fontSize: "13px",
    fontWeight: 500, padding: "8px 15px", borderRadius: "999px",
    transition: "background .2s ease, color .2s ease"
  };

  Site.register("thoughts", {
    modalKey: "reader",
    state: { view: "list", filter: "All", hoverSeg: null, reader: null },

    load: function () {
      return Promise.all([
        Site.collection("thoughts"),
        Site.page("thoughts")
      ]).then(function (res) {
        return { items: res[0], copy: res[1].data || {} };
      });
    },

    build: function (self, d) {
      var all = d.items || [];
      var copy = d.copy || {};
      var filter = self.state.filter || "All";
      var filtered = filter === "All" ? all : all.filter(function (t) { return t.tag === filter; });
      var seg = Site.segmented(self, { def: "list" });
      var modal = Site.modalControls(self, "reader");

      var items = filtered.map(function (t, i, arr) {
        var payload = assign({}, t, {
          readTime: t.readTime || ((3 + (i % 4)) + " min read"),
          coda: t.coda || "Mostly I write these to find out what I actually think.",
          prev: arr[i - 1] ? arr[i - 1].title : "—",
          next: arr[i + 1] ? arr[i + 1].title : "—"
        });
        return assign({}, t, {
          excerpt: Site.renderInline(t.excerpt),
          open: modal.open(payload)
        });
      });

      var tags = ["All"];
      all.forEach(function (t) { if (t.tag && tags.indexOf(t.tag) === -1) tags.push(t.tag); });
      var tagOptions = tags.map(function (label) {
        return {
          label: label,
          onClick: (function (l) { return function () { self.setState({ filter: l }); }; })(label),
          style: label === filter
            ? assign({}, CHIP, { background: "#1f1d1a", color: "#f7f6f3" })
            : assign({}, CHIP, { background: "#fff", color: "#74706a", border: "1px solid #e7e4de" })
        };
      });

      var r = self.state.reader || {};
      var reader = assign({}, r, {
        excerpt: r.excerpt != null ? Site.renderInline(r.excerpt) : null,
        body: r.body ? Site.renderMarkdown(r.body) : null
      });

      return assign({
        items: items,
        tagOptions: tagOptions,
        shares: ["X", "f", "in"],
        readerOpen: modal.isOpen,
        reader: reader,
        closeReader: modal.close,
        stop: modal.stop,
        heroIntro: Site.renderInline(copy.hero || "")
      }, seg);
    }
  });
})();
