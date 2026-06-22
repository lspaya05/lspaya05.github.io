/* Misc page logic. Data: content/misc/restaurants.md (map pins),
 * content/misc/page.md (copy + fallbacks), and prefetched integrations
 * content/data/pictures.json (Google Photos) + biking.json (Strava). */
(function () {
  "use strict";
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) t[k] = s[k];
    }
    return t;
  }
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
    state: { slide: 0 },

    load: function () {
      return Promise.all([
        Site.list("misc", "restaurants.md").catch(function () { return { items: [] }; }),
        Site.page("misc"),
        Site.data("pictures.json"),
        Site.data("biking.json")
      ]).then(function (r) {
        return { spots: r[0].items, copy: r[1].data || {}, pictures: r[2], biking: r[3] };
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
      var p = pics(self);
      var len = p.length;
      var i = (((self.state.slide || 0) % len) + len) % len;
      var dotBase = {
        width: "7px", height: "7px", padding: 0, border: "none",
        borderRadius: "50%", cursor: "pointer"
      };
      function go(n) { self.setState({ slide: ((n % len) + len) % len }); }
      var bk = d.biking || copy.biking_fallback || {};

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
              ? assign({}, dotBase, { background: "#3a3731", transform: "scale(1.25)" })
              : assign({}, dotBase, { background: "rgba(255,255,255,0.85)", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" })
          };
        }),
        // editable copy
        peopleTitle: copy.people_title || "People who inspire me",
        peopleSub: copy.people_sub || "",
        peopleProse: Site.renderInline(copy.people || ""),
        picturesSub: copy.pictures_sub || "all shot on iPhone",
        restaurantsTitle: copy.restaurants_title || "Eating around Seattle",
        restaurantsSub: copy.restaurants_sub || "",
        // biking (Strava-prefetched, with fallback)
        bkLatestKm: bk.latestKm || "",
        bkLatestLabel: bk.latestLabel || "",
        bkYtdKm: bk.ytdKm || "",
        bkRideDay: bk.rideDay || "",
        // restaurant pins
        spots: d.spots || []
      };
    }
  });
})();
