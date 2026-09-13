(function () {
    "use strict";

    var STORAGE_KEY = "reader-theme";
    var LEVEL_STORAGE_KEY = "reader-theme-level";
    var CHANNEL_NAME = "novel-tools-theme";
    var THEME_SCRIPT_URL =
        document.currentScript && document.currentScript.src
            ? document.currentScript.src
            : "";
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
        "heaven_moon",
        "bagua_field",
        "dark_fantasy",
        "guild_lobby",
        "old_structure_ancient_china",
        "old_structure_modern_western",
        "old_structure_ancient_western",
        "old_babel",
        "black_beacon",
        "bamboo_forest",
        "pixelated",
    ];
    var IMAGE_THEMES = {
        deep: "deep",
        anias: "anias",
        ruby: "ruby",
        navajo: "navajo",
        khaki: "khaki",
        dark_neon: "neon",
        mint: "mint",
        sakura: "sakura",
        lavender: "lavender",
        mocha: "mocha",
        ocean: "ocean",
        ember: "ember",
        universe: "universe",
        frost_land: "frost",
        heaven_moon: "heaven",
        bagua_field: "bagua",
        dark_fantasy: "fantasy",
        guild_lobby: "guild",
        old_structure_ancient_china: "china",
        old_structure_modern_western: "modern",
        old_structure_ancient_western: "ancient",
        old_babel: "babel",
        black_beacon: "beacon",
        bamboo_forest: "bamboo",
        pixelated: "pixelated",
    };
    var DARK_THEMES = [
        "dark",
        "deep",
        "dark_neon",
        "ruby",
        "ocean",
        "ember",
        "universe",
        "heaven_moon",
        "dark_fantasy",
        "black_beacon",
        "pixelated",
        "bagua_field",
        "guild_lobby",
        "old_structure_ancient_china",
        "old_structure_modern_western",
        "old_structure_ancient_western",
        "old_babel",
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
        heaven_moon: "🌕 Heaven Moon",
        bagua_field: "☯ Bagua Field",
        dark_fantasy: "🧙 Dark Fantasy",
        guild_lobby: "⚒ Guild Lobby",
        old_structure_ancient_china: "🏯 Old Structure (Ancient China)",
        old_structure_modern_western: "🏛 Old Structure (Modern Western)",
        old_structure_ancient_western: "🏛 Old Structure (Ancient Western)",
        old_babel: "🗼 Old Babel",
        black_beacon: "🗼 Black Beacon",
        bamboo_forest: "🎋 Bamboo Forest",
        pixelated: "👾 Pixelated",
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

    function getLevel() {
        var saved = "";
        try {
            saved = localStorage.getItem(LEVEL_STORAGE_KEY) || "";
        } catch (e) {}
        return saved === "image" ? "image" : "minimal";
    }

    function hasImage(theme) {
        return theme && IMAGE_THEMES[theme] !== undefined;
    }

    function getImagePath(theme) {
        var prefix = IMAGE_THEMES[theme];
        if (!prefix) return null;
        var suffix = window.innerWidth < window.innerHeight ? "mobile" : "desktop";
        var file = prefix + "-" + suffix + ".jpg";
        if (prefix === "khaki" && suffix === "desktop") {
            file = "khaki-destop.jpg";
        }
        var base = THEME_SCRIPT_URL
            ? new URL(".", THEME_SCRIPT_URL).href
            : new URL("libs/theme/", document.baseURI).href;
        return new URL(file, base).href;
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

        applyThemeLevel(valid);
        syncSelects(valid);
        updateLevelSelects(valid);
        updateLevelSelectVisibility(valid);
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

    function applyThemeLevel(theme) {
        var body = document.body;
        if (!body) return;
        body.classList.remove("theme-image");
        body.style.removeProperty("background-image");
        if (hasImage(theme) && getLevel() === "image") {
            body.classList.add("theme-image");
            var path = getImagePath(theme);
            if (path) {
                body.style.setProperty(
                    "background-image",
                    "url(\"" + path + "\")",
                    "important",
                );
            }
        }
    }

    function updateLevelSelects(theme) {
        var selects = document.querySelectorAll("select#themeLevelSelect");
        for (var i = 0; i < selects.length; i++) {
            selects[i].value = getLevel();
        }
    }

    function updateLevelSelectVisibility(theme) {
        var containers = document.querySelectorAll(".theme-level-container");
        for (var i = 0; i < containers.length; i++) {
            var show = hasImage(theme);
            containers[i].style.display = show ? "" : "none";
        }
    }

    function bindLevelSelects() {
        var selects = document.querySelectorAll("select#themeLevelSelect");
        for (var i = 0; i < selects.length; i++) {
            var select = selects[i];
            if (select.__novelLevelBound) continue;
            select.__novelLevelBound = true;
            select.value = getLevel();
            select.addEventListener("change", function () {
                var level = this.value === "image" ? "image" : "minimal";
                try {
                    localStorage.setItem(LEVEL_STORAGE_KEY, level);
                } catch (e) {}
                applyTheme(getTheme());
            });
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
            bindLevelSelects();
        });
    } else {
        bindSelects();
        bindLevelSelects();
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
        if (e.key === LEVEL_STORAGE_KEY) {
            applyTheme(getTheme());
        }
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var body = document.body;
            if (body && body.classList.contains("theme-image")) {
                applyTheme(getTheme());
            }
        }, 200);
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
        getLevel: getLevel,
        setLevel: function (level) {
            var v = level === "image" ? "image" : "minimal";
            try {
                localStorage.setItem(LEVEL_STORAGE_KEY, v);
            } catch (e) {}
            applyTheme(getTheme());
        },
        hasImage: hasImage,
    };
})();
