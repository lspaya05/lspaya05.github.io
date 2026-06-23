/* Reading page logic. Data: single-file lists in content/reading/*.md
 * (books, resources, podcasts, articles) + page.md (header copy). */
(function () {
  "use strict";
  var assign = Site.assign;

  Site.register("reading", {
    state: { view: "blocks", hoverSeg: null },

    load: function () {
      function l(f) { return Site.list("reading", f).catch(function () { return { items: [] }; }); }
      return Promise.all([
        Site.collection("reading/books").catch(function () { return []; }),
        l("resources.md"), l("podcasts.md"), l("articles.md"),
        Site.page("reading")
      ]).then(function (r) {
        return {
          books: r[0], resources: r[1].items,
          podcasts: r[2].items, articles: r[3].items,
          copy: r[4].data || {}
        };
      });
    },

    build: function (self, d) {
      var books = d.books || [];
      var read = books.filter(function (b) {
        return b.status === "Read" || b.status === "Re-read";
      }).length;
      var seg = Site.segmented(self, { def: "blocks" });
      var bookCards = books.map(function (b) {
        return assign({}, b, { cover: Site.cover(b.image, b.title) });
      });
      // book notes / article fields may use inline markdown
      var podcasts = (d.podcasts || []).map(function (p) {
        return assign({}, p, { note: Site.renderInline(p.note) });
      });
      return assign({
        books: bookCards,
        booksCount: read + " read this year",
        resources: d.resources || [],
        podcasts: podcasts,
        articles: d.articles || [],
        heroIntro: Site.renderInline((d.copy || {}).hero || "")
      }, seg);
    }
  });
})();
