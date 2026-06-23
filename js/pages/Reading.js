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
      // resources / podcasts / articles: each item may carry an `image:`
      // (relative to content/reading/, resolved by Site.list) shown via a
      // {{ x.cover }} slot, and a `link:` that makes the row open a website.
      function decorate(list) {
        return (list || []).map(function (it) {
          return assign({}, it, {
            cover: Site.cover(it.image, it.title),
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
        books: bookCards,
        booksCount: read + " read this year",
        resources: decorate(d.resources),
        podcasts: podcasts,
        articles: decorate(d.articles),
        heroIntro: Site.renderInline((d.copy || {}).hero || "")
      }, seg);
    }
  });
})();
