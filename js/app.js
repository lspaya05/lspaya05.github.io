/* =============================================================================
 * app.js — shared application layer ("Site") for the DC-runtime site.
 *
 * Loaded in every page's <head> AFTER support.js (the runtime) and BEFORE the
 * page module (js/pages/*.js). Defines window.Site: the markdown/content
 * loading layer, the async render plumbing, and the reusable UI helpers
 * (segmented Blocks/List toggle, modal controls) that used to be copy-pasted
 * into every page's data-dc-script.
 *
 * Nothing here edits the runtime. Pages keep their finished HTML; only the
 * data behind each {{ binding }} now comes from content/ markdown + config.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---- object assign helper (shared by every page module) ----------------- */
  // Shallow-copy own+inherited enumerable keys of each source onto target.
  // Centralized here so page modules don't each carry a private copy.
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; for (var k in s) t[k] = s[k];
    }
    return t;
  }

  /* ---- vendor libraries (lazy-loaded from CDN on first content access) ---- */
  var VENDORS = [
    "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js",
    "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.umd.js",
    "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"
  ];
  var vendorPromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error("failed to load " + src)); };
      document.head.appendChild(s);
    });
  }
  function loadVendors() {
    if (vendorPromise) return vendorPromise;
    vendorPromise = Promise.all(VENDORS.map(loadScript)).then(function () {
      if (window.marked && window.marked.setOptions) {
        window.marked.setOptions({ gfm: true, breaks: false });
      }
    });
    return vendorPromise;
  }

  /* ---- fetch helpers ------------------------------------------------------ */
  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
      return r.text();
    });
  }
  function fetchJSON(url) { return fetchText(url).then(JSON.parse); }

  /* ---- frontmatter -------------------------------------------------------- */
  // "---\n<yaml>\n---\n<body>" -> { data, body }. No frontmatter -> body only.
  function parseDoc(text) {
    text = String(text || "").replace(/^﻿/, "");
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) return { data: {}, body: text };
    var data = {};
    try { data = window.jsyaml.load(m[1]) || {}; }
    catch (e) { console.error("[site] frontmatter parse error", e); }
    return { data: data, body: m[2] || "" };
  }

  /* ---- asset path resolution --------------------------------------------- */
  // image fields may be absolute URLs, root-absolute, or "./x.png" relative
  // to the item's content folder.
  function resolveAsset(base, src) {
    if (!src) return null;
    if (/^(https?:)?\/\//.test(src) || src[0] === "/") return src;
    if (src.slice(0, 2) === "./") return base + src.slice(2);
    return base + src;
  }

  /* ---- markdown rendering ------------------------------------------------- */
  var IFRAME_HOSTS = [
    "www.youtube.com", "youtube.com", "www.youtube-nocookie.com",
    "player.vimeo.com", "www.loom.com", "loom.com",
    "www.google.com", "google.com", "maps.google.com"
  ];
  var purifyHooked = false;
  function ensurePurifyHook() {
    if (purifyHooked || !window.DOMPurify) return;
    purifyHooked = true;
    window.DOMPurify.addHook("uponSanitizeElement", function (node, data) {
      if (data.tagName === "iframe") {
        var src = node.getAttribute("src") || "";
        var ok = false;
        try { ok = IFRAME_HOSTS.indexOf(new URL(src, location.href).hostname) !== -1; }
        catch (e) { ok = false; }
        if (!ok) node.parentNode && node.parentNode.removeChild(node);
      }
    });
  }
  var PURIFY_OPTS = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling",
               "loading", "referrerpolicy", "target", "rel"]
  };
  var mdCache = {};       // raw md -> sanitized block html
  var inlineCache = {};   // raw md -> sanitized inline html
  function getReact() {
    if (!window.React) throw new Error("[site] React not loaded yet");
    return window.React;
  }
  function sanitizeBlock(md) {
    if (md in mdCache) return mdCache[md];
    ensurePurifyHook();
    var html = window.DOMPurify.sanitize(window.marked.parse(md || ""), PURIFY_OPTS);
    mdCache[md] = html;
    return html;
  }
  function sanitizeInline(md) {
    if (md in inlineCache) return inlineCache[md];
    ensurePurifyHook();
    var html = window.DOMPurify.sanitize(window.marked.parseInline(md || ""), PURIFY_OPTS);
    inlineCache[md] = html;
    return html;
  }
  // Block-level markdown -> a React <div class="md"> (for modal/reader bodies).
  function renderMarkdown(md) {
    if (!md) return null;
    return getReact().createElement("div", {
      className: "md",
      dangerouslySetInnerHTML: { __html: sanitizeBlock(md) }
    });
  }
  // Cover image as a React element (absolute, fills a position:relative box),
  // or null when there's no image. Built in JS — NOT as <img src="{{ }}"> in the
  // template — so the browser parser doesn't eagerly fetch the unresolved
  // "{{ ... }}" string (which 404s) before the runtime renders.
  function cover(src, alt) {
    if (!src) return null;
    var style = {
      position: "absolute", inset: 0, width: "100%", height: "100%",
      objectFit: "cover", display: "block"
    };
    return getReact().createElement("img", { src: src, alt: alt || "", style: style });
  }

  // Inline markdown -> a React <span> (for card blurbs/excerpts: bold/italic/links).
  function renderInline(md) {
    if (md == null || md === "") return md;
    return getReact().createElement("span", {
      dangerouslySetInnerHTML: { __html: sanitizeInline(String(md)) }
    });
  }

  /* ---- shared .md stylesheet (injected once) ------------------------------ */
  var stylesInjected = false;
  function ensureStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      ".md{font-family:var(--ui);}" +
      ".md p{font-size:16px;line-height:1.72;color:var(--text);margin:0 0 22px;}" +
      ".md h2{font-family:var(--display);font-size:30px;letter-spacing:-0.01em;color:var(--ink);margin:36px 0 12px;}" +
      ".md h3{font-family:var(--display);font-size:26px;letter-spacing:-0.01em;color:var(--ink);margin:34px 0 10px;}" +
      ".md a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--underline);text-underline-offset:2px;}" +
      ".md strong{color:var(--ink);font-weight:600;}" +
      ".md em{font-style:italic;}" +
      ".md ul,.md ol{font-size:16px;line-height:1.72;color:var(--text);margin:0 0 22px;padding-left:1.3em;}" +
      ".md li{margin:0 0 8px;}" +
      ".md blockquote{margin:30px 0;padding:4px 0 4px 22px;border-left:2px solid var(--rule-quote);font-family:var(--display);font-size:21px;line-height:1.5;color:var(--text-2);font-style:italic;}" +
      ".md img{max-width:100%;height:auto;border-radius:12px;border:1px solid var(--border);margin:8px 0 24px;}" +
      ".md iframe{width:100%;aspect-ratio:16/9;border:1px solid var(--border);border-radius:12px;background:#000;margin:8px 0 24px;display:block;}" +
      ".md code{font-family:ui-monospace,Menlo,monospace;font-size:0.9em;background:var(--surface-muted);padding:1px 5px;border-radius:5px;}" +
      ".md pre{background:var(--surface-muted);border:1px solid var(--border);border-radius:10px;padding:16px;overflow:auto;margin:0 0 22px;}" +
      ".md pre code{background:none;padding:0;}" +
      ".md hr{border:none;border-top:1px solid var(--border);margin:34px 0;}" +
      /* tbody alias so the Thoughts reader's measured column matches */
      ".tbody.md p:first-child{font-family:var(--display);font-size:22px;line-height:1.5;color:var(--ink);}";
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- config ------------------------------------------------------------- */
  var configPromise = null;
  function config() {
    if (!configPromise) configPromise = fetchJSON("content/site.config.json");
    return configPromise;
  }

  /* ---- collections (per-item markdown folders) ---------------------------- */
  // Sort by a date-like key DESCENDING (newest first): `date` if present, else
  // `year`. Items with neither (e.g. books, which use `when:`/`status:`) keep
  // their manifest order. Then float `pinned: true` items to the front (stable).
  function sortItems(items) {
    function key(i) { return String(i.date || i.year || ""); }
    if (items.some(function (i) { return i.date || i.year; })) {
      items.sort(function (a, b) { return key(b).localeCompare(key(a)); });
    }
    items.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });
    return items;
  }
  // Per-item collection. Each item is its own folder: content/<name>/<slug>/,
  // with index.md the content and any co-located assets (cover.png, etc.).
  // manifest.json lists the folder names (slugs).
  function collection(name) {
    var base = "content/" + name + "/";
    return loadVendors()
      .then(function () { return fetchJSON(base + "manifest.json"); })
      .then(function (manifest) {
        var slugs = Array.isArray(manifest) ? manifest : (manifest.items || []);
        return Promise.all(slugs.map(function (slug) {
          var itemBase = base + encodeURIComponent(slug) + "/";
          return fetchText(itemBase + "index.md").then(function (text) {
            var d = parseDoc(text);
            var item = {};
            for (var k in d.data) item[k] = d.data[k];
            item.slug = slug;
            item.body = d.body;
            item._base = itemBase;
            item.image = resolveAsset(itemBase, d.data.image);
            return item;
          });
        }));
      })
      .then(sortItems);
  }

  // Single multi-entry file (books/articles/etc.). Frontmatter holds `items:`,
  // body is optional intro copy.
  function list(name, file) {
    var base = "content/" + name + "/";
    return loadVendors()
      .then(function () { return fetchText(base + file); })
      .then(function (text) {
        var d = parseDoc(text);
        var items = (d.data && d.data.items) || [];
        items.forEach(function (it) {
          if (it && it.image) it.image = resolveAsset(base, it.image);
        });
        return { items: items, meta: d.data || {}, intro: d.body || "" };
      });
  }

  // A single page-copy document (content/<name>/page.md).
  function page(name) {
    return loadVendors()
      .then(function () { return fetchText("content/" + name + "/page.md"); })
      .then(function (text) { return parseDoc(text); })
      .catch(function () { return { data: {}, body: "" }; });
  }

  // Prefetched integration JSON (content/data/<file>); null if absent.
  function data(file) {
    return fetchJSON("content/data/" + file).catch(function () { return null; });
  }

  /* ---- segmented Blocks/List toggle (shared) ------------------------------ */
  function segmented(self, opt) {
    opt = opt || {};
    var viewKey = opt.viewKey || "view";
    var view = self.state[viewKey] || opt.def || "blocks";
    var blocks = view !== "list";
    var activeIdx = blocks ? 0 : 1;
    var idxShown = self.state.hoverSeg != null ? self.state.hoverSeg : activeIdx;
    var indicator = {
      position: "absolute", top: "3px", bottom: "3px", width: "calc(50% - 3px)",
      left: idxShown === 0 ? "3px" : "50%", borderRadius: "999px", background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      transition: "left .26s cubic-bezier(.4,0,.2,1)"
    };
    var btn = function (on) {
      return {
        position: "relative", zIndex: 1, flex: 1, textAlign: "center", minWidth: "66px",
        border: "none", cursor: "pointer", background: "transparent",
        fontFamily: "var(--ui)", fontSize: "12.5px", padding: "6px 14px",
        color: on ? "#1f1d1a" : "#8b867e", fontWeight: on ? 600 : 500,
        transition: "color .2s ease"
      };
    };
    return {
      isBlocks: blocks, isList: !blocks,
      onBlocks: function () { self.setState(set(viewKey, "blocks")); },
      onList: function () { self.setState(set(viewKey, "list")); },
      segHover0: function () { self.setState({ hoverSeg: 0 }); },
      segHover1: function () { self.setState({ hoverSeg: 1 }); },
      segLeave: function () { self.setState({ hoverSeg: null }); },
      vIndicator: indicator, vBlocksBtn: btn(idxShown === 0), vListBtn: btn(idxShown === 1)
    };
  }
  function set(k, v) { var o = {}; o[k] = v; return o; }

  /* ---- modal controls (shared) ------------------------------------------- */
  // Esc-to-close + body-scroll-lock are handled by the base plumbing when a
  // module declares modalKey. These are the per-render handlers.
  function modalControls(self, key) {
    var item = self.state[key];
    return {
      isOpen: item != null,
      item: item || {},
      open: function (payload) {
        return function (e) {
          if (e && e.preventDefault) e.preventDefault();
          self.setState(set(key, payload));
        };
      },
      close: function () { self.setState(set(key, null)); },
      stop: function (e) { if (e && e.stopPropagation) e.stopPropagation(); }
    };
  }

  /* ---- page registry + async render plumbing ------------------------------ */
  var modules = {};
  function register(name, mod) { modules[name] = mod; }
  function mod(name) {
    var m = modules[name];
    if (!m) throw new Error("[site] no page module registered: " + name);
    return m;
  }
  function initialState(name) {
    var base = mod(name).state || {};
    var s = { _data: null };
    for (var k in base) s[k] = base[k];
    return s;
  }
  function mount(self, name) {
    ensureStyles();
    var m = mod(name);
    if (m.modalKey) {
      self.__siteEsc = function (e) {
        if (e.key === "Escape") self.setState(set(m.modalKey, null));
      };
      window.addEventListener("keydown", self.__siteEsc);
    }
    if (m.load) {
      Promise.resolve(m.load(self))
        .then(function (d) { self.setState({ _data: d || {} }); })
        .catch(function (e) {
          console.error("[site] load failed for", name, e);
          self.setState({ _data: {} });
        });
    } else {
      self.setState({ _data: {} });
    }
    if (m.mount) m.mount(self);
  }
  function updated(self, name, prev) {
    var m = mod(name);
    if (m.modalKey) {
      document.body.style.overflow = self.state[m.modalKey] != null ? "hidden" : "";
    }
    if (m.updated) m.updated(self, prev);
  }
  function unmount(self, name) {
    var m = mod(name);
    if (self.__siteEsc) window.removeEventListener("keydown", self.__siteEsc);
    document.body.style.overflow = "";
    if (m.unmount) m.unmount(self);
  }
  function render(self, name) {
    var m = mod(name);
    return m.build(self, self.state._data || {});
  }

  /* ---- placeholder-link guard --------------------------------------------
   * With <base href> set for clean URLs, a bare href="#" would resolve to the
   * site root and navigate away. Neutralize those dead links site-wide so they
   * behave as before (no-op). Real targets (e.g. "misc/#people") are untouched. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var h = a.getAttribute("href");
    if (h === "#" || h === "") e.preventDefault();
  }, false);

  /* ---- public API --------------------------------------------------------- */
  window.Site = {
    // utilities
    assign: assign,
    // content loading
    loadVendors: loadVendors, parseDoc: parseDoc, config: config,
    collection: collection, list: list, page: page, data: data,
    // markdown + images
    renderMarkdown: renderMarkdown, renderInline: renderInline, cover: cover,
    // ui helpers
    segmented: segmented, modalControls: modalControls,
    // page plumbing
    register: register, initialState: initialState, mount: mount,
    updated: updated, unmount: unmount, render: render
  };
})();
