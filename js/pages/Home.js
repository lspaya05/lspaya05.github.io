/* Home page logic. Pulls featured items from the same collections the other
 * pages use (first-N), plus hero/bio copy from content/home/page.md. */
(function () {
  "use strict";
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) t[k] = s[k];
    }
    return t;
  }
  function first(a, n) { return (a || []).slice(0, n); }

  Site.register("home", {
    state: {},

    load: function () {
      return Promise.all([
        Site.collection("projects").catch(function () { return []; }),
        Site.collection("thoughts").catch(function () { return []; }),
        Site.collection("reading/books").catch(function () { return []; }),
        Site.page("home")
      ]).then(function (r) {
        return { projects: r[0], thoughts: r[1], books: r[2], copy: r[3].data || {} };
      });
    },

    build: function (self, d) {
      var copy = d.copy || {};
      var projects = first(d.projects, 3).map(function (p) {
        var name = p.name || p.title;
        return {
          name: name, cat: p.cat, art: p.art,
          cover: Site.cover(p.image, name), blurb: Site.renderInline(p.blurb)
        };
      });
      var thoughts = first(d.thoughts, 5).map(function (t) {
        return { title: t.title, tag: t.tag, date: t.date };
      });
      var reading = first(d.books, 6).map(function (b) {
        return { title: b.title, source: b.author, cat: b.status };
      });
      var ft = (d.thoughts || [])[0] || {};
      var fb = (d.books || [])[0] || {};
      var misc = copy.misc_tiles || [
        { label: "People who inspire me", sub: "A living list",     href: "misc/#people" },
        { label: "Pictures",             sub: "All shot on iPhone", href: "misc/#pictures" },
        { label: "Biking",               sub: "See latest ride",    href: "misc/#biking" }
      ];

      return {
        projects: projects, thoughts: thoughts, reading: reading, misc: misc,
        bio1: Site.renderInline(copy.bio1 || ""),
        bio2: Site.renderInline(copy.bio2 || ""),
        bio3: Site.renderInline(copy.bio3 || ""),
        featThoughtTitle: ft.title || "",
        featThoughtBlurb: Site.renderInline(ft.excerpt || ""),
        featBookTitle: fb.title || "",
        featBookAuthor: fb.author || ""
      };
    }
  });
})();
