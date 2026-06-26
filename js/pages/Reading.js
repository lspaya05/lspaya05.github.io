/* Reading page logic. Data: single-file lists in content/reading/*.md
 * (books, resources, podcasts, articles) + page.md (header copy). */
(function () {
  "use strict";
  var assign = Site.assign;

  // Status tag as a colored pill (React element): Read/Re-read green, Reading
  // yellow, Shelf light red. Blank status -> null (no pill). variant: blocks|list.
  function statusBadge(status, variant) {
    if (!status) return null;
    var s = String(status).trim().toLowerCase();
    var pal = (s === "read" || s === "re-read") ? { bg: "#e3efe1", fg: "#477a54" }
            : (s === "reading") ? { bg: "#f6eccd", fg: "#8a6a2a" }
            : { bg: "#f7e1dd", fg: "#a5544a" };
    var base = {
      fontFamily: "var(--ui)", fontWeight: 600, textTransform: "uppercase",
      borderRadius: "999px", color: pal.fg, background: pal.bg
    };
    var v = variant === "blocks"
      ? { position: "absolute", top: "8px", left: "8px", fontSize: "10px", letterSpacing: "0.04em", padding: "2px 7px" }
      : { fontSize: "10.5px", letterSpacing: "0.05em", padding: "3px 9px" };
    return window.React.createElement("span", { style: assign({}, base, v) }, status);
  }
  // An emoji thumbnail (React element) filling a cover box on a clean tile —
  // used when a list item sets `emoji:` instead of an `image:`.
  function emojiCover(e) {
    return window.React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "16px", lineHeight: 1,
        background: "var(--surface-muted)"
      }
    }, e);
  }

  // Finish year parsed from a book's `when` (e.g. "Jan 2026" -> 2026), or null.
  function whenYear(w) {
    var m = /\b(\d{4})\b/.exec(String(w || ""));
    return m ? +m[1] : null;
  }
  var BOOKS_COLLAPSED = 5;   // books shown before the "show all" reveal

  // Bookmark icon (React element) for favorited books, or null. variant: blocks|list.
  function bmIcon(variant) {
    var style = variant === "blocks"
      ? { position: "absolute", top: "7px", right: "7px", flex: "none", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.3))" }
      : { flex: "none", transform: "translateY(1px)" };
    return window.React.createElement("svg", {
      width: 13, height: 13, viewBox: "0 0 24 24", fill: "var(--accent)",
      "aria-label": "Bookmarked", style: style
    }, window.React.createElement("path", { d: "M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" }));
  }

  Site.register("reading", {
    state: { view: "blocks", hoverSeg: null, booksExpanded: false },

    load: function () {
      function l(f) { return Site.list("reading", f).catch(function () { return { items: [] }; }); }
      return Promise.all([
        Site.list("reading/books", "index.md").catch(function () { return { items: [] }; }),
        l("resources.md"), l("podcasts.md"), l("articles.md"),
        Site.page("reading")
      ]).then(function (r) {
        return {
          books: r[0].items, resources: r[1].items,
          podcasts: r[2].items, articles: r[3].items,
          copy: r[4].data || {}
        };
      });
    },

    build: function (self, d) {
      var books = Site.sortBooks((d.books || []).slice());
      // "read this year" = finished books whose finish date (when) is the current
      // calendar year (checked live, so it rolls over automatically).
      var thisYear = new Date().getFullYear();
      var read = books.filter(function (b) {
        var s = String(b.status || "").toLowerCase();
        return (s === "read" || s === "re-read") && whenYear(b.when) === thisYear;
      }).length;
      var seg = Site.segmented(self, { def: "blocks" });
      var bookCards = books.map(function (b) {
        return assign({}, b, {
          cover: Site.cover(b.image, b.title),
          link: b.link || "#",
          statusBlocks: statusBadge(b.status, "blocks"),
          statusList: statusBadge(b.status, "list"),
          bmBlocks: b.bookmarked ? bmIcon("blocks") : null,
          bmList: b.bookmarked ? bmIcon("list") : null
        });
      });
      // Show only the first few books until the reader expands the list.
      var expanded = !!self.state.booksExpanded;
      var shownBooks = expanded ? bookCards : bookCards.slice(0, BOOKS_COLLAPSED);
      // resources / podcasts / articles: each item may carry an `image:`
      // (relative to content/reading/, resolved by Site.list) shown via a
      // {{ x.cover }} slot, and a `link:` that makes the row open a website.
      function decorate(list) {
        return (list || []).map(function (it) {
          return assign({}, it, {
            cover: it.emoji ? emojiCover(it.emoji) : Site.cover(it.image, it.title),
            link: it.link || "#"
          });
        });
      }
      // book notes / article fields may use inline markdown
      var podcasts = (d.podcasts || []).map(function (p) {
        return assign({}, p, {
          note: Site.renderInline(p.note),
          cover: Site.cover(p.image, p.title),
          link: p.link || "#"
        });
      });
      return assign({
        books: shownBooks,
        booksCount: read + " read this year",
        booksMore: bookCards.length > BOOKS_COLLAPSED,
        booksToggleLabel: expanded ? "Show less" : ("Show all " + bookCards.length + " books"),
        toggleBooks: function () { self.setState(function (s) { return { booksExpanded: !s.booksExpanded }; }); },
        resources: decorate(d.resources),
        podcasts: podcasts,
        articles: decorate(d.articles),
        heroIntro: Site.renderInline((d.copy || {}).hero || ""),
        podcastsSub: (d.copy || {}).podcasts_sub || "",
        articlesSub: (d.copy || {}).articles_sub || "",
        resourcesSub: (d.copy || {}).resources_sub || "",
        resourcesIntro: Site.renderInline((d.copy || {}).resources_intro || "")
      }, seg);
    }
  });
})();
