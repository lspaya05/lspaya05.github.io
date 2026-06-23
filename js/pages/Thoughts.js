/* Thoughts page logic. Data: per-item markdown in content/thoughts/*.md
 * (cards + reader body) and content/thoughts/page.md (header copy). */
(function () {
  "use strict";
  var assign = Site.assign;
  var CHIP = {
    border: "none", cursor: "pointer", fontFamily: "var(--ui)", fontSize: "13px",
    fontWeight: 500, padding: "8px 15px", borderRadius: "999px",
    transition: "background .2s ease, color .2s ease"
  };
  // A bookmark icon (React element) for pinned thoughts, or null. Built in the
  // module — never as <svg> in the template — and dropped into a {{ t.pin }} slot.
  function pinIcon() {
    return window.React.createElement("svg", {
      width: 13, height: 13, viewBox: "0 0 24 24", fill: "#c8623f",
      "aria-label": "Pinned", style: { flex: "none", transform: "translateY(1px)" }
    }, window.React.createElement("path", { d: "M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" }));
  }

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

      // Ordered payloads — same order the list shows (sortItems: pinned first,
      // then date desc). prev/next navigation walks THIS array, so it tracks the
      // live ordering automatically (a new thought re-sorts on the next push).
      var payloads = filtered.map(function (t, i) {
        return assign({}, t, {
          readTime: t.readTime || ((3 + (i % 4)) + " min read")
        });
      });

      // Open the reader for a payload, then lazily fetch + merge its body
      // (rich manifests omit bodies). Reused by cards AND prev/next.
      function openReader(payload) {
        return function (e) {
          if (e && e.preventDefault) e.preventDefault();
          self.setState({ reader: payload });
          if (payload.body == null) {
            Site.item("thoughts", payload.slug).then(function (full) {
              self.setState(function (s) {
                return s.reader && s.reader.slug === payload.slug
                  ? { reader: assign({}, payload, { body: full.body }) } : null;
              });
            }).catch(function (err) { console.error("[thoughts] body load failed", err); });
          }
        };
      }

      var items = payloads.map(function (p) {
        return assign({}, p, {
          excerpt: Site.renderInline(p.excerpt),
          pin: p.pinned ? pinIcon() : null,
          open: openReader(p)
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
      // Locate the open thought in the current ordering to wire prev/next.
      var idx = -1;
      for (var j = 0; j < payloads.length; j++) {
        if (payloads[j].slug === r.slug) { idx = j; break; }
      }
      var prevP = idx > 0 ? payloads[idx - 1] : null;
      var nextP = idx >= 0 && idx < payloads.length - 1 ? payloads[idx + 1] : null;
      var reader = assign({}, r, {
        excerpt: r.excerpt != null ? Site.renderInline(r.excerpt) : null,
        body: r.body ? Site.renderMarkdown(r.body) : null,
        hasPrev: !!prevP, hasNext: !!nextP,
        prevTitle: prevP ? prevP.title : "",
        nextTitle: nextP ? nextP.title : "",
        openPrev: prevP ? openReader(prevP) : null,
        openNext: nextP ? openReader(nextP) : null
      });

      return assign({
        items: items,
        tagOptions: tagOptions,
        readerOpen: modal.isOpen,
        reader: reader,
        closeReader: modal.close,
        stop: modal.stop,
        heroIntro: Site.renderInline(copy.hero || "")
      }, seg);
    }
  });
})();
