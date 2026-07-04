/* Misc page logic. Data:
 *   content/misc/restaurants/index.md  (map pin list) + restaurants/map.html (embed)
 *   content/misc/rides/<slug>/         (curated biking rides — modular collection)
 *   content/misc/pictures/index.md     (slideshow photos: caption + ./images/<file>)
 *   content/misc/page.md               (copy + fallbacks) */
(function () {
  "use strict";
  var assign = Site.assign;
  function normPics(arr) {
    return (arr || []).map(function (p) {
      return typeof p === "string" ? { caption: p } : p;
    });
  }
  function pics(self) {
    var d = self.state._data || {}; var copy = d.copy || {};
    var p = normPics((d.pictures && d.pictures.length) ? d.pictures : (copy.pictures_fallback || []));
    return p.length ? p : [{ caption: "" }];
  }
  Site.register("misc", {
    modalKey: "map",
    state: { slide: 0, map: null },

    load: function () {
      return Promise.all([
        Site.list("misc/restaurants", "index.md").catch(function () { return { items: [] }; }),
        Site.page("misc"),
        Site.list("misc/pictures", "index.md").catch(function () { return { items: [] }; }),
        Site.collection("misc/rides").catch(function () { return []; }),
        fetch("content/misc/restaurants/map.html").then(function (r) {
          return r.ok ? r.text() : "";
        }).catch(function () { return ""; })
      ]).then(function (r) {
        return {
          spots: r[0].items, copy: r[1].data || {}, pictures: r[2].items,
          rides: r[3], mapHtml: r[4]
        };
      });
    },

    mount: function (self) {
      self.__iv = setInterval(function () {
        var len = pics(self).length;
        self.setState(function (s) { return { slide: ((s.slide || 0) + 1) % len }; });
      }, 4200);
    },
    unmount: function (self) { if (self.__iv) clearInterval(self.__iv); },

    build: function (self, d) {
      var copy = d.copy || {};
      var modal = Site.modalControls(self, "map");
      var p = pics(self);
      var len = p.length;
      var i = (((self.state.slide || 0) % len) + len) % len;
      // 21px buttons for a comfortable tap target; the visible 7px dot (and its
      // 1px ring on inactive dots) is painted with a radial-gradient so the rest
      // of the hit area stays invisible.
      var dotBase = {
        width: "21px", height: "21px", padding: 0, border: "none",
        borderRadius: "50%", cursor: "pointer", background: "transparent"
      };
      function go(n) { self.setState({ slide: ((n % len) + len) % len }); }

      var rides = (d.rides || []).map(function (r) {
        return {
          name: r.title || r.name || "",
          distance: r.distance || "",
          link: r.link || "#",
          cover: Site.cover(r.image, r.title || r.name || "")
        };
      });

      return {
        heroIntro: Site.renderInline(copy.hero || ""),
        // pictures slideshow
        slideCap: p[i].caption,
        slideCover: Site.cover(p[i].image, p[i].caption),
        slideKey: "cap-" + i,
        slideCounter: (i + 1) + " / " + len,
        prev: function () { go((self.state.slide || 0) - 1); },
        next: function () { go((self.state.slide || 0) + 1); },
        dots: p.map(function (_, idx) {
          return {
            onClick: (function (k) { return function () { go(k); }; })(idx),
            style: idx === i
              ? assign({}, dotBase, { background: "radial-gradient(circle, var(--ink-soft) 0 4.4px, transparent 4.4px)" })
              : assign({}, dotBase, { background: "radial-gradient(circle, rgba(255,255,255,0.85) 0 3.5px, rgba(0,0,0,0.08) 3.5px 4.5px, transparent 4.5px)" })
          };
        }),
        // editable copy
        peopleTitle: copy.people_title || "People who inspire me",
        peopleSub: copy.people_sub || "",
        peopleProse: Site.renderInline(copy.people || ""),
        picturesSub: copy.pictures_sub || "all shot on iPhone",
        restaurantsTitle: copy.restaurants_title || "Eating around Seattle",
        restaurantsSub: copy.restaurants_sub || "",
        // biking — curated rides collection
        bikingTitle: copy.biking_title || "Biking",
        bikingSub: copy.biking_sub || "Selected rides",
        rides: rides,
        // restaurants: pin list + static My Maps embed (content/misc/restaurants/map.html)
        spots: d.spots || [],
        mapEmbed: d.mapHtml ? Site.renderMarkdown(d.mapHtml) : null,
        // click-to-enlarge: same embed in a styled modal card (separate element
        // so both the inline preview and the modal can mount at once)
        mapEmbedModal: d.mapHtml ? Site.renderMarkdown(d.mapHtml) : null,
        openMap: modal.open(true),
        mapModalOpen: modal.isOpen,
        closeMap: modal.close,
        stopMap: modal.stop
      };
    }
  });
})();
