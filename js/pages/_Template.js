/* Page-module template for a brand-new tab.
 * To add a tab named e.g. "Photos":
 *   1. Copy this file to js/pages/Photos.js
 *   2. Replace every NEWPAGE below with "photos" (lower-case section key)
 *   3. Copy _template.dc.html to photos/index.html and follow its comments
 *      (the folder name becomes the clean URL, e.g. /lspaya/photos/)
 *   4. Add items as folders: content/photos/<slug>/index.md (+ assets in the
 *      folder). Copy any _template/ folder in to opt the collection into the
 *      build-manifests Action, or commit a manifest.json of folder names.
 *   5. Add a section to content/site.config.json so it appears in the nav */
(function () {
  "use strict";
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) t[k] = s[k];
    }
    return t;
  }

  Site.register("NEWPAGE", {
    state: {},
    load: function () {
      return Site.collection("NEWPAGE").then(function (items) { return { items: items }; });
    },
    build: function (self, d) {
      var items = (d.items || []).map(function (it) {
        var name = it.name || it.title;
        return assign({}, it, {
          name: name,
          blurb: Site.renderInline(it.blurb),
          cover: Site.cover(it.image, name)
        });
      });
      return { items: items };
    }
  });
})();
