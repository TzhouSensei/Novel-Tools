(function () {
    "use strict";

    var STORAGE_KEY = "reader-theme";
    var CHANNEL_NAME = "novel-tools-theme";
    var THEMES = [
        "dark",
        "deep",
        "anias",
        "ruby",
        "navajo",
        "khaki",
        "dark_neon",
        "mint",
        "sakura",
        "lavender",
        "mocha",
        "ocean",
        "ember",
        "universe",
        "frost_land",
    ];
    var DARK_THEMES = [
        "dark",
        "deep",
        "dark_neon",
        "ruby",
        "ocean",
        "ember",
        "universe",
    ];
    var THEME_LABELS = {
        dark: "🌙 Dark",
        deep: "🕳 Deep",
        anias: "🍂 Anias",
        ruby: "💎 Ruby",
        navajo: "🏜 Navajo",
        khaki: "🌾 Khaki",
        dark_neon: "🌌 Dark Neon",
        mint: "🌿 Mint",
        sakura: "🌸 Sakura",
        lavender: "💜 Lavender",
        mocha: "☕ Mocha",
        ocean: "🌊 Ocean",
        ember: "🔥 Ember",
        universe: "🪐 Universe",
        frost_land: "❄️ Frost Land",
    };

    var listeners = [];

    var broadcast = null;
    try {
        if (typeof BroadcastChannel !== "undefined") {
            broadcast = new BroadcastChannel(CHANNEL_NAME);
        }
    } catch (e) {
        broadcast = null;
    }

    function normalizeTheme(value) {
        return THEMES.indexOf(value) !== -1 ? value : "";
    }

    function getTheme() {
        var saved = "";
        try {
            saved = localStorage.getItem(STORAGE_KEY) || "";
        } catch (e) {}
        return normalizeTheme(saved);
    }

    function updateThemeColor(theme) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", "theme-color");
            (document.head || document.documentElement).appendChild(meta);
        }
        meta.setAttribute(
            "content",
            DARK_THEMES.indexOf(theme) !== -1 ? "#1b1b1b" : "#f5f7fa",
        );
    }

    function syncSelects(theme) {
        var selects = document.querySelectorAll("select#themeSelect");
        for (var i = 0; i < selects.length; i++) {
            selects[i].value = theme;
        }
    }

    function applyTheme(theme, opts) {
        opts = opts || {};
        var valid = normalizeTheme(theme);
        var root = document.documentElement;
        var body = document.body;
        var i;

        if (root) {
            for (i = 0; i < THEMES.length; i++)
                root.classList.remove(THEMES[i]);
            if (valid) root.classList.add(valid);
        }

        if (body) {
            for (i = 0; i < THEMES.length; i++)
                body.classList.remove(THEMES[i]);
            if (valid) body.classList.add(valid);
        }

        syncSelects(valid);
        updateThemeColor(valid);

        if (opts.persist) {
            try {
                if (valid) localStorage.setItem(STORAGE_KEY, valid);
                else localStorage.removeItem(STORAGE_KEY);
            } catch (e) {}
        }

        if (opts.broadcast && broadcast) {
            try {
                broadcast.postMessage(valid);
            } catch (e) {}
        }

        for (i = 0; i < listeners.length; i++) {
            try {
                listeners[i](valid);
            } catch (e) {}
        }
    }

    function ensureOptions(select) {
        var have = {};
        for (var i = 0; i < select.options.length; i++) {
            have[select.options[i].value] = true;
        }
        if (!have[""]) {
            var def = document.createElement("option");
            def.value = "";
            def.textContent = "🎨 Default";
            select.insertBefore(def, select.firstChild);
        }
        for (var t = 0; t < THEMES.length; t++) {
            var name = THEMES[t];
            if (have[name]) continue;
            var opt = document.createElement("option");
            opt.value = name;
            opt.textContent = THEME_LABELS[name] || name;
            select.appendChild(opt);
        }
    }

    function bindSelects() {
        var selects = document.querySelectorAll("select#themeSelect");
        for (var i = 0; i < selects.length; i++) {
            var select = selects[i];
            if (select.__novelThemeBound) continue;
            select.__novelThemeBound = true;
            ensureOptions(select);
            select.value = getTheme();
            select.addEventListener("change", function () {
                applyTheme(this.value, { persist: true, broadcast: true });
            });
        }
    }

    applyTheme(getTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            applyTheme(getTheme());
            bindSelects();
        });
    } else {
        bindSelects();
    }

    if (broadcast) {
        broadcast.onmessage = function (event) {
            if (typeof event.data === "string") {
                applyTheme(event.data, { persist: true });
            }
        };
    }

    window.addEventListener("storage", function (e) {
        if (e.key === STORAGE_KEY) {
            applyTheme(e.newValue || "");
        }
    });

    window.NovelTheme = {
        THEMES: THEMES,
        get: getTheme,
        set: function (theme) {
            applyTheme(theme, { persist: true, broadcast: true });
        },
        onChange: function (fn) {
            if (typeof fn === "function") listeners.push(fn);
        },
    };
})();
