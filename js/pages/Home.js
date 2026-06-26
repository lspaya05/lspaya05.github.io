/* Home page logic. Pulls featured items from the same collections the other
 * pages use (first-N), plus hero/bio copy from content/home/page.md. */
(function () {
  "use strict";
  function first(a, n) { return (a || []).slice(0, n); }

  Site.register("home", {
    state: {},

    load: function () {
      return Promise.all([
        Site.collection("projects").catch(function () { return []; }),
        Site.collection("thoughts").catch(function () { return []; }),
        Site.list("reading/books", "index.md").catch(function () { return { items: [] }; }),
        Site.page("home"),
        Site.page("footer").catch(function () { return { data: {} }; })
      ]).then(function (r) {
        return {
          projects: r[0], thoughts: r[1], books: r[2].items,
          copy: r[3].data || {}, footer: r[4].data || {}
        };
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
      // Books in the same order as the Reading list (bookmarked, then by date).
      var books = Site.sortBooks((d.books || []).slice());
      var reading = first(books, 6).map(function (b) {
        return { title: b.title, source: b.author, cat: b.status, cover: Site.cover(b.image, b.title) };
      });
      // Hero "currently reading" tile: the book(s) with status "Reading". Handles
      // one, several, or none (-> an N/A block). Type scales down when >1.
      var current = books.filter(function (b) {
        return String(b.status || "").trim().toLowerCase() === "reading";
      });
      var many = current.length > 1;
      var titleStyle = { fontFamily: "var(--display)", fontSize: many ? "18px" : "23px", lineHeight: 1.18, letterSpacing: "-0.005em", color: "var(--ink)" };
      var authorStyle = { fontFamily: "var(--ui)", fontSize: many ? "12px" : "13px", color: "var(--text-faint)", marginTop: "2px" };
      var currentReading = current.map(function (b) {
        return { title: b.title, author: b.author || "", titleStyle: titleStyle, authorStyle: authorStyle };
      });
      var ft = (d.thoughts || [])[0] || {};
      var f = d.footer || {};

      return {
        projects: projects, thoughts: thoughts, reading: reading,
        bio1: Site.renderInline(copy.bio1 || ""),
        bio2: Site.renderInline(copy.bio2 || ""),
        bio3: Site.renderInline(copy.bio3 || ""),
        featThoughtTitle: ft.title || "",
        featThoughtBlurb: Site.renderInline(ft.excerpt || ""),
        currentReading: currentReading,
        isReading: current.length > 0,
        notReading: current.length === 0,
        githubHref: f.github || "#",
        linkedinHref: f.linkedin || "#",
        emailHref: f.email || "#"
      };
    }
  });
})();
