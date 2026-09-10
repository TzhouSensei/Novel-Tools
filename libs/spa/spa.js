(function () {
    "use strict";

    const ROUTES = [
        {
            path: "",
            i18n: "spa.nav.overview",
            nav: "",
            frame: null,
        },
        {
            path: "mdt",
            i18n: "spa.nav.mdt",
            nav: "mdt",
            frame: "app/mdt/library/index.html",
        },
        {
            path: "mdt/editor",
            i18n: "spa.nav.mdt.editor",
            nav: "mdt",
            frame: "app/mdt/library/editor.html",
        },
        {
            path: "mdt/reader",
            i18n: "spa.nav.mdt.reader",
            nav: "mdt",
            frame: "app/mdt/library/reader.html",
        },
        {
            path: "mdt/chapter",
            i18n: "spa.nav.mdt.chapter",
            nav: "mdt",
            frame: "app/mdt/library/chapter.html",
        },
        {
            path: "mdt/creation-tools",
            i18n: "spa.nav.creation",
            nav: "mdt/creation-tools",
            frame: "app/mdt/library/creation_tools/index.html",
        },
        {
            path: "mdt/creation-tools/configuration",
            i18n: "spa.nav.creation.config",
            nav: "mdt/creation-tools",
            frame: "app/mdt/library/creation_tools/configuration/index.html",
        },
        {
            path: "mdt/creation-tools/parser",
            i18n: "spa.nav.creation.parser",
            nav: "mdt/creation-tools",
            frame: "app/mdt/library/creation_tools/parser/index.html",
        },
        {
            path: "ereader",
            i18n: "spa.nav.ereader",
            nav: "ereader",
            frame: "app/ereader/index.html",
        },
        {
            path: "ereader/read",
            i18n: "spa.nav.ereader.read",
            nav: "ereader",
            frame: "app/ereader/ereader.html",
        },
        {
            path: "converter",
            i18n: "spa.nav.converter",
            nav: "converter",
            frame: "app/converter/index.html",
        },
        {
            path: "infoeditor",
            i18n: "spa.nav.infoeditor",
            nav: "infoeditor",
            frame: "app/infoeditor/index.html",
        },
        {
            path: "creator",
            i18n: "spa.nav.creator",
            nav: "creator",
            frame: "app/creator/index.html",
        },
    ];

    const ROUTE_TITLES = {
        "": "Tổng quan",
        mdt: "📚 MDT Library",
        "mdt/editor": "✏️ Chỉnh sửa truyện",
        "mdt/reader": "📖 Đọc truyện",
        "mdt/chapter": "📄 Chương",
        "mdt/creation-tools": "🛠 Công cụ tạo EPUB",
        "mdt/creation-tools/configuration": "⚙️ Cấu hình EPUB",
        "mdt/creation-tools/parser": "🧩 Trình tạo EPUB",
        ereader: "📖 EPUB Reader",
        "ereader/read": "📖 Đọc sách",
        converter: "🔁 Converter EPUB ➜ TXT",
        infoeditor: "✍️ EPUB Info Editor",
        creator: "✦ Story Studio",
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];

    let currentRoute = null;
    let isNavigating = false;
    let lastOriginPath = "";
    function tl(key) {
        return window.t && typeof window.t === "function" ? window.t(key) : key;
    }

    function normalizePath(value) {
        let s = String(value == null ? "" : value).split("?")[0];
        if (s.charAt(0) === "#") s = s.slice(1);
        s = s.replace(/^\/+|\/+$/g, "");
        if (/^index\.html?$/i.test(s)) s = "";
        return s;
    }

    function routePathOrHome(value) {
        const clean = normalizePath(value);
        return ROUTES.some((r) => r.path === clean) ? clean : "";
    }

    function currentRoutePath() {
        const h = location.hash || "";
        if (h.length > 1 && h !== "#/" && h !== "#") {
            return routePathOrHome(h.slice(1));
        }
        let p = location.pathname || "/";
        if (BASE && p.indexOf(BASE) === 0) p = p.slice(BASE.length);
        return routePathOrHome(p);
    }

    function urlForPath(path) {
        const p = normalizePath(path);
        return p ? `#/${p}` : "#/";
    }

    function syncUrl(path, replace) {
        try {
            const p = normalizePath(path);
            const url = urlForPath(p);
            if (replace) history.replaceState({ path: p }, "", url);
            else history.pushState({ path: p }, "", url);
            return true;
        } catch (e) {
            return false;
        }
    }

    function findRoute(path) {
        const clean = normalizePath(path);
        if (!clean) return ROUTES[0];
        const hit = ROUTES.find((r) => r.path === clean);
        return hit || ROUTES[0];
    }

    function routeForReload(path) {
        const route = findRoute(path);
        if (!route || !route.frame) return null;
        if (route.frame.indexOf("app/ereader/") === 0) {
            return findRoute("ereader");
        }
        return route;
    }

    function routeForFrame(href) {
        if (!href) return null;
        let best = null;
        for (const r of ROUTES) {
            if (!r.frame) continue;
            if (href.endsWith(r.frame) || href.indexOf("/" + r.frame) !== -1) {
                if (!best || r.frame.length > best.frame.length) best = r;
            }
        }
        return best;
    }

    function routeTitle(route) {
        if (!route) return "";
        const tr = tl(route.i18n);
        return tr && tr !== route.i18n
            ? tr
            : ROUTE_TITLES[route.path] || tr || "";
    }

    function setActive(navPath) {
        $$("[data-route]").forEach((el) => {
            el.classList.toggle(
                "active",
                el.getAttribute("data-route") === navPath,
            );
        });

        const dd = document.getElementById("creationDropdown");
        if (dd) {
            const isChild =
                navPath === "mdt/creation-tools" ||
                navPath === "mdt/creation-tools/parser" ||
                navPath === "mdt/creation-tools/configuration";
            dd.classList.toggle("active-child", isChild);
        }
    }

    function setCreationDropdown(open) {
        const dd = document.getElementById("creationDropdown");
        const toggle = document.getElementById("creationToggle");
        if (dd) dd.classList.toggle("open", open);
        if (toggle) {
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }
    }

    function setBreadcrumb(text) {
        const bc = document.getElementById("breadcrumb");
        if (bc) bc.textContent = text;
    }

    function toast(msg) {
        const el = document.getElementById("toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => el.classList.remove("show"), 2200);
    }

    const BACK_ROUTES = {
        mdt: "",

        "mdt/editor": "mdt",
        "mdt/reader": "mdt",
        "mdt/chapter": "mdt/reader",

        "mdt/creation-tools": "mdt",
        "mdt/creation-tools/parser": "mdt/creation-tools",
        "mdt/creation-tools/configuration": "mdt/creation-tools",

        ereader: "",
        "ereader/read": "ereader",

        converter: "",
        infoeditor: "",
        creator: "",
    };
    function applyTopbarVisibility(route) {
        const readerView = !!(
            route &&
            route.frame &&
            route.frame.indexOf("ereader.html") !== -1
        );
        document.body.classList.toggle("topbar-hidden", readerView);

        const backTarget = !!(
            route &&
            Object.prototype.hasOwnProperty.call(BACK_ROUTES, route.path)
        );
        document.body.classList.toggle("back-hidden", !backTarget);
    }

    function goBack() {
        if (!currentRoute) {
            go("", true);
            return;
        }

        const parent = BACK_ROUTES[currentRoute.path];

        if (parent !== undefined) {
            go(parent, true);
            return;
        }

        history.back();
    }

    function applyShellI18n() {
        if (window.applyI18n) window.applyI18n();
        if (window.syncLangSelect) {
            const lang =
                localStorage.getItem("lang") ||
                localStorage.getItem("language") ||
                "vi-vn";
            window.syncLangSelect(lang);
        }
    }

    var PIN_ICON_OFF =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
    var PIN_ICON_ON =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';

    function isPinned() {
        return document.body.classList.contains("sidebar-pinned");
    }

    function updatePinButton() {
        const pin = document.getElementById("pinSidebar");
        if (!pin) return;
        pin.classList.toggle("pinned", isPinned());
        pin.title = isPinned() ? tl("spa.pin.unpin") : tl("spa.pin.title");
        pin.innerHTML = isPinned() ? PIN_ICON_ON : PIN_ICON_OFF;
    }

    function setPinned(on) {
        try {
            localStorage.setItem("spa_sidebar_pinned", on ? "1" : "0");
        } catch (e) {}
        document.body.classList.toggle("sidebar-pinned", on);
        updatePinButton();

        openSidebar(on);
    }

    function openSidebar(open) {
        const sb = document.querySelector(".sidebar");
        const bk = document.getElementById("sidebarBackdrop");
        if (sb) sb.classList.toggle("open", open);
        if (bk) bk.classList.toggle("show", open);
    }

    function initSidebar() {
        const menu = document.getElementById("mobileMenu");
        const pin = document.getElementById("pinSidebar");
        const bk = document.getElementById("sidebarBackdrop");

        let saved = false;
        try {
            saved = localStorage.getItem("spa_sidebar_pinned") === "1";
        } catch (e) {}
        setPinned(saved);

        if (menu) {
            menu.addEventListener("click", (e) => {
                e.stopPropagation();
                const sb = document.querySelector(".sidebar");
                const open = sb ? sb.classList.contains("open") : false;
                openSidebar(!open);
            });
        }

        if (pin) {
            pin.addEventListener("click", (e) => {
                e.stopPropagation();
                setPinned(!isPinned());
            });
        }

        if (bk) {
            bk.addEventListener("click", () => openSidebar(false));
        }

        document.addEventListener("click", (e) => {
            const sb = document.querySelector(".sidebar");
            if (
                sb &&
                sb.classList.contains("open") &&
                !sb.contains(e.target) &&
                e.target.id !== "mobileMenu"
            ) {
                openSidebar(false);
            }

            const dd = document.getElementById("creationDropdown");
            if (dd && dd.classList.contains("open") && !dd.contains(e.target)) {
                setCreationDropdown(false);
            }
        });
    }

    function homeCard(hash, icon, nameKey, descKey, nameFb, descFb) {
        return (
            '<button type="button" class="home-card" data-go="' +
            hash +
            '">' +
            '<span class="hc-icon">' +
            icon +
            "</span>" +
            '<span class="hc-body"><span class="hc-name" data-i18n="' +
            nameKey +
            '">' +
            nameFb +
            "</span>" +
            '<span class="hc-desc" data-i18n="' +
            descKey +
            '">' +
            descFb +
            "</span></span></button>"
        );
    }

    function renderHome() {
        const box = document.getElementById("homeView");
        if (!box) return;
        box.innerHTML =
            '<div class="page-head"><div>' +
            '<h1 data-i18n="spa.home.title">⚡ Novel Tools</h1>' +
            '<p class="muted" data-i18n="spa.home.subtitle">Bộ công cụ tiểu thuyết — chọn một công cụ để bắt đầu.</p>' +
            "</div></div>" +
            '<div class="home-grid">' +
            homeCard(
                "mdt",
                "📚",
                "spa.nav.mdt",
                "spa.home.desc.mdt",
                "MDT Library",
                "Thư viện & đọc truyện MDT (TXT)",
            ) +
            homeCard(
                "ereader",
                "📖",
                "spa.nav.ereader",
                "spa.home.desc.ereader",
                "EPUB Reader",
                "Quản lý & đọc sách EPUB cục bộ",
            ) +
            homeCard(
                "converter",
                "🔁",
                "spa.nav.converter",
                "spa.home.desc.converter",
                "Converter EPUB ➜ TXT",
                "Chuyển EPUB sang TXT nhiều kiểu",
            ) +
            homeCard(
                "infoeditor",
                "✍️",
                "spa.nav.infoeditor",
                "spa.home.desc.infoeditor",
                "EPUB Info Editor",
                "Sửa metadata hàng loạt cho EPUB",
            ) +
            homeCard(
                "creator",
                "✦",
                "spa.nav.creator",
                "spa.home.desc.creator",
                "Story Studio",
                "Tạo & quản lý truyện (SPA)",
            ) +
            homeCard(
                "mdt/creation-tools",
                "🛠",
                "spa.nav.creation",
                "spa.home.desc.creation",
                "Công cụ tạo EPUB",
                "Cấu hình & sinh file EPUB từ MDT",
            ) +
            "</div>";
        applyShellI18n();
    }

    function frameCurrentLoaded(route) {
        const f = document.getElementById("toolFrame");
        if (!f) return false;
        try {
            const href = f.contentWindow && f.contentWindow.location.href;
            return !!href && href.indexOf(route.frame) !== -1;
        } catch (e) {
            return false;
        }
    }

    const BASE = (function () {
        const p = location.pathname;
        const m = p.match(/^(.*\/)index\.html?$/i);
        if (m) return m[1];

        let best = null;
        const lookup = p.replace(/\/+$/, "") || "/";
        for (const r of ROUTES) {
            if (!r.path) continue;
            if (lookup === r.path || lookup.endsWith("/" + r.path)) {
                if (!best || r.path.length > best.length) best = r.path;
            }
        }
        if (best) {
            let base = lookup.slice(0, lookup.length - best.length);
            if (!base.endsWith("/")) base += "/";
            return base;
        }

        return p.substring(0, p.lastIndexOf("/") + 1) || "/";
    })();

    function showFrame(route) {
        const frame = document.getElementById("toolFrame");
        const content = document.getElementById("content");
        const home = document.getElementById("homeView");
        if (!frame || !content) return;

        content.classList.add("view-frame");
        if (home) home.hidden = true;
        frame.hidden = false;

        currentRoute = route;

        if (!frameCurrentLoaded(route)) {
            isNavigating = true;

            const cleanFrame = route.frame.replace(/^\/+/, "");
            frame.src = BASE + cleanFrame;
        }

        document.title = routeTitle(route) + " — Novel Tools";
        setBreadcrumb(routeTitle(route));
        setActive(route.nav);
        applyTopbarVisibility(route);
        updatePinButton();
    }

    function showHome() {
        const frame = document.getElementById("toolFrame");
        const content = document.getElementById("content");
        const home = document.getElementById("homeView");
        if (!frame || !content) return;

        content.classList.remove("view-frame");
        frame.hidden = true;
        if (home) {
            home.hidden = false;
            renderHome();
        }

        const homeRoute = ROUTES[0];
        document.title = routeTitle(homeRoute) + " — Novel Tools";
        currentRoute = homeRoute;
        setBreadcrumb(routeTitle(homeRoute));
        setActive(homeRoute.nav);
        applyTopbarVisibility(homeRoute);
        applyShellI18n();
        updatePinButton();
    }

    function renderRoute(route) {
        if (route.frame) showFrame(route);
        else showHome();
        openSidebar(false);
        setCreationDropdown(false);
    }

    function go(path, updateHistory) {
        const route = findRoute(path);
        if (!route) return;
        if (currentRoute && currentRoute.path !== route.path) {
            lastOriginPath = currentRoute.path;
        }
        renderRoute(route);
        if (updateHistory && currentRoutePath() !== route.path) {
            syncUrl(route.path, false);
        }
    }

    function onLangChanged() {
        applyShellI18n();
        if (currentRoute) {
            setBreadcrumb(routeTitle(currentRoute));
            document.title = routeTitle(currentRoute) + " — Novel Tools";
            setActive(currentRoute.nav);
        }
        if (currentRoute && !currentRoute.frame) renderHome();
        updatePinButton();

        const f = document.getElementById("toolFrame");
        if (f && !f.hidden && currentRoute && currentRoute.frame) {
            if (frameCurrentLoaded(currentRoute)) {
                const src = f.src;
                f.src = "about:blank";
                requestAnimationFrame(() => {
                    f.src = src;
                });
            }
        }
    }

    function init() {
        const frame = document.getElementById("toolFrame");

        $$("[data-route]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                go(el.getAttribute("data-route"), true);
            });
        });

        const brand = document.getElementById("brand");
        if (brand) {
            brand.addEventListener("click", () => go("", true));
        }

        const backBtn = document.getElementById("backBtn");
        if (backBtn) {
            backBtn.addEventListener("click", goBack);
        }

        const creationToggle = document.getElementById("creationToggle");
        if (creationToggle) {
            creationToggle.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dd = document.getElementById("creationDropdown");
                setCreationDropdown(!(dd && dd.classList.contains("open")));
            });
        }

        initSidebar();

        const home = document.getElementById("homeView");
        if (home) {
            home.addEventListener("click", (e) => {
                const card = e.target.closest(".home-card");
                if (card && card.getAttribute("data-go")) {
                    go(card.getAttribute("data-go"), true);
                }
            });
        }

        if (frame) {
            frame.addEventListener("load", () => {
                if (isNavigating) {
                    isNavigating = false;
                    return;
                }

                try {
                    const href =
                        frame.contentWindow &&
                        frame.contentWindow.location.href;
                    if (!href || href === "about:blank") return;

                    const r = routeForFrame(href);
                    if (r && (!currentRoute || currentRoute.path !== r.path)) {
                        currentRoute = r;
                        document.title = routeTitle(r) + " — Novel Tools";
                        setBreadcrumb(routeTitle(r));
                        setActive(r.nav);
                        syncUrl(r.path, true);
                    }

                    if (r) applyTopbarVisibility(r);
                } catch (e) {}
            });
        }

        window.addEventListener("popstate", () => {
            renderRoute(findRoute(currentRoutePath()));
        });
        window.addEventListener("hashchange", () => {
            renderRoute(findRoute(currentRoutePath()));
        });

        window.addEventListener("message", (e) => {
            if (e.data && e.data.action === "close_editor_iframe") {
                go("infoeditor", true);
            }
        });

        if (window.onI18nChange) {
            window.onI18nChange(onLangChanged);
        }

        window.spaTool = { go: go, toast: toast };

        const reloadRoute = routeForReload(currentRoutePath());
        go(reloadRoute ? reloadRoute.path : "", false);
        if (currentRoute) syncUrl(currentRoute.path, true);
        applyShellI18n();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
