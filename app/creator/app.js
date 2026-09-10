const DB_NAME = "StoryStudioDB",
    DB_VERSION = 1,
    STORE = "books";
let db,
    state = {
        view: "dashboard",
        bookId: null,
        tab: "chapters",
        chapterTab: "list",
        relTab: "list",
        abilityTab: "list",
        realmTab: "list",
        systemsTab: "overview",
        systemDslId: null,
        editing: null,
        returnTo: "dashboard",
    };

function saveState() {
    try {
        localStorage.setItem(
            "creatorState",
            JSON.stringify({
                view: state.view,
                bookId: state.bookId,
                tab: state.tab,
                chapterTab: state.chapterTab,
                relTab: state.relTab,
                abilityTab: state.abilityTab,
                realmTab: state.realmTab,
                systemsTab: state.systemsTab,
                returnTo: state.returnTo,
            }),
        );
    } catch (e) {}
}
function restoreState() {
    try {
        const raw = localStorage.getItem("creatorState");
        if (!raw) return false;
        const s = JSON.parse(raw);
        Object.assign(state, s);
        state.systemDslId = null;
        return true;
    } catch (e) {
        return false;
    }
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const uid = () =>
    crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();
const esc = (s) =>
    String(s ?? "").replace(
        /[&<>"']/g,
        (m) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[m],
    );
const slug = (s) =>
    String(s || "book")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "book";
const now = () => new Date().toISOString();
function tFn(key, fallback) {
    return typeof t === "function" ? t(key, fallback) : fallback;
}
function localeTag() {
    return typeof currentLang === "string" && currentLang
        ? currentLang
        : "vi-VN";
}

function fmt(s, ...args) {
    return String(s).replace(/\{(\d+)\}/g, (m, i) => args[i] ?? m);
}
function tagComboHTML(id, tags, currentValue) {
    const opts = tags
        .map(
            (t) =>
                `<div class="combo-option" data-value="${esc(t)}">${esc(t)}</div>`,
        )
        .join("");
    return `<div class="combo-box" data-combobox="${id}"><input name="tags" value="${esc(currentValue)}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}" class="combo-input" autocomplete="off"><button type="button" class="combo-toggle" tabindex="−1">▼</button><div class="combo-dropdown" data-dropdown="${id}">${opts}</div></div>`;
}
const EFFECT_TYPE_OPTIONS = [
    "buff",
    "debuff",
    "natural",
    "cc",
    "dot",
    "hot",
    "shield",
    "resource",
    "stat_mod",
    "custom",
];
const EFFECT_TARGET_OPTIONS = ["self", "ally", "enemy", "area", "custom"];
const QUEST_TYPE_OPTIONS = [
    "main",
    "side",
    "daily",
    "hidden",
    "faction",
    "character",
    "tutorial",
    "custom",
];
const QUEST_PRIORITY_OPTIONS = ["low", "normal", "high", "critical"];
function effectComboHTML(
    name,
    keyPrefix,
    options,
    cur,
    keyBase = "creator.effect.",
) {
    const curVal = cur ? cur : options[0];
    const labelOf = (v) => tFn(keyBase + keyPrefix + "." + v, v);
    const opts = options
        .map(
            (v) =>
                `<div class="combo-option" data-value="${esc(v)}">${esc(labelOf(v))}</div>`,
        )
        .join("");
    return `<div class="combo-box" data-combobox="${name}"><input type="hidden" name="${name}" value="${esc(curVal)}"><input type="text" class="combo-input" value="${esc(labelOf(curVal))}" autocomplete="off"><button type="button" class="combo-toggle" tabindex="-1">▼</button><div class="combo-dropdown" data-dropdown="${name}">${opts}</div></div>`;
}
const DEFINITION_TAG_OPTIONS = [
    "faction_rules",
    "stat",
    "effect",
    "realms_rules",
    "contract",
    "role",
    "buff_effect",
    "debuff_effect",
    "natural_effect",
    "race",
    "command",
    "plan",
    "explain",
    "money",
];
const ABILITY_TAG_OPTIONS = [
    "single_target",
    "aoe",
    "heal",
    "hard_crowd_control",
    "damage",
    "shield",
    "movement",
    "soft_crowd_control",
    "enhancement",
    "magic",
    "skill",
];
const CJK_CHAR_RE = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/gu;
const wordCount = (s) => {
    const text = String(s || "");
    const cjk = (text.match(CJK_CHAR_RE) || []).length;
    const rest = text.replace(CJK_CHAR_RE, " ").trim();
    return cjk + (rest ? rest.split(/\s+/).length : 0);
};
const BOOK_ARRAYS = [
    "chapters",
    "items",
    "characters",
    "factions",
    "abilities",
    "relations",
    "arcs",
    "timeline",
    "skillsets",
    "itemsets",
    "realms",
    "locations",
    "rules",
    "definitions",
];
const ENTITY_KEYS = {
    chapter: "chapters",
    item: "items",
    character: "characters",
    faction: "factions",
    ability: "abilities",
    skillset: "skillsets",
    itemset: "itemsets",
    realm: "realms",
    location: "locations",
    rule: "rules",
    definition: "definitions",
    relation: "relations",
};
const entityKey = (type) => ENTITY_KEYS[type] || type + "s";
const DISPLAY_SECTIONS = [
    "items",
    "itemsets",
    "characters",
    "factions",
    "realms",
    "locations",
    "abilities",
    "skillsets",
    "definitions",
    "systems",
    "relations",
    "timeline",
    "sysstats",
    "sysresources",
    "syscurrencies",
    "syseffects",
    "sysquests",
    "syscombat",
];
const DISPLAY_DEFAULTS = (() => {
    const d = {};
    for (const k of DISPLAY_SECTIONS) d[k] = "visible";
    return d;
})();
const dsHidden = (ds, key) => (ds || {})[key] === "hidden";
const CB_GROUP_FALLBACK = {
    attack: "Tấn công",
    defense: "Phòng thủ",
    critical: "Chí mạng",
    penetration: "Xuyên phá",
    accuracy: "Chính xác",
    evasion: "Né tránh",
    resistance: "Kháng hiệu",
    damageMods: "Sát thương",
};
const ILLU_TYPES = [
    "character",
    "item",
    "itemset",
    "faction",
    "realm",
    "ability",
    "skillset",
];
const POPULAR_GENRES = [
    { v: "Fantasy", k: "creator.genre.fantasy", f: "Fantasy" },
    { v: "Sci-Fi", k: "creator.genre.scifi", f: "Sci-Fi" },
    { v: "Xuyên Không", k: "creator.genre.xuyen_khong", f: "Xuyên Không" },
    { v: "Đô Thị", k: "creator.genre.do_thi", f: "Đô Thị" },
    { v: "Huyền Thiên", k: "creator.genre.huyen_thien", f: "Huyền Thiên" },
    { v: "Đạo Diễn", k: "creator.genre.dao_dien", f: "Đạo Diễn" },
    { v: "Lãng Mạn", k: "creator.genre.lang_man", f: "Lãng Mạn" },
    { v: "Hành Động", k: "creator.genre.hanh_dong", f: "Hành Động" },
    { v: "Kinh Dị", k: "creator.genre.kinh_di", f: "Kinh Dị" },
    { v: "Hài", k: "creator.genre.hai", f: "Hài" },
    { v: "Trọng Sinh", k: "creator.genre.trong_sinh", f: "Trọng Sinh" },
    { v: "Ngôn Tĩnh", k: "creator.genre.ngon_tinh", f: "Ngôn Tĩnh" },
    { v: "Phiêu Lưu", k: "creator.genre.phieu_luu", f: "Phiêu Lưu" },
    {
        v: "Thế Giới Diệt",
        k: "creator.genre.the_gioi_diet",
        f: "Thế Giới Diệt",
    },
];

function normalizeBook(b) {
    if (!b || typeof b !== "object") return b;
    for (const k of BOOK_ARRAYS) if (!Array.isArray(b[k])) b[k] = [];
    if (!Array.isArray(b.genres)) b.genres = [];
    if (Array.isArray(b.abilitys) && b.abilitys.length) {
        const seen = new Set(
            (b.abilities || []).map((x) => (x && x.id) || "").filter(Boolean),
        );
        for (const x of b.abilitys) {
            if (x && x.id && !seen.has(x.id)) {
                b.abilities.push(x);
                seen.add(x.id);
            }
        }
    }
    delete b.abilitys;
    b.displaySettings = Object.assign(
        {},
        DISPLAY_DEFAULTS,
        b.displaySettings || {},
    );
    if (!b.systems || typeof b.systems !== "object") b.systems = {};
    for (const k of ["stats", "resources", "currencies", "effects", "quests"])
        if (!Array.isArray(b.systems[k])) b.systems[k] = [];
    if (!Array.isArray(b.systems.combat)) {
        const oldCombat =
            b.systems.combat && typeof b.systems.combat === "object"
                ? b.systems.combat
                : {};
        b.systems.combat = Object.entries(oldCombat).map(([gk, rows]) => ({
            id: uid(),
            name: tFn("creator.sys.cb_" + gk, CB_GROUP_FALLBACK[gk] || gk),
            description: "",
            tags: [],
            stats: (Array.isArray(rows) ? rows : [])
                .filter((r) => r && r.statId)
                .map((r) => ({ statId: r.statId, note: r.note || "" })),
        }));
    }
    for (const c of b.systems.combat) {
        if (!c || typeof c !== "object") continue;
        if (!c.id) c.id = uid();
        if (!Array.isArray(c.tags)) c.tags = [];
        if (!Array.isArray(c.stats)) c.stats = [];
    }
    return b;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) {
                const st = d.createObjectStore(STORE, { keyPath: "id" });
                st.createIndex("updatedAt", "updatedAt");
            }
        };
        r.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        r.onerror = () => reject(r.error);
    });
}
function allBooks() {
    return new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).getAll();
        r.onsuccess = () => res((r.result || []).map(normalizeBook));
        r.onerror = () => rej(r.error);
    });
}
function getBook(id) {
    return new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).get(id);
        r.onsuccess = () => res(normalizeBook(r.result));
        r.onerror = () => rej(r.error);
    });
}
function putBook(book) {
    book.updatedAt = now();
    return new Promise((res, rej) => {
        const r = db
            .transaction(STORE, "readwrite")
            .objectStore(STORE)
            .put(book);
        r.onsuccess = () => res(book);
        r.onerror = () => rej(r.error);
    });
}
function deleteBook(id) {
    return new Promise((res, rej) => {
        const r = db
            .transaction(STORE, "readwrite")
            .objectStore(STORE)
            .delete(id);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    });
}

function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}
function defaultBook() {
    return {
        id: uid(),
        title: "",
        description: "",
        genres: [],
        cover: "",
        createdAt: now(),
        updatedAt: now(),
        chapters: [],
        items: [],
        characters: [],
        factions: [],
        abilities: [],
        relations: [],
        arcs: [],
        timeline: [],
        skillsets: [],
        itemsets: [],
        realms: [],
        locations: [],
        rules: [],
        definitions: [],
        displaySettings: Object.assign({}, DISPLAY_DEFAULTS),
    };
}
function setView(view, bookId = null) {
    state.view = view;
    state.bookId = bookId;
    state.systemDslId = null;
    saveState();
    renderWithTransition("#content");
}
async function render() {
    await renderSidebar();

    $("#quickExport").hidden = !state.bookId;

    $("#content").innerHTML = await pageHTML();

    bindPage();
    bindRelationDiagram();
}

let viewAnimToken = 0;
const prefersReduceMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
async function renderWithTransition(targetSel = "#content") {
    const token = ++viewAnimToken;
    if (prefersReduceMotion()) {
        await render();
        return;
    }

    const cur = $(targetSel) || $("#content");
    if (cur) {
        cur.classList.add("creator-fade-out");
        await new Promise((r) => setTimeout(r, 110));
        if (token !== viewAnimToken) return;
    }

    await render();
    if (token !== viewAnimToken) return;

    const fresh = $(targetSel) || $("#content");
    if (fresh) {
        fresh.classList.remove("creator-fade-out");
        fresh.classList.add("creator-fade-in");
        fresh.addEventListener(
            "animationend",
            () => fresh.classList.remove("creator-fade-in"),
            { once: true },
        );
    }
}
async function renderSidebar() {
    const books = await allBooks();
    $("#bookList").innerHTML =
        books
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(
                (b) =>
                    `<button class="book-link ${state.bookId === b.id ? "active" : ""}" data-book="${b.id}">${b.cover ? `<img class="book-cover-mini" src="${b.cover}">` : `<div class="book-cover-mini"></div>`}<span class="book-title">${esc(b.title || tFn("creator.untitled", "Chưa đặt tên"))}</span></button>`,
            )
            .join("") ||
        `<div class="muted" style="padding:10px">${tFn("creator.library.empty", "Chưa có truyện.")}</div>`;
    $$("[data-book]").forEach(
        (x) =>
            (x.onclick = () => {
                const dd = document.getElementById("libraryDropdown");
                if (dd) dd.classList.remove("open");
                setView("manage", x.dataset.book);
            }),
    );
}
async function pageHTML() {
    if (state.view === "dashboard") return await dashboardHTML();

    if (state.view === "create") return bookFormHTML();

    return await manageHTML();
}
async function dashboardHTML() {
    const books = await allBooks();
    const ch = books.reduce((n, b) => n + b.chapters.length, 0);
    return `<div class="page-head"><div><h1>${tFn("creator.dash.title", "Kho truyện")}</h1><div class="muted">${tFn("creator.dash.sub", "Tất cả dữ liệu nằm trong trình duyệt của bạn.")}</div></div><div class="dash-actions"><input id="dashImportCreator" type="file" accept=".creator,application/zip" hidden><button class="btn secondary" id="dashImportBtn">${tFn("creator.dash.import_creator", "⟳ Import .creator")}</button><button class="btn primary" id="createBtn">${tFn("creator.dash.create", "＋ Tạo truyện")}</button></div></div><div class="stats"><div class="stat"><b>${books.length}</b><span>${tFn("creator.stat.books", "Truyện")}</span></div><div class="stat"><b>${ch}</b><span>${tFn("creator.stat.chapters", "Chương")}</span></div><div class="stat"><b>${books.reduce((n, b) => n + b.characters.length, 0)}</b><span>${tFn("creator.stat.characters", "Nhân vật")}</span></div><div class="stat"><b>${books.reduce((n, b) => n + b.items.length, 0)}</b><span>${tFn("creator.stat.items", "Vật phẩm")}</span></div></div><div class="grid cards">${books.map(bookCard).join("") || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.dash.empty", "Kho truyện đang trống")}</strong>${tFn("creator.dash.empty_hint", "Tạo quyển đầu tiên để bắt đầu worldbuilding.")}</div>`}</div>`;
}
function bookCard(b) {
    return `<article class="card book-card" data-open-card="${b.id}"><div class="book-card-cover">${b.cover ? `<img src="${b.cover}">` : `<div class="cover-placeholder">${tFn("creator.cover.none", "NO COVER")}</div>`}</div><div class="book-card-body"><h3>${esc(b.title || tFn("creator.untitled", "Chưa đặt tên"))}</h3><div class="meta">${(b.genres || []).map((x) => `<span class="badge">${esc(x)}</span>`).join("")}</div><div class="muted">${b.chapters.length} ${tFn("creator.card.ch_units", "chương")} · ${b.characters.length} ${tFn("creator.card.ch_chars", "nhân vật")}</div><div class="actions" style="margin-top:12px"><button class="btn small primary" data-open="${b.id}">${tFn("creator.card.manage", "Quản lý")}</button><button class="btn small ghost" data-edit="${b.id}">${tFn("creator.card.edit", "Chỉnh sửa")}</button><button class="btn small danger" data-delete="${b.id}">${tFn("creator.card.delete", "Xóa")}</button></div></div></article>`;
}
function bookFormHTML(book = null) {
    const b = book || defaultBook();
    const genreBtns = POPULAR_GENRES.map(
        (g) =>
            `<button type="button" class="genre-toggle btn small" data-genre="${esc(g.v)}">${esc(tFn(g.k, g.f))}</button>`,
    ).join("");
    return `<div class="page-head"><div class="head-left"><button type="button" class="btn small ghost back-btn" id="backBtn">←</button><div><h1>${book ? tFn("creator.form.edit_title", "Chỉnh sửa thông tin") : tFn("creator.form.create_title", "Tạo truyện")}</h1><div class="muted">${book ? tFn("creator.form.edit_sub", "Cập nhật metadata của truyện.") : tFn("creator.form.create_sub", "Tạo một workspace truyện mới.")}</div></div></div></div><form id="bookForm" class="card form"><input type="hidden" name="id" value="${b.id}"><div class="form-row"><div class="field"><label>${tFn("creator.form.title", "Tiêu đề *")}</label><input name="title" required value="${esc(b.title)}" placeholder="${tFn("creator.form.title_ph", "Ví dụ: Đao Kiếm Thần Vực")}"></div><div class="field"><label>${tFn("creator.form.genres", "Thể loại")}</label><input name="genres" value="${esc((b.genres || []).join(", "))}" placeholder="${tFn("creator.form.genres_ph", "Fantasy, Apocalypse, Action; Sci-Fi")}"><div class="genre-popular">${genreBtns}</div></div></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description" placeholder="${tFn("creator.form.desc_ph", "Tóm tắt truyện...")}">${esc(b.description)}</textarea></div><div class="field"><label>${tFn("creator.form.cover", "Ảnh bìa")}</label><div class="cover-wrap"><div><img id="coverPreview" class="cover-preview" src="${b.cover || ""}" ${b.cover ? "" : 'style="display:none"'}><div id="coverEmpty" class="cover-preview cover-placeholder" ${b.cover ? 'style="display:none"' : ""}>${tFn("creator.cover.none", "NO COVER")}</div></div><div><input id="coverInput" type="file" accept="image/*"><button type="button" id="removeCover" class="btn small ghost">${tFn("creator.form.remove_cover", "Bỏ ảnh")}</button></div></div></div><div class="actions"><button class="btn primary">${tFn("creator.form.save", "Lưu truyện")}</button><button type="button" id="cancelForm" class="btn ghost">${tFn("creator.form.cancel", "Hủy")}</button></div></form>`;
}
async function manageHTML() {
    const b = await getBook(state.bookId);
    if (!b) {
        setView("dashboard");
        return "";
    }
    const tabs = [
        ["chapters", tFn("creator.tab.chapters", "Chương")],
        ["items", tFn("creator.tab.items", "Vật phẩm")],
        ["itemsets", tFn("creator.tab.itemsets", "Bộ vật phẩm")],
        ["characters", tFn("creator.tab.characters", "Nhân vật")],
        ["factions", tFn("creator.tab.factions", "Thế lực")],
        ["realms", tFn("creator.tab.realms", "Giới vực")],
        ["locations", tFn("creator.tab.locations", "Vị diện / Vùng")],
        ["abilities", tFn("creator.tab.abilities", "Năng lực / Kỹ năng")],
        ["skillsets", tFn("creator.tab.skillsets", "Bộ kỹ năng")],
        ["definitions", tFn("creator.tab.definitions", "Định nghĩa")],
        ["systems", tFn("creator.tab.systems", "Hệ thống / Stats")],
        ["relations", tFn("creator.tab.relations", "Mối quan hệ")],
        ["settings", tFn("creator.tab.settings", "Cài đặt hiển thị")],
        ["export", tFn("creator.tab.export", "Xuất truyện")],
    ].filter(
        ([k]) =>
            k === "chapters" ||
            k === "settings" ||
            k === "export" ||
            (b.displaySettings || {})[k] !== "hidden",
    );
    if (!tabs.some(([k]) => k === state.tab)) {
        state.tab = "settings";
        saveState();
    }
    const descHtml = b.description
        ? esc(b.description).replace(/\r?\n/g, "<br>")
        : tFn("creator.nodesc", "Chưa có mô tả.");
    return `<div class="page-head"><div class="head-left"><button type="button" class="btn small ghost back-btn" id="backBtn">←</button><div class="detail-head"><div>${b.cover ? `<img class="detail-cover" src="${b.cover}">` : `<div class="detail-cover cover-placeholder">${tFn("creator.cover.none", "NO COVER")}</div>`}</div><div><h1>${esc(b.title)}</h1><div class="meta">${b.genres.map((x) => `<span class="badge">${esc(x)}</span>`).join("")}</div><p class="muted book-desc">${descHtml}</p><div class="actions"><button class="btn small secondary" id="editBook">${tFn("creator.manage.edit", "Chỉnh sửa thông tin")}</button><button class="btn small danger" id="deleteCurrent">${tFn("creator.manage.delete", "Xóa truyện")}</button></div></div></div></div></div><div class="tabs">${tabs.map(([k, t]) => `<button class="tab ${state.tab === k ? "active" : ""}" data-tab="${k}">${t}</button>`).join("")}</div><div id="manageBody">${manageBody(b)}</div>`;
}
function manageBody(b) {
    if (state.tab === "settings") return settingsSectionHTML(b);
    if (state.tab === "export") return exportHTML(b);
    if (state.tab === "chapters") return chaptersSectionHTML(b);
    if (state.tab === "relations") return relationsSectionHTML(b);
    if (state.tab === "abilities") return abilitiesSectionHTML(b);
    if (state.tab === "realms") return realmsSectionHTML(b);
    if (state.tab === "locations") return locationsSectionHTML(b);
    if (state.tab === "definitions") return definitionsSectionHTML(b);
    if (state.tab === "systems") return systemsSectionHTML(b);
    const map = {
        items: [tFn("creator.tab.items", "Vật phẩm"), "item", "name", ""],
        itemsets: [
            tFn("creator.tab.itemsets", "Bộ vật phẩm"),
            "itemset",
            "name",
            "",
        ],
        characters: [
            tFn("creator.tab.characters", "Nhân vật"),
            "character",
            "name",
            "",
        ],
        factions: [
            tFn("creator.tab.factions", "Thế lực"),
            "faction",
            "name",
            "",
        ],
        abilities: [
            tFn("creator.tab.abilities", "Năng lực / Kỹ năng"),
            "ability",
            "name",
            "",
        ],
        skillsets: [
            tFn("creator.tab.skillsets", "Bộ kỹ năng"),
            "skillset",
            "name",
            "",
        ],
    };
    return entityHTML(b, ...map[state.tab]);
}
function chaptersSectionHTML(b) {
    const ds = b.displaySettings || {};
    if (ds.timeline === "hidden" && state.chapterTab === "timeline") {
        state.chapterTab = "list";
        saveState();
    }
    const subs = [
        ["list", tFn("creator.sub.list", "Danh sách")],
        ["stats", tFn("creator.sub.stats", "Thống kê")],
        ["arcs", tFn("creator.sub.arcs", "Arc / Phần / Tập")],
        ["timeline", tFn("creator.sub.timeline", "Timeline")],
    ].filter(([k]) => k !== "timeline" || ds.timeline !== "hidden");
    const body =
        state.chapterTab === "stats"
            ? chapterStatsHTML(b)
            : state.chapterTab === "arcs"
              ? arcsHTML(b)
              : state.chapterTab === "timeline"
                ? timelineHTML(b)
                : chaptersHTML(b);
    return `<div class="tabs subtabs">${subs
        .map(
            ([k, t]) =>
                `<button class="tab ${state.chapterTab === k ? "active" : ""}" data-chaptertab="${k}">${t}</button>`,
        )
        .join("")}</div>${body}`;
}
function chapterStatsHTML(b) {
    const chapters = [...b.chapters].sort((a, c) => a.number - c.number);
    if (!chapters.length)
        return `<div class="card empty"><strong>${tFn("creator.ch.empty", "Chưa có chương nào.")}</strong>${tFn("creator.st.empty_hint", "Thêm chương để xem thống kê.")}</div>`;
    const counts = chapters.map((c) => wordCount(c.content));
    const total = counts.reduce((n, x) => n + x, 0);
    const avg = total / chapters.length;
    const max = Math.max(...counts);
    const longest = chapters[counts.indexOf(max)];
    const fmt = (n) => Math.round(n).toLocaleString(localeTag());
    const H = 250,
        TOP = 30,
        BOT = 26,
        LEFT = 48,
        barW = 34,
        gap = 12;
    const plotH = H - TOP - BOT;
    const W = LEFT + chapters.length * (barW + gap) + 6;
    const yFor = (v) => TOP + plotH - (max ? (v / max) * plotH : 0);
    const grid = [0, 1 / 3, 2 / 3, 1]
        .map((f) => {
            const v = max * f,
                y = yFor(v);
            return `<line class="chart-grid" x1="${LEFT}" y1="${y}" x2="${W - 6}" y2="${y}"></line><text class="chart-tick" x="${LEFT - 8}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`;
        })
        .join("");
    const bars = chapters
        .map((c, i) => {
            const v = counts[i],
                x = LEFT + gap / 2 + i * (barW + gap),
                y = yFor(v);
            return `<g class="chart-bar" data-viewchapter="${c.id}"><title>${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))} — ${fmt(v)} ${tFn("creator.unit.word", "từ")}</title><rect x="${x}" y="${y}" width="${barW}" height="${Math.max(TOP + plotH - y, 0)}" rx="4"></rect><text class="chart-val" x="${x + barW / 2}" y="${y - 7}" text-anchor="middle">${fmt(v)}</text><text class="chart-cat" x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${c.number}</text></g>`;
        })
        .join("");
    return `<div class="stats"><div class="stat"><b>${chapters.length}</b><span>${tFn("creator.stat.chapters", "Chương")}</span></div><div class="stat"><b>${fmt(total)}</b><span>${tFn("creator.st.total", "Tổng số từ")}</span></div><div class="stat"><b>${avg.toLocaleString(localeTag(), { maximumFractionDigits: 1 })}</b><span>${tFn("creator.st.avg", "Trung bình / chương")}</span></div><div class="stat"><b>${fmt(max)}</b><span>${tFn("creator.st.longest", "Dài nhất")} — ${tFn("creator.unit.chapter_prefix", "Chương")} ${longest.number}</span></div></div><div class="card"><h3 style="margin-top:0">${tFn("creator.st.title", "Số từ theo chương")}</h3><p class="muted" style="font-size:13px">${tFn("creator.st.hint", "Bấm vào cột để xem nội dung chương.")}</p><div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${tFn("creator.st.title", "Số từ theo chương")}">${grid}${bars}</svg></div></div>`;
}

function arcsHTML(b) {
    const arcs = b.arcs || [];
    return `<div class="toolbar"><div class="muted">${arcs.length} ${tFn("creator.arc.unit", "arc / phần / tập")}</div><button class="btn primary" id="addArc">${tFn("creator.arc.add", "＋ Thêm Arc/Phần/Tập")}</button></div><div class="grid cards">${
        arcs.map((a) => arcCard(b, a)).join("") ||
        `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.arc.empty", "Chưa có arc nào.")}</strong>${tFn("creator.arc.empty_hint", "Tạo arc để nhóm các chương theo phần/tập của truyện.")}</div>`
    }</div>`;
}

function arcCard(b, a) {
    const children = a.children || [];
    const allowedTargets = new Set(
        arcTimelineOrderedTargets(b, a.id).map((x) => `${x.kind}:${x.ref}`),
    );

    const tl = (b.timeline || []).filter((t) =>
        allowedTargets.has(`${t.kind}:${t.ref}`),
    );
    const nCh = children.filter((c) => c.kind === "chapter").length;
    const nArc = children.filter((c) => c.kind === "arc").length;
    const ds = b.displaySettings || {};
    const tlHidden = ds.timeline === "hidden";
    const badges = `<span class="badge">${nCh} ${tFn("creator.unit.chapter", "chương")}</span>${
        nArc
            ? `<span class="badge">${nArc} ${tFn("creator.arc.badge_arcs", "arc con")}</span>`
            : ""
    }${tlHidden ? "" : `<span class="badge">${tl.length} ${tFn("creator.arc.badge_tl", "timeline")}</span>`}`;
    const childRows =
        children
            .map((c) => {
                if (c.kind === "chapter") {
                    const ch = b.chapters.find((x) => x.id === c.ref);
                    return `<div class="arc-child"><span class="badge">${tFn("creator.unit.chapter_prefix", "Chương")}</span><button type="button" class="linklike" data-viewchapter="${c.ref}">${esc(ch ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${ch.number}: ${ch.title || tFn("creator.ch.untitled", "Không tiêu đề")}` : tFn("creator.arc.miss_ch", "(chương không tồn tại)"))}</button><button type="button" class="btn small ghost" data-unlinkchild="${a.id}" data-ref="${c.id}" title="${tFn("creator.arc.unlink", "Gỡ")}">${tFn("creator.arc.unlink", "Gỡ")}</button></div>`;
                }
                const sub = b.arcs.find((x) => x.id === c.ref);
                return `<div class="arc-child"><span class="badge">Arc</span><button type="button" class="linklike" data-editarc="${c.ref}">${esc(sub ? sub.title || tFn("creator.noname", "Không tên") : tFn("creator.arc.miss_arc", "(arc không tồn tại)"))}</button><button type="button" class="btn small ghost" data-unlinkchild="${a.id}" data-ref="${c.id}" title="${tFn("creator.arc.unlink", "Gỡ")}">${tFn("creator.arc.unlink", "Gỡ")}</button></div>`;
            })
            .join("") ||
        `<div class="muted">${tFn("creator.arc.children_empty", "Chưa chứa chương hoặc arc nào.")}</div>`;
    const tlRows =
        tl
            .map(
                (t) =>
                    `<div class="arc-child" data-dragrow="${t.id}"><span class="drag-handle" data-draghandle title="${tFn("creator.drag.hint", "Kéo để di chuyển thứ tự")}">⁝⁝</span><span class="badge">${esc(t.time || "—")}</span><span class="tl-text">${esc(t.text || "")}</span><button type="button" class="btn small ghost" data-edittimeline="${t.id}">${tFn("creator.ch.edit", "Sửa")}</button><button type="button" class="btn small danger" data-deltimeline="${t.id}">${tFn("creator.ch.delete", "Xóa")}</button></div>`,
            )
            .join("") ||
        `<div class="muted">${tFn("creator.arc.tl_empty", "Chưa có mốc timeline nào.")}</div>`;
    const tlSection = tlHidden
        ? ""
        : `<div><h4>${tFn("creator.sub.timeline", "Timeline")} (${tl.length})</h4><div class="arc-children" data-draglist="timeline">${tlRows}</div><div class="actions"><button type="button" class="btn small secondary" data-addtimeline="${a.id}">${tFn("creator.arc.add_tl", "＋ Thêm timeline cho arc này")}</button></div></div>`;
    return `<div class="card entity-card collapsible arc-card"><div class="entity-head"><h3>${esc(a.title || tFn("creator.noname", "Không tên"))}</h3><div class="meta">${badges}</div></div><div class="entity-collapse"><div class="entity-collapse-inner"><div><h4>${tFn("creator.form.desc", "Mô tả")}</h4><div class="muted">${esc(a.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div></div><div><h4>${tFn("creator.arc.children", "Chương / Arc con")} (${children.length})</h4><div class="arc-children">${childRows}</div><div class="actions"><button type="button" class="btn small secondary" data-addchild="chapter" data-id="${a.id}">${tFn("creator.ch.add", "＋ Thêm chương")}</button><button type="button" class="btn small secondary" data-addchild="arc" data-id="${a.id}">${tFn("creator.arc.add_subarc", "＋ Thêm arc con")}</button></div></div>${tlSection}<div class="actions"><button type="button" class="btn small secondary" data-editarc="${a.id}">${tFn("creator.arc.edit", "Sửa arc")}</button><button type="button" class="btn small danger" data-delarc="${a.id}">${tFn("creator.arc.delete", "Xóa arc")}</button></div></div></div></div>`;
}
function descendantArcIds(b, arcId) {
    const out = new Set([arcId]);
    const stack = [arcId];
    while (stack.length) {
        const id = stack.pop();
        const a = b.arcs.find((x) => x.id === id);
        if (!a) continue;
        for (const c of a.children || [])
            if (c.kind === "arc" && !out.has(c.ref)) {
                out.add(c.ref);
                stack.push(c.ref);
            }
    }
    return out;
}
function findChapterParentArc(b, chapterId, excludeArcId = null) {
    for (const arc of b.arcs || []) {
        if (excludeArcId && arc.id === excludeArcId) continue;

        if (
            (arc.children || []).some(
                (c) => c.kind === "chapter" && c.ref === chapterId,
            )
        ) {
            return arc;
        }
    }

    return null;
}
function arcCycleSafeIds(b, arcId) {
    const out = descendantArcIds(b, arcId);
    for (const a of b.arcs || []) {
        if (out.has(a.id)) continue;
        if (descendantArcIds(b, a.id).has(arcId)) out.add(a.id);
    }
    return out;
}

function timelineHTML(b) {
    const entries = b.timeline || [];
    const rows =
        entries
            .map(
                (t) =>
                    `<div class="card tl-row" data-dragrow="${t.id}"><span class="drag-handle" data-draghandle title="${tFn("creator.drag.hint", "Kéo để di chuyển thứ tự")}">⁝⁝</span><span class="badge tl-time">${esc(t.time || "—")}</span><div class="tl-body"><div>${esc(t.text || "")}</div><div class="muted">${esc(timelineTargetLabel(b, t))}</div></div><div class="actions"><button type="button" class="btn small secondary" data-edittimeline="${t.id}">${tFn("creator.ch.edit", "Sửa")}</button><button type="button" class="btn small danger" data-deltimeline="${t.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div>`,
            )
            .join("") ||
        `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.tl.empty", "Chưa có timeline nào.")}</strong>${tFn("creator.tl.empty_hint", "Thêm mốc thời gian cho chương hoặc arc.")}</div>`;
    return `<div class="toolbar"><div class="muted">${entries.length} ${tFn("creator.tl.count", "mốc thời gian")}</div><button class="btn primary" id="addTimeline">${tFn("creator.tl.add", "＋ Thêm timeline")}</button></div><div class="grid cards" data-draglist="timeline">${rows}</div>`;
}
function timelineTargetLabel(b, t) {
    if (t.kind === "chapter") {
        const c = b.chapters.find((x) => x.id === t.ref);
        return c
            ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${c.title || tFn("creator.ch.untitled", "Không tiêu đề")}`
            : tFn("creator.arc.miss_ch", "(chương không tồn tại)");
    }
    const a = b.arcs.find((x) => x.id === t.ref);
    return a
        ? `${tFn("creator.tl.prefix_arc", "Arc: ")}${a.title || tFn("creator.noname", "Không tên")}`
        : tFn("creator.arc.miss_arc", "(arc không tồn tại)");
}
function chaptersHTML(b) {
    const chapters = [...b.chapters].sort((a, c) => a.number - c.number);
    const totalWords = chapters.reduce((n, c) => n + wordCount(c.content), 0);
    return `<div class="toolbar"><div class="muted">${chapters.length} ${tFn("creator.unit.chapter", "chương")} · ${totalWords.toLocaleString(localeTag())} ${tFn("creator.unit.word", "từ")}</div><div class="actions"><button class="btn small danger" id="deleteSelectedChapters" disabled>${tFn("creator.ch.del_sel", "Xóa đã chọn")}</button><button class="btn primary" data-add="chapter">${tFn("creator.ch.add", "＋ Thêm chương")}</button></div></div><div class="card" style="padding:5px"><table class="table"><thead><tr><th class="col-drag"></th><th class="col-chk"><input type="checkbox" id="chkAll" aria-label="${tFn("creator.ch.sel_all", "Chọn tất cả chương")}"></th><th>#</th><th>${tFn("creator.ch.col_title", "Tiêu đề")}</th><th>${tFn("creator.ch.col_words", "Số từ")}</th><th>${tFn("creator.ch.col_updated", "Cập nhật")}</th><th></th></tr></thead><tbody data-draglist="chapters">${
        chapters
            .map(
                (c) =>
                    `<tr data-dragrow="${c.id}"><td class="col-drag"><span class="drag-handle" data-draghandle title="${tFn("creator.drag.hint", "Kéo để di chuyển thứ tự")}">⁝⁝</span></td><td class="col-chk"><input type="checkbox" data-chk="${c.id}" aria-label="${tFn("creator.ch.sel_one", "Chọn chương")} ${c.number}"></td><td>${c.number}</td><td><div class="chapter-row-title">${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</div></td><td class="num">${wordCount(c.content).toLocaleString(localeTag())}</td><td>${new Date(c.updatedAt).toLocaleString(localeTag())}</td><td><div class="actions"><button class="btn small secondary" data-viewchapter="${c.id}">${tFn("creator.ch.view", "Xem")}</button><button class="btn small secondary" data-editentity="chapter" data-id="${c.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="chapter" data-id="${c.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></td></tr>`,
            )
            .join("") ||
        `<tr><td colspan="7"><div class="empty">${tFn("creator.ch.empty", "Chưa có chương nào.")}</div></td></tr>`
    }</tbody></table></div>`;
}
function entityHTML(b, title, type, nameField, descLabel) {
    const arr = b[entityKey(type)] || [];
    const card =
        type === "relation"
            ? (x2) => relationCard(b, x2)
            : type === "character"
              ? (x2) => characterCard(b, x2)
              : type === "faction"
                ? (x2) => factionCard(b, x2)
                : type === "skillset"
                  ? (x2) => skillsetCard(b, x2)
                  : type === "realm"
                    ? (x2) => realmCard(b, x2)
                    : type === "location"
                      ? (x2) => locationCard(b, x2)
                      : type === "ability"
                        ? (x2) => abilityCard(b, x2)
                        : type === "item"
                          ? (x2) => itemCard(b, x2)
                          : type === "itemset"
                            ? (x2) => itemsetCard(b, x2)
                            : entityCard;
    return `<div class="toolbar"><div><h2 style="margin:0">${title}</h2><div class="muted">${arr.length} ${tFn("creator.ent.count", "mục")}</div></div><input class="ent-search" type="search" data-entsearch placeholder="${tFn("creator.ent.search_ph", "Tìm theo tên / thẻ...")}" aria-label="${tFn("creator.ent.search_ph", "Tìm theo tên / thẻ...")}"><button class="btn primary" data-add="${type}">${tFn("creator.ent.add", "＋ Thêm")}</button></div><div class="entity-rows" data-draglist="${entityKey(type)}">${
        arr
            .map((x) => {
                const html = dragRowHTML(card(x, type, nameField), x.id);
                const illu = ILLU_TYPES.includes(type) ? illuBodyHTML(x) : "";
                return illu
                    ? html.replace(
                          '<div class="entity-collapse-inner">',
                          '<div class="entity-collapse-inner">' + illu,
                      )
                    : html;
            })
            .join("") ||
        `<div class="card empty"><strong>${title}</strong>${tFn("creator.ent.empty_hint", "Thêm dữ liệu để xây dựng thế giới truyện.")}</div>`
    }${arr.length ? `<div class="ent-nomatch" hidden>${tFn("creator.ent.no_result", "Không tìm thấy kết quả nào.")}</div>` : ""}</div>`;
}
function entityCard(x, type, nameField) {
    const search = esc(
        String(
            (x[nameField] || "") + " " + (x.tags || []).join(" "),
        ).toLowerCase(),
    );
    const tags = (x.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    return `<div class="card entity-card collapsible ent-row" data-entrow data-search="${search}"><div class="entity-head"><h3>${esc(x[nameField] || tFn("creator.noname", "Không tên"))}</h3>${tags ? `<div class="meta">${tags}</div>` : ""}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(x.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="actions"><button class="btn small secondary" data-editentity="${type}" data-id="${x.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="${type}" data-id="${x.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function relationCard(b, x) {
    const chips = [];
    const snaps = relSnapshots(b, x);
    const latestSnap = snaps[snaps.length - 1] || null;
    const st = latestSnap || {};
    if (st.type) chips.push(`<span class="badge">${esc(st.type)}</span>`);
    if (st.state) chips.push(`<span class="badge">${esc(st.state)}</span>`);
    const vis = st.visibility || x.visibility;
    if (vis && vis !== "public")
        chips.push(
            `<span class="badge">${esc(
                {
                    group: tFn("creator.rel.vis_group", "Bán công khai"),
                    secret: tFn("creator.rel.vis_secret", "Bí mật"),
                }[vis] || vis,
            )}</span>`,
        );
    const int = Number(st.intensity || 0);
    chips.push(
        `<span class="badge" style="color:${relColor(int)}">${relIntLabel(int)}</span>`,
    );
    if (latestSnap)
        chips.push(
            `<span class="badge">${esc(relSnapLabel(b, latestSnap))}</span>`,
        );
    chips.push(
        `<span class="badge">${snaps.length} ${tFn("creator.rel.changes_count", "lần thay đổi")}</span>`,
    );
    const search = esc(
        String(
            [x.from, x.to, st.type, st.state, vis].filter(Boolean).join(" "),
        ).toLowerCase(),
    );
    const head =
        esc(x.from || tFn("creator.noname", "Không tên")) +
        (x.to ? ` → ${esc(x.to)}` : "");
    return `<div class="card entity-card collapsible ent-row" data-entrow data-search="${search}"><div class="entity-head"><h3>${head}</h3>${
        chips.length ? `<div class="meta">${chips.join("")}</div>` : ""
    }</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(st.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="actions"><button class="btn small secondary" data-editentity="relation" data-id="${x.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="relation" data-id="${x.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function characterCard(b, c) {
    const tags = (c.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const ageBadge = c.age
        ? `<span class="badge">${tFn("creator.card.age", "Tuổi")}: ${esc(c.age)}</span>`
        : "";
    const ch = (b.chapters || []).find((x) => x.id === c.firstChapterId);
    const firstBadge = c.firstChapterId
        ? `<span class="badge">${tFn("creator.card.first_appearance", "Xuất hiện lần đầu")}: ${
              ch
                  ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${ch.number}${ch.title ? ": " + esc(ch.title) : ""}`
                  : tFn("creator.arc.miss_ch", "(chương không tồn tại)")
          }</span>`
        : "";
    const facBadges = (c.factions || [])
        .map((m) => {
            const f = (b.factions || []).find((x) => x.id === m.factionId);
            const base = f
                ? f.name
                : tFn(
                      "creator.card.missing_faction",
                      "(thế lực không tồn tại)",
                  );
            return `<span class="badge">${esc(base + (m.role ? ` — ${m.role}` : ""))}</span>`;
        })
        .join("");
    const hobbyBadges = (c.hobbies || [])
        .map((h) => `<span class="badge">${esc(h)}</span>`)
        .join("");
    const home = (b.realms || []).find((x) => x.id === c.homeRealmId) || null;
    const homeBadge = c.homeRealmId
        ? `<span class="badge">${tFn("creator.card.home_realm", "Quê quán")}: ${esc(
              home
                  ? home.name
                  : tFn(
                        "creator.card.missing_realm",
                        "(giới vực không tồn tại)",
                    ),
          )}</span>`
        : "";
    const visitedBadges = (c.visitedRealmIds || [])
        .map((rid) => {
            const r = (b.realms || []).find((x) => x.id === rid);
            return `<span class="badge">${tFn("creator.card.visited", "Đã qua")}: ${esc(
                r
                    ? r.name
                    : tFn(
                          "creator.card.missing_realm",
                          "(giới vực không tồn tại)",
                      ),
            )}</span>`;
        })
        .join("");
    const meta =
        ageBadge +
        firstBadge +
        homeBadge +
        facBadges +
        visitedBadges +
        hobbyBadges;
    const sh = entRowShell(c, c.name, c.tags || [], "character", c.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(c.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div></div></div>`;
}
function factionCard(b, f) {
    const tags = (f.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const realmBadges = (f.realmIds || [])
        .map((rid) => {
            const r = (b.realms || []).find((x) => x.id === rid);
            return `<span class="badge">${esc(r ? r.name : tFn("creator.card.missing_realm", "(giới vực không tồn tại)"))}</span>`;
        })
        .join("");
    const rankRows =
        (f.ranks || [])
            .map(
                (r) =>
                    `<div class="sub-row"><span class="badge">${esc(r.name)}</span>${r.description ? `<span class="muted">${esc(r.description)}</span>` : ""}</div>`,
            )
            .join("") ||
        `<div class="muted">${tFn("creator.card.no_ranks", "Chưa có chức vụ / cấp bậc nào.")}</div>`;
    const memberRows =
        (b.characters || [])
            .filter((c) => (c.factions || []).some((m) => m.factionId === f.id))
            .map((c) => {
                const m = (c.factions || []).find((x) => x.factionId === f.id);
                return `<div class="sub-row"><span class="badge">${esc(c.name || tFn("creator.noname", "Không tên"))}</span>${m && m.role ? `<span class="muted">${esc(m.role)}</span>` : ""}</div>`;
            })
            .join("") ||
        `<div class="muted">${tFn("creator.card.no_members", "Chưa có nhân vật nào thuộc thế lực này.")}</div>`;
    const meta = tags + realmBadges;
    const sh = entRowShell(f, f.name, f.tags || [], "faction", f.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(f.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div>${realmBadges ? `<div class="meta">${realmBadges}</div>` : ""}<div><h4>${tFn("creator.card.ranks", "Chức vụ / Cấp bậc")}</h4><div class="sub-list">${rankRows}</div></div><div><h4>${tFn("creator.card.members", "Thành viên")}</h4><div class="sub-list">${memberRows}</div></div></div></div></div>`;
}
function skillsetCard(b, s) {
    const tags = (s.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const countBadge = `<span class="badge">${(s.skills || []).length} ${tFn("creator.ss.skill_count", "kỹ năng")}</span>`;
    const skillRows =
        (s.skills || [])
            .map((k) => {
                if (k.abilityId) {
                    const a = (b.abilities || []).find(
                        (x) => x.id === k.abilityId,
                    );
                    return `<div class="sub-row"><span class="badge">${esc(a ? a.name : tFn("creator.card.missing_ability", "(kỹ năng không tồn tại)"))}</span>${a && a.description ? `<span class="muted">${esc(a.description)}</span>` : ""}</div>`;
                }
                return `<div class="sub-row"><span class="badge">${esc(k.name)}</span>${k.description ? `<span class="muted">${esc(k.description)}</span>` : ""}</div>`;
            })
            .join("") ||
        `<div class="muted">${tFn("creator.card.no_skills", "Chưa có kỹ năng nào trong bộ này.")}</div>`;
    const sh = entRowShell(s, s.name, s.tags || [], "skillset", s.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(s.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="meta">${countBadge}</div><div><h4>${tFn("creator.card.skills", "Kỹ năng / Sức mạnh")}</h4><div class="sub-list">${skillRows}</div></div><div class="actions"><button class="btn small secondary" data-editentity="skillset" data-id="${s.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="skillset" data-id="${s.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function realmCard(b, r) {
    const tags = (r.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const facs = (b.factions || []).filter((f) =>
        (f.realmIds || []).includes(r.id),
    );
    const countBadge = `<span class="badge">${facs.length} ${tFn("creator.rm.faction_count", "thế lực")}</span>`;
    const residents = (b.characters || []).filter(
        (c) => c.homeRealmId === r.id,
    );
    const visitors = (b.characters || []).filter((c) =>
        (c.visitedRealmIds || []).includes(r.id),
    );
    const charCountBadge = `<span class="badge">${residents.length + visitors.length} ${tFn("creator.rm.character_count", "nhân vật")}</span>`;
    const residentRows =
        residents
            .map(
                (c) =>
                    `<div class="sub-row"><span class="badge">${esc(c.name || tFn("creator.noname", "Không tên"))}</span>${c.description ? `<span class="muted">${esc(c.description)}</span>` : ""}</div>`,
            )
            .join("") ||
        `<div class="muted">${tFn("creator.ab.none", "Chưa có nhân vật nào.")}</div>`;
    const visitorRows =
        visitors
            .map(
                (c) =>
                    `<div class="sub-row"><span class="badge">${esc(c.name || tFn("creator.noname", "Không tên"))}</span></div>`,
            )
            .join("") ||
        `<div class="muted">${tFn("creator.ab.none", "Chưa có nhân vật nào.")}</div>`;
    const facRows =
        facs
            .map(
                (f) =>
                    `<div class="sub-row"><span class="badge">${esc(f.name || tFn("creator.noname", "Không tên"))}</span>${f.description ? `<span class="muted">${esc(f.description)}</span>` : ""}</div>`,
            )
            .join("") ||
        `<div class="muted">${tFn("creator.card.no_factions", "Chưa có thế lực nào tồn tại ở giới vực này.")}</div>`;
    const sh = entRowShell(r, r.name, r.tags || [], "realm", r.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(r.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="meta">${countBadge}${charCountBadge}</div><div><h4>${tFn("creator.tab.factions", "Thế lực")}</h4><div class="sub-list">${facRows}</div></div><div><h4>${tFn("creator.card.residents", "Nhân vật (quê quán)")}</h4><div class="sub-list">${residentRows}</div></div><div><h4>${tFn("creator.card.visitors", "Nhân vật (đã từng đi qua)")}</h4><div class="sub-list">${visitorRows}</div></div><div class="actions"><button class="btn small secondary" data-editentity="realm" data-id="${r.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="realm" data-id="${r.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function locationsSectionHTML(b) {
    return entityHTML(
        b,
        tFn("creator.tab.locations", "Vị diện / Vùng"),
        "location",
        "name",
        "",
    );
}
function locationCard(b, l) {
    const tags = (l.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const codeBadge = l.code ? `<span class="badge">${esc(l.code)}</span>` : "";
    const typeBadge = l.type ? `<span class="badge">${esc(l.type)}</span>` : "";
    const parent = l.parentLocationId
        ? (b.locations || []).find((x) => x.id === l.parentLocationId)
        : null;
    const parentBadge = parent
        ? `<span class="badge">${tFn("creator.loc.parent", "Vị diện cha")}: ${esc(
              parent.name || tFn("creator.noname", "Không tên"),
          )}</span>`
        : "";
    const children = (b.locations || []).filter(
        (x) => x.parentLocationId === l.id,
    );
    const childBadge = children.length
        ? `<span class="badge">${children.length} ${tFn(
              "creator.loc.children_count",
              "vị diện con",
          )}</span>`
        : "";
    const relTitle = (k, f) => tFn(k, f);
    const subRows = (ids, resolver, emptyLabel) =>
        (ids || [])
            .map((id) => {
                const label = resolver(id);
                return `<div class="sub-row"><span class="badge">${esc(
                    label ||
                        tFn(
                            "creator.loc.missing_location",
                            "(vị diện không tồn tại)",
                        ),
                )}</span></div>`;
            })
            .join("") || `<div class="muted">${relTitle(emptyLabel, "")}</div>`;
    const nameOf = (arr, id) => {
        const z = (arr || []).find((x) => x.id === id);
        return z ? z.name || z.code || z.id : "";
    };
    const connectedRows = subRows(
        l.connectedLocationIds,
        (id) => nameOf(b.locations, id),
        "creator.f.loc_none_hint",
    );
    const characterRows = subRows(
        l.characterIds,
        (id) =>
            nameOf(b.characters, id) ||
            tFn("creator.loc.missing_location", "(không tồn tại)"),
        "creator.f.loc_no_characters",
    );
    const factionRows = subRows(
        l.factionIds,
        (id) =>
            nameOf(b.factions, id) ||
            tFn("creator.loc.missing_location", "(không tồn tại)"),
        "creator.f.loc_no_factions",
    );
    const itemRows = subRows(
        l.itemIds,
        (id) =>
            nameOf(b.items, id) ||
            tFn("creator.loc.missing_location", "(không tồn tại)"),
        "creator.f.loc_no_items",
    );
    const questRows = subRows(
        l.questIds,
        (id) =>
            nameOf((b.systems || {}).quests, id) ||
            tFn("creator.loc.missing_location", "(không tồn tại)"),
        "creator.f.loc_no_quests",
    );
    const eventRows = subRows(
        l.eventIds,
        (id) => {
            const t2 = (b.timeline || []).find((x) => x.id === id);
            return t2 ? `${t2.time || "—"} · ${t2.text || ""}` : "";
        },
        "creator.f.loc_no_timeline",
    );
    const timelineRows = subRows(
        l.timelineEventIds,
        (id) => {
            const t2 = (b.timeline || []).find((x) => x.id === id);
            return t2 ? `${t2.time || "—"} · ${t2.text || ""}` : "";
        },
        "creator.f.loc_no_timeline",
    );
    const cfItems = (l.customFields || []).filter((f) => f && f.key);
    const cfRows =
        cfItems
            .map(
                (f) =>
                    `<div class="sub-row"><span class="badge">${esc(
                        f.key,
                    )}</span><span class="muted">${esc(f.value || "")}</span></div>`,
            )
            .join("") ||
        `<div class="muted">${tFn(
            "creator.loc.no_custom_fields",
            "Chưa có custom field.",
        )}</div>`;
    const rulesRows = l.rules
        ? `<div class="sub-row">${esc(l.rules)}</div>`
        : `<div class="muted">${tFn(
              "creator.loc.no_rules",
              "Chưa có luật lệ / quy tắc.",
          )}</div>`;
    const sh = entRowShell(
        l,
        l.name,
        [...(l.tags || []), l.code, l.type].filter(Boolean),
        "location",
        l.id,
    );
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(l.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="meta">${codeBadge}${typeBadge}${parentBadge}${childBadge}</div><div><h4>${tFn("creator.f.loc_rules", "Luật lệ / Quy tắc")}</h4><div class="sub-list">${rulesRows}</div></div><div><h4>${tFn("creator.f.loc_connected", "Vị diện liên kết")}</h4><div class="sub-list">${connectedRows}</div></div><div><h4>${tFn("creator.f.loc_characters", "Nhân vật")}</h4><div class="sub-list">${characterRows}</div></div><div><h4>${tFn("creator.f.loc_factions", "Thế lực")}</h4><div class="sub-list">${factionRows}</div></div><div><h4>${tFn("creator.f.loc_items", "Vật phẩm")}</h4><div class="sub-list">${itemRows}</div></div><div><h4>${tFn("creator.f.loc_quests", "Quests / Nhiệm vụ")}</h4><div class="sub-list">${questRows}</div></div><div><h4>${tFn("creator.f.loc_events", "Sự kiện (Events)")}</h4><div class="sub-list">${eventRows}</div></div><div><h4>${tFn("creator.f.loc_timeline", "Timeline")}</h4><div class="sub-list">${timelineRows}</div></div><div><h4>${tFn("creator.f.loc_custom_fields", "Custom fields")}</h4><div class="sub-list">${cfRows}</div></div><div class="actions"><button class="btn small secondary" data-editentity="location" data-id="${l.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="location" data-id="${l.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function abilityCard(b, a) {
    const tags = (a.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const setBadges = (a.skillsetIds || [])
        .map((sid) => {
            const s = (b.skillsets || []).find((x) => x.id === sid);
            return `<span class="badge">${esc(s ? s.name : tFn("creator.card.missing_skillset", "(bộ kỹ năng không tồn tại)"))}</span>`;
        })
        .join("");
    const owners = (b.characters || []).filter((c) =>
        (c.abilityIds || []).includes(a.id),
    );
    const ownerMagic = owners
        .map(
            (c) =>
                `<span class="badge">${esc(c.name || tFn("creator.noname", "Không tên"))}</span>`,
        )
        .join("");
    const setRows = (a.skillsetIds || [])
        .map((sid) => {
            const s = (b.skillsets || []).find((x) => x.id === sid);
            return `<div class="sub-row"><span class="badge">${esc(s ? s.name : tFn("creator.card.missing_skillset", "(bộ kỹ năng không tồn tại)"))}</span></div>`;
        })
        .join("");
    const ownerRows = owners
        .map(
            (c) =>
                `<div class="sub-row"><span class="badge">${esc(c.name || tFn("creator.noname", "Không tên"))}</span></div>`,
        )
        .join("");
    const meta = tags + setBadges + ownerMagic;
    const sh = entRowShell(a, a.name, a.tags || [], "ability", a.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(a.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div>${setBadges || ownerMagic ? `<div class="meta">${setBadges}${ownerMagic}</div>` : ""}<div><h4>${tFn("creator.card.from_sets", "Thuộc bộ kỹ năng")}</h4><div class="sub-list">${setRows || `<div class="muted">${tFn("creator.card.no_sets", "Không thuộc bộ kỹ năng nào.")}</div>`}</div></div><div><h4>${tFn("creator.card.owned_by", "Sở hữu bởi")}</h4><div class="sub-list">${ownerRows || `<div class="muted">${tFn("creator.card.no_owners", "Chưa ai sở hữu.")}</div>`}</div></div></div></div></div>`;
}
function itemCard(b, it) {
    const tags = (it.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const ownerBadges = (it.ownerIds || [])
        .map((cid) => {
            const c = (b.characters || []).find((x) => x.id === cid);
            return `<span class="badge">${esc(c ? c.name : tFn("creator.card.missing_character", "(nhân vật không tồn tại)"))}</span>`;
        })
        .join("");
    const setBadges = (it.itemsetIds || [])
        .map((sid) => {
            const s = (b.itemsets || []).find((x) => x.id === sid);
            return `<span class="badge">${esc(s ? s.name : tFn("creator.card.missing_itemset", "(bộ vật phẩm không tồn tại)"))}</span>`;
        })
        .join("");
    const ownerRows = (it.ownerIds || [])
        .map((cid) => {
            const c = (b.characters || []).find((x) => x.id === cid);
            return `<div class="sub-row"><span class="badge">${esc(c ? c.name : tFn("creator.card.missing_character", "(nhân vật không tồn tại)"))}</span></div>`;
        })
        .join("");
    const setRows = (it.itemsetIds || [])
        .map((sid) => {
            const s = (b.itemsets || []).find((x) => x.id === sid);
            return `<div class="sub-row"><span class="badge">${esc(s ? s.name : tFn("creator.card.missing_itemset", "(bộ vật phẩm không tồn tại)"))}</span></div>`;
        })
        .join("");
    const meta = tags + ownerBadges + setBadges;
    const sh = entRowShell(it, it.name, it.tags || [], "item", it.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(it.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div>${ownerBadges || setBadges ? `<div class="meta">${ownerBadges}${setBadges}</div>` : ""}<div><h4>${tFn("creator.card.owners", "Người sở hữu")}</h4><div class="sub-list">${ownerRows || `<div class="muted">${tFn("creator.card.no_owners", "Chưa ai sở hữu.")}</div>`}</div></div><div><h4>${tFn("creator.card.in_sets", "Thuộc bộ vật phẩm")}</h4><div class="sub-list">${setRows || `<div class="muted">${tFn("creator.card.no_item_sets", "Không thuộc bộ vật phẩm nào.")}</div>`}</div></div></div></div></div>`;
}
function itemsetCard(b, s) {
    const tags = (s.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const countBadge = `<span class="badge">${(s.items || []).length} ${tFn("creator.is.item_count", "vật phẩm")}</span>`;
    const itemRows =
        (s.items || [])
            .map((k) => {
                if (k.itemId) {
                    const it = (b.items || []).find((x) => x.id === k.itemId);
                    return `<div class="sub-row"><span class="badge">${esc(it ? it.name : tFn("creator.card.missing_item", "(vật phẩm không tồn tại)"))}</span>${it && it.description ? `<span class="muted">${esc(it.description)}</span>` : ""}</div>`;
                }
                return `<div class="sub-row"><span class="badge">${esc(k.name || "")}</span></div>`;
            })
            .join("") ||
        `<div class="muted">${tFn("creator.card.no_items", "Chưa có vật phẩm nào trong bộ.")}</div>`;
    const sh = entRowShell(s, s.name, s.tags || [], "itemset", s.id);
    return `${sh.open}${tags ? `<div class="meta ent-tags">${tags}</div>` : ""}</div>${sh.actions}</div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(s.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="meta">${countBadge}</div><div><h4>${tFn("creator.f.items", "Danh sách vật phẩm của bộ")}</h4><div class="sub-list">${itemRows}</div></div></div></div></div>`;
}
function abilitiesSectionHTML(b) {
    const subs = [
        ["list", tFn("creator.sub.abilities", "Khả năng / Kỹ năng")],
        ["characters", tFn("creator.sub.ability_chars", "Nhân vật")],
    ];
    const body =
        state.abilityTab === "characters"
            ? abilityCharactersHTML(b)
            : entityHTML(
                  b,
                  tFn("creator.tab.abilities", "Năng lực / Kỹ năng"),
                  "ability",
                  "name",
                  "",
              );
    return `<div class="tabs subtabs">${subs
        .map(
            ([k, t]) =>
                `<button class="tab ${state.abilityTab === k ? "active" : ""}" data-abilitytab="${k}">${t}</button>`,
        )
        .join("")}</div>${body}`;
}
function abilityCharactersHTML(b) {
    const chars = b.characters || [];
    const rows =
        chars
            .map((c) => {
                const abilities = (c.abilityIds || [])
                    .map((item) => {
                        const aid =
                            typeof item === "string" ? item : item?.abilityId;
                        const chapterStatuses =
                            typeof item === "object"
                                ? item?.chapterStatuses || {}
                                : {};
                        const ability = (b.abilities || []).find(
                            (x) => x.id === aid,
                        );
                        if (!ability) return null;
                        const statusEntries = Object.entries(chapterStatuses);
                        const statusBadges = statusEntries
                            .map(([chapterId, status]) => {
                                const chapter = (b.chapters || []).find(
                                    (ch) => ch.id === chapterId,
                                );
                                const chapterLabel = chapter
                                    ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${chapter.number}`
                                    : chapterId;
                                return `<span class="badge" title="${esc(chapterLabel)}: ${esc(status)}">${esc(chapterLabel)}: ${esc(status)}</span>`;
                            })
                            .join("");
                        return `<div class="ability-display-row"><span class="ability-name">${esc(ability.name || tFn("creator.noname", "Không tên"))}</span>${statusBadges ? `<div class="ability-statuses">${statusBadges}</div>` : ""}</div>`;
                    })
                    .filter(Boolean);
                const content = abilities.length
                    ? abilities.join("")
                    : `<span class="muted">${tFn("creator.ab.no_skill", "Không sở hữu khả năng nào.")}</span>`;
                return `<div class="card entity-card"><div class="entity-head"><h3>${esc(c.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta">${content}</div></div><div class="actions" style="padding:0 0 15px"><button class="btn small secondary" data-editentity="character" data-id="${c.id}">${tFn("creator.ch.edit", "Sửa")}</button></div></div>`;
            })
            .join("") ||
        `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.ab.none", "Chưa có nhân vật nào.")}</strong>${tFn("creator.ent.empty_hint", "Thêm dữ liệu để xây dựng thế giới truyện.")}</div>`;
    return `<div class="toolbar"><div class="muted">${chars.length} ${tFn("creator.ab.count", "nhân vật")}</div></div><div class="grid cards">${rows}</div>`;
}
function realmsSectionHTML(b) {
    const subs = [
        ["list", tFn("creator.sub.realms", "Giới vực")],
        ["rules", tFn("creator.sub.rules", "Luật lệ / Quy tắc")],
    ];
    const body =
        state.realmTab === "rules"
            ? rulesSectionHTML(b)
            : entityHTML(
                  b,
                  tFn("creator.tab.realms", "Giới vực"),
                  "realm",
                  "name",
                  "",
              );
    return `<div class="tabs subtabs">${subs
        .map(
            ([k, t]) =>
                `<button class="tab ${state.realmTab === k ? "active" : ""}" data-realmtab="${k}">${t}</button>`,
        )
        .join("")}</div>${body}`;
}
function rulesSectionHTML(b) {
    const arr = b.rules || [];
    return `<div class="toolbar"><div><h2 style="margin:0">${tFn("creator.tab.rules", "Luật lệ / Quy tắc")}</h2><div class="muted">${arr.length} ${tFn("creator.rule.count", "luật lệ")}</div></div><button class="btn primary" data-add="rule">${tFn("creator.f.add_rule", "＋ Thêm luật lệ")}</button></div><div class="grid cards">${
        arr.map((x) => ruleCard(b, x)).join("") ||
        `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.tab.rules", "Luật lệ / Quy tắc")}</strong>${tFn("creator.ent.empty_hint", "Thêm dữ liệu để xây dựng thế giới truyện.")}</div>`
    }</div>`;
}
function ruleCard(b, r) {
    const scope =
        r.scopeType === "realm"
            ? (b.realms || []).find((x) => x.id === r.scopeId)
            : r.scopeType === "faction"
              ? (b.factions || []).find((x) => x.id === r.scopeId)
              : null;
    const scopeBadge = scope
        ? `<span class="badge">${esc(scope.name || tFn("creator.noname", "Không tên"))}</span>`
        : "";
    const est =
        r.scopeType === "faction" && r.establisherId
            ? (b.characters || []).find((c) => c.id === r.establisherId)
            : null;
    const estBadge = est
        ? `<span class="badge">${esc(est.name || tFn("creator.noname", "Không tên"))}</span>`
        : "";
    return `<div class="card entity-card collapsible"><div class="entity-head"><h3>${esc(r.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta">${scopeBadge}${estBadge}</div></div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(r.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div><h4>${tFn("creator.rule.punishment", "Hình phạt khi trái lệnh")}</h4><div class="sub-list"><div class="sub-row">${esc(r.punishment || "") || `<span class="muted">${tFn("creator.rule.no_punishment", "Chưa ghi hình phạt.")}</span>`}</div></div></div><div><h4>${tFn("creator.rule.scope", "Nơi có luật này")}</h4><div class="sub-list">${scope ? `<div class="sub-row"><span class="badge">${esc(scope.name || tFn("creator.noname", "Không tên"))}</span></div>` : `<div class="muted">${tFn("creator.rule.no_scope", "Chưa gắn với vị diện / tổ chức nào.")}</div>`}</div></div>${r.scopeType === "faction" ? `<div><h4>${tFn("creator.rule.established_by", "Người thiết lập")}</h4><div class="sub-list">${est ? `<div class="sub-row"><span class="badge">${esc(est.name || tFn("creator.noname", "Không tên"))}</span></div>` : `<div class="muted">${tFn("creator.rule.no_establisher", "Không rõ ai thiết lập.")}</div>`}</div></div>` : ""}<div class="actions"><button class="btn small secondary" data-editentity="rule" data-id="${r.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="rule" data-id="${r.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}
function systemsSectionHTML(b) {
    const ds = b.displaySettings || {};
    const sysTabs = [
        "stats",
        "resources",
        "currencies",
        "effects",
        "quests",
        "combat",
    ];
    const disabledTabs = new Set(
        sysTabs.filter((k) => ds["sys" + k] === "hidden"),
    );
    if (state.systemsTab !== "overview" && disabledTabs.has(state.systemsTab)) {
        state.systemsTab = "overview";
        saveState();
    }
    const sub =
        state.systemsTab === "progression"
            ? "overview"
            : state.systemsTab || "overview";
    const tabs = [
        ["overview", "Tổng quan"],
        ["stats", "Stats"],
        ["resources", "Tài nguyên"],
        ["currencies", "Tiền tệ"],
        ["effects", "Effects / Statuses"],
        ["quests", "Quests / Missions"],
        ["combat", "Combat Stats"],
    ]
        .filter(([k]) => k === "overview" || !disabledTabs.has(k))
        .map(
            ([k, fb]) =>
                `<button class="tab ${sub === k ? "active" : ""}" data-systab="${k}">${tFn("creator.sys.tab_" + k, fb)}</button>`,
        )
        .join("");
    let body = "";
    if (sub === "overview") body = sysOverviewHTML(b);
    else if (sub === "stats") body = sysListHTML(b, "stats");
    else if (sub === "resources") body = sysListHTML(b, "resources");
    else if (sub === "currencies") body = sysListHTML(b, "currencies");
    else if (sub === "effects") body = sysEffectsHTML(b);
    else if (sub === "quests") body = sysQuestsHTML(b);
    else body = sysCombatHTML(b);
    return `<div class="tabs">${tabs}</div>${body}`;
}
function sysOverviewHTML(b) {
    const s = b.systems || {};
    const ds = b.displaySettings || {};
    const codes = [...(s.stats || []), ...(s.resources || [])]
        .map((x) => x.code)
        .filter(Boolean);
    const cards = [
        ["stats", "Stats", (s.stats || []).length],
        ["resources", "Tài nguyên", (s.resources || []).length],
        ["currencies", "Tiền tệ", (s.currencies || []).length],
        ["effects", "Effects / Statuses", (s.effects || []).length],
        [
            "combat",
            "Combat Stats",
            (Array.isArray(s.combat) ? s.combat : []).length,
        ],
        ["quests", "Quests / Missions", (s.quests || []).length],
    ]
        .filter(([k]) => ds["sys" + k] !== "hidden")
        .map(
            ([k, fb, n]) =>
                `<div class="card sys-ov-card" data-sysgoto="${k}"><h3>${tFn("creator.sys.tab_" + k, fb)}</h3><div class="sys-ov-count">${n}</div><div class="muted">${tFn("creator.sys.goto_hint", "Nhấn để mở")}</div></div>`,
        )
        .join("");
    return `<div class="sys-ov-grid">${cards}</div><div class="card" style="margin-top:16px"><h3>${tFn("creator.sys.how_title", "Cách hoạt động")}</h3><ul class="sys-how"><li>${tFn("creator.sys.howd_1", "Mỗi <b>Stat</b> / <b>Tài nguyên</b> đều có công thức <b>DSL</b> riêng — chọn mục ở tab Stats / Tài nguyên để chỉnh.")}</li><li>${tFn("creator.sys.howd_2", "Công thức dùng <b>Formula DSL</b>: if/else, min, max, clamp, round... — base.CODE / bonus.CODE tham chiếu Định nghĩa nguồn, acalc.CODE gọi công thức của stat / tài nguyên khác.")}</li><li>${tFn("creator.sys.how_3", "Không có danh sách stat hard-code — bạn tự tạo stat rồi liên kết vào Combat Stats.")}</li><li>${tFn("creator.sys.how_4", "Dữ liệu Systems được lưu trong truyện: backup .creator / import đã bao gồm toàn bộ.")}</li></ul>${codes.length ? `<div class="def-formula-preview"><code>${esc(codes.join(" · "))}</code></div>` : `<div class="muted">${tFn("creator.sys.no_defs", "Chưa có stat / tài nguyên nào — tạo ở tab Stats hoặc Tài nguyên.")}</div>`}</div>`;
}
function sysListHTML(b, kind) {
    const items = (b.systems || {})[kind] || [];
    const meta = {
        stats: [
            "Stats",
            "＋ Thêm stat",
            "Chưa có stat nào — tạo HP, MP, ATK, CRIT_RATE...",
        ],
        resources: [
            "Tài nguyên",
            "＋ Thêm tài nguyên",
            "Chưa có tài nguyên nào — HP, Mana, Stamina, Rage...",
        ],
        currencies: [
            "Tiền tệ",
            "＋ Thêm tiền tệ",
            "Chưa có tiền tệ nào — Gold, Crystal, Fame...",
        ],
    }[kind];
    const rows = items
        .map((x) => dragRowHTML(sysRowHTML(b, kind, x), x.id))
        .join("");
    const list = `<div class="def-list"><div class="toolbar"><div class="muted">${items.length} ${tFn("creator.sys.tab_" + kind, meta[0]).toLowerCase()}</div><button class="btn primary" data-sysadd="${kind}">${tFn("creator.sys.add_" + kind, meta[1])}</button></div><div class="grid cards" data-draglist="${kind}">${rows || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.sys.empty_" + kind, meta[2])}</strong></div>`}</div></div>`;
    if (kind !== "stats" && kind !== "resources") return list;
    const sel = items.find((x) => x.id === state.systemDslId);
    const right = sel
        ? dslEditorHTML(b, kind, sel)
        : `<div class="def-dsl-empty">${tFn("creator.sys.dsl_empty", "Chọn một stat / tài nguyên ở bên trái để chỉnh DSL.")}</div>`;
    return `<div class="def-section">${list}<div class="def-dsl-panel">${right}</div></div>`;
}
function sysEffectsHTML(b) {
    const items = (b.systems || {}).effects || [];
    const meta = [
        "Effects / Statuses",
        "＋ Thêm effect",
        "Chưa có effect nào — tạo Poison, Burn, Buff, Debuff...",
    ];
    const rows = items
        .map((x) => dragRowHTML(effectRowHTML(b, x), x.id))
        .join("");
    const list = `<div class="def-list"><div class="toolbar"><div class="muted">${items.length} ${tFn("creator.sys.tab_effects", "Effects / Statuses").toLowerCase()}</div><button class="btn primary" data-sysadd="effects">${tFn("creator.sys.add_effects", meta[1])}</button></div><div class="grid cards" data-draglist="effects">${rows || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.sys.empty_effects", meta[2])}</strong></div>`}</div></div>`;
    return list;
}
function effectRowHTML(b, x) {
    const typeLabels = {
        buff: tFn("creator.effect.type.buff", "Buff"),
        debuff: tFn("creator.effect.type.debuff", "Debuff"),
        natural: tFn("creator.effect.type.natural", "Natural Effect"),
        cc: tFn("creator.effect.type.cc", "Crowd Control"),
        dot: tFn("creator.effect.type.dot", "Damage Over Time"),
        hot: tFn("creator.effect.type.hot", "Heal Over Time"),
        shield: tFn("creator.effect.type.shield", "Shield"),
        resource: tFn("creator.effect.type.resource", "Resource Change"),
        stat_mod: tFn("creator.effect.type.stat_mod", "Stat Modifier"),
        custom: tFn("creator.effect.type.custom", "Custom Effect"),
    };
    const targetLabels = {
        self: tFn("creator.effect.target.self", "Self"),
        ally: tFn("creator.effect.target.ally", "Ally"),
        enemy: tFn("creator.effect.target.enemy", "Enemy"),
        area: tFn("creator.effect.target.area", "Area"),
        custom: tFn("creator.effect.target.custom", "Custom"),
    };
    const typeBadge = `<span class="badge">${esc(typeLabels[x.type] || x.type || "—")}</span>`;
    const targetBadge = `<span class="badge">${esc(targetLabels[x.target] || x.target || "—")}</span>`;
    const head = `<div class="entity-head"><div class="entity-title">${esc(x.name || "(không tên)")}</div><div class="meta">${typeBadge}${targetBadge}</div><div class="entity-actions"><button class="btn small secondary" data-sysedit="effects" data-id="${esc(x.id)}">${tFn("creator.f.edit", "Sửa")}</button><button class="btn small danger" data-sysdel="effects" data-id="${esc(x.id)}">${tFn("creator.f.delete", "Xóa")}</button></div></div>`;
    const fields = [];
    const addF = (label, value) => {
        const v = String(value ?? "").trim();
        if (v)
            fields.push(
                `<div class="sys-field"><span class="muted">${label}:</span><b>${esc(v)}</b></div>`,
            );
    };
    addF("Code", x.code);
    const tags = (x.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const desc = (x.description || "").trim()
        ? `<div class="muted" style="margin-top:8px">${esc(x.description)}</div>`
        : "";
    return `<div class="card entity-card">${head}<div class="sys-fields">${fields.join("")}</div>${tags ? `<div style="margin-top:8px">${tags}</div>` : ""}${desc}</div>`;
}
function bindQuestDynRows(m) {
    const form = m.querySelector("#sysForm");
    if (!form) return;
    const typeInput = form.querySelector('input[name="type"]');
    const typeCustom = form.querySelector('input[name="typeCustom"]');
    const syncCustom = () => {
        if (!typeInput || !typeCustom) return;
        const isCustom = typeInput.value === "custom";
        typeCustom.disabled = !isCustom;
        typeCustom.style.opacity = isCustom ? "" : ".5";
        if (!isCustom) typeCustom.value = "";
    };
    form.addEventListener("change", (e) => {
        if (e.target === typeInput) syncCustom();
    });
    syncCustom();
}
function questFormHTML(x, b) {
    return questFormBasicHTML(x, b);
}
function questFormBasicHTML(x, b) {
    const F = sysFormHelpers();
    const Q = (k, f) => tFn("creator.quest." + k, f);
    const idOpts = (arr, sel) =>
        `<option value="">—</option>` +
        (arr || [])
            .map(
                (z) =>
                    `<option value="${esc(z.id)}" ${sel && sel === z.id ? "selected" : ""}>${esc(z.name || z.code || z.id)}</option>`,
            )
            .join("");
    const showCustom = x.type === "custom";
    return (
        `<div class="form-row">` +
        F.field(
            Q("f_name", "Tên *"),
            F.input("name", x.name, "Slay the Beast", 1),
        ) +
        F.field(Q("f_code", "Code"), F.input("code", x.code, "QUEST_001")) +
        `</div><div class="form-row">` +
        F.field(
            Q("f_type", "Loại nhiệm vụ"),
            effectComboHTML(
                "type",
                "type",
                QUEST_TYPE_OPTIONS,
                x.type,
                "creator.quest.",
            ),
        ) +
        F.field(
            Q("f_priority", "Độ ưu tiên"),
            effectComboHTML(
                "priority",
                "priority",
                QUEST_PRIORITY_OPTIONS,
                x.priority || "normal",
                "creator.quest.",
            ),
        ) +
        `</div>` +
        F.field(
            Q("f_type_custom", "Tên loại tùy chỉnh"),
            `<input name="typeCustom" value="${esc(x.type && !QUEST_TYPE_OPTIONS.includes(x.type) ? x.type : "")}" placeholder="${esc(Q("f_type_custom_ph", "epic_hunt"))}" ${showCustom ? "" : 'disabled style="opacity:.5;"'}>`,
        ) +
        F.field(
            Q("f_giver", "Người giao"),
            F.input("giver", x.giver, "Elder Ronan"),
        ) +
        `<div class="form-row">` +
        F.field(
            Q("f_faction", "Phe phái"),
            `<select name="factionId">${idOpts(b.factions, x.factionId)}</select>`,
        ) +
        F.field(
            Q("f_character", "Nhân vật liên quan"),
            `<select name="characterId">${idOpts(b.characters, x.characterId)}</select>`,
        ) +
        `</div>` +
        F.field(
            Q("f_location", "Địa điểm"),
            F.input("location", x.location, "Whispering Woods"),
        )
    );
}
function questRowHTML(b, x) {
    const Q = (k, f) => tFn("creator.quest." + k, f);
    const nameById = (arr, id) =>
        ((arr || []).find((z) => z.id === id) || {}).name || "";
    const typeLabel =
        x.type === "custom"
            ? esc(x.typeCustom || Q("type.custom", "Custom Quest"))
            : esc(Q("type." + x.type, x.type || ""));
    const pri = x.priority || "normal";
    const priColor =
        pri === "critical"
            ? "var(--danger,#e53e3e)"
            : pri === "high"
              ? "var(--warning,#dd6b20)"
              : "var(--text-muted,#718096)";
    const head = `<div class="card entity-card collapsible"><div class="entity-head"><h3>${esc(x.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta"><span class="badge">${typeLabel}</span><span class="badge" style="color:${priColor}">${esc(Q("priority." + pri, pri))}</span></div></div><div class="entity-collapse"><div class="entity-collapse-inner">`;
    const desc = x.description
        ? `<div class="muted">${esc(x.description)}</div>`
        : "";
    const infoBits = [
        x.giver ? `${Q("f_giver", "Người giao")}: ${esc(x.giver)}` : "",
        x.location ? `${Q("f_location", "Địa điểm")}: ${esc(x.location)}` : "",
        x.factionId
            ? `${Q("f_faction", "Phe phái")}: ${esc(nameById(b.factions, x.factionId) || x.factionId)}`
            : "",
        x.characterId
            ? `${Q("f_character", "Nhân vật liên quan")}: ${esc(nameById(b.characters, x.characterId) || x.characterId)}`
            : "",
    ].filter(Boolean);
    const info = infoBits.length
        ? `<div class="muted" style="font-size:0.85rem">${infoBits.join(" · ")}</div>`
        : "";
    const actions = `<div class="actions"><button class="btn small secondary" data-sysedit="quests" data-id="${esc(x.id)}">${tFn("creator.f.edit", "Sửa")}</button><button class="btn small danger" data-sysdel="quests" data-id="${esc(x.id)}">${tFn("creator.f.delete", "Xóa")}</button></div>`;
    return head + desc + info + actions + `</div></div></div>`;
}
function sysQuestsHTML(b) {
    const items = (b.systems || {}).quests || [];
    const rows = items
        .map((x) => dragRowHTML(questRowHTML(b, x), x.id))
        .join("");
    return `<div class="def-list"><div class="toolbar"><div class="muted">${items.length} ${tFn("creator.sys.tab_quests", "Quests / Missions").toLowerCase()}</div><button class="btn primary" data-sysadd="quests">${tFn("creator.sys.add_quests", "＋ Thêm quest")}</button></div><div class="grid cards" data-draglist="quests">${rows || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.sys.empty_quests", "Chưa có nhiệm vụ nào — tạo nhiệm vụ đầu tiên để gắn với nhân vật, phe phái và sự kiện.")}</strong></div>`}</div></div>`;
}
function sysFormulaVarNames(src) {
    let tokens;
    try {
        tokens = tokenizeFormula(String(src || ""));
    } catch (e) {
        return [];
    }
    const out = [];
    const seen = new Set();
    const walk = (list) => {
        for (const tk of list || []) {
            if (tk.type === "word") {
                const w = String(tk.value || "");
                if (/^(true|false)$/i.test(w)) continue;
                if (!seen.has(w)) {
                    seen.add(w);
                    out.push(w);
                }
            } else if (tk.children) walk(tk.children);
        }
    };
    walk(tokens);
    return out;
}
function sysDefOptions(defs, sel) {
    const cur = String(sel || "");
    const opts = defs
        .map(
            (d) =>
                `<option value="${esc(d.code)}" ${cur && cur === d.code ? "selected" : ""}>${esc(d.code)} — ${esc(d.name || "")}</option>`,
        )
        .join("");
    return `<option value="">—</option>${opts}`;
}
function sysRowHTML(b, kind, x) {
    const defs = (b.definitions || []).filter((d) => d.code);
    const typeLabels = {
        stat: tFn("creator.type.stat", "Stat"),
        resource: tFn("creator.type.resource", "Tài nguyên"),
        currency: tFn("creator.type.currency", "Tiền tệ"),
    };
    const head = `<div class="entity-head"><div class="entity-title">${esc(x.name || "(không tên)")}</div><span class="badge">${esc(typeLabels[kind] || kind)}</span><div class="entity-actions"><button class="btn small secondary" data-sysedit="${kind}" data-id="${esc(x.id)}">${tFn("creator.f.edit", "Sửa")}</button><button class="btn small danger" data-sysdel="${kind}" data-id="${esc(x.id)}">${tFn("creator.f.delete", "Xóa")}</button></div></div>`;
    const fields = [];
    const addF = (label, value) => {
        const v = String(value ?? "").trim();
        if (v)
            fields.push(
                `<div class="sys-field"><span class="muted">${label}:</span><b>${esc(v)}</b></div>`,
            );
    };
    if (kind === "stats") {
        addF("Code", x.code);
        addF("Type", x.type);
        addF("Data", x.dataType);
        addF("Unit", x.unit);
        if (x.useFormula)
            addF("Default", (x.defaultValue || "") + " (formula)");
        else addF("Default", x.defaultValue);
        addF("Min", x.min);
        addF("Max", x.max);
        addF("Scope", x.scope);
    } else if (kind === "resources") {
        addF("Code", x.code);
        addF("Max", x.max);
        addF("Current", x.current);
        addF("Regen", sysRegenLabel(x));
    } else if (kind === "currencies") {
        addF("Code", x.code);
        addF("Value", x.value);
        addF("Symbol", x.symbol);
    }
    const depChips = sysDepChips(b, defs, x);
    const desc = (x.description || "").trim()
        ? `<div class="muted" style="margin-top:8px">${esc(x.description)}</div>`
        : "";
    const dslKind = kind === "stats" || kind === "resources";
    const clickCursor = dslKind ? ' style="cursor:pointer"' : "";
    return `<div class="card entity-card sys-row${dslKind && state.systemDslId === x.id ? " def-selected" : ""}"${clickCursor}${dslKind ? ` data-sysselect="${esc(x.id)}"` : ""}>${head}<div class="sys-fields">${fields.join("")}</div>${depChips}${desc}</div>`;
}
function sysDepChips(b, defs, x) {
    const codeOf = (id) => {
        const d = (defs || []).find((dd) => dd.id === id);
        return d ? d.code : "";
    };
    const chips = [];
    const push = (label, cls, title) => {
        if (label)
            chips.push(
                `<span class="sys-chip ${cls}" title="${esc(title)}">${esc(label)}</span>`,
            );
    };
    for (const fk of ["baseDefId", "bonusDefId"]) {
        if (x[fk]) {
            const c = codeOf(x[fk]);
            push(
                (fk === "baseDefId" ? "base." : "bonus.") + (c || "?"),
                c ? "def" : "warn",
                tFn("creator.sys.dep_def", "Định nghĩa nguồn dữ liệu"),
            );
        }
    }
    for (const v of sysFormulaVarNames(x.formula || ""))
        push(v, "var", tFn("creator.sys.dep_var", "Biến trong công thức"));
    for (const v of sysFormulaVarNames(x.regenFormula || ""))
        push(v, "var", tFn("creator.sys.dep_var", "Biến trong công thức"));
    if (!chips.length) return "";
    return `<div class="sys-deps"><span class="sys-dep-label muted">${tFn("creator.sys.deps", "Phụ thuộc")}</span>${chips.join("")}</div>`;
}
function definitionsSectionHTML(b) {
    const defs = b.definitions || [];
    const list = `<div class="def-list"><div class="toolbar"><div><h2 style="margin:0">${tFn("creator.tab.definitions", "Định nghĩa")}</h2><div class="muted">${defs.length} ${tFn("creator.def.count", "định nghĩa")}</div></div><button class="btn primary" data-add="definition">${tFn("creator.def.add", "＋ Thêm định nghĩa")}</button></div><div class="grid cards" data-draglist="definitions">${defs.map((d) => dragRowHTML(definitionCard(b, d), d.id)).join("") || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.def.empty", "Chưa có định nghĩa nào.")}</strong></div>`}</div></div>`;
    return list;
}
function sysCombatHTML(b) {
    const s = b.systems || {};
    const stats = s.stats || [];
    const cats = Array.isArray(s.combat) ? s.combat : [];
    const cards = cats
        .map((c) => dragRowHTML(sysCombatCardHTML(b, c, stats), c.id))
        .join("");
    return `<div class="def-list"><div class="toolbar"><div class="muted">${cats.length} ${tFn("creator.sys.cb_count", "hạng mục")}</div><button class="btn primary" data-sysadd="combat">${tFn("creator.sys.cb_add_cat", "＋ Thêm hạng mục")}</button></div><div class="grid cards" data-draglist="combat">${cards || `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.sys.cb_empty", "Chưa có hạng mục combat nào — tạo hạng mục đầu tiên.")}</strong></div>`}</div></div>`;
}
function sysCombatCardHTML(b, c, stats) {
    const rows = (c.stats || [])
        .map((r, i) => sysCombatRowHTML(r, stats, i))
        .join("");
    const tags = (c.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const head = `<div class="entity-head"><h3>${esc(c.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta"><span class="badge">${(c.stats || []).length} ${tFn("creator.sys.cb_stat_count", "chỉ số")}</span>${tags}</div><div class="entity-actions"><button class="btn small secondary" data-sysedit="combat" data-id="${esc(c.id)}">${tFn("creator.f.edit", "Sửa")}</button><button class="btn small danger" data-sysdel="combat" data-id="${esc(c.id)}">${tFn("creator.f.delete", "Xóa")}</button></div></div>`;
    const desc = (c.description || "").trim()
        ? `<div class="muted">${esc(c.description)}</div>`
        : "";
    return `<div class="card entity-card collapsible">${head}<div class="entity-collapse"><div class="entity-collapse-inner">${desc}<div><h4>${tFn("creator.sys.cb_f_stats", "Chỉ số có mặt")}</h4><div class="sys-dyn-list" data-draglist="cb" data-cbg="${esc(c.id)}">${rows}</div><div class="actions" style="margin:0"><button type="button" class="btn small ghost" data-cbadd="${esc(c.id)}">＋ ${tFn("creator.sys.cb_add_stat", "Gắn stat")}</button></div></div></div></div></div>`;
}
function sysCombatRowHTML(r, stats, idx) {
    const opts = stats
        .map(
            (st) =>
                `<option value="${esc(st.id)}" ${r.statId === st.id ? "selected" : ""}>${esc(st.code ? `${st.name} (${st.code})` : st.name)}</option>`,
        )
        .join("");
    const missing = r.statId && !stats.some((x) => x.id === r.statId);
    return `<div class="sys-dyn-row" data-dragrow="${idx}"><span class="drag-handle" data-draghandle title="${tFn("creator.drag.hint", "Kéo để di chuyển thứ tự")}">⁝⁝</span><select>${missing ? `<option selected value="${esc(r.statId)}">⚠ ${tFn("creator.sys.stat_missing", "(stat đã bị xóa)")}</option>` : ""}${opts}</select><input value="${esc(r.note || "")}" placeholder="${tFn("creator.sys.cb_stat_desc_ph", "Mô tả chỉ số...")}"><button type="button" class="btn small danger" data-cbdel title="${tFn("creator.arc.unlink", "Gỡ")}">×</button></div>`;
}
function openCbStatSelector(catId) {
    const N = (k, f) => tFn("creator.sys." + k, f);
    getBook(state.bookId).then((b) => {
        if (!b) return;
        b.systems = b.systems || {};
        const stats = b.systems.stats || [];
        const cat = (b.systems.combat || []).find((c) => c && c.id === catId);
        if (!cat) return;
        const existingIds = new Set((cat.stats || []).map((r) => r.statId));
        const m = $("#modal");
        if (!stats.length) {
            m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${N("cb_select_title", "Chọn stat để thêm")}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><div class="muted">${N("cb_no_stats", "Chưa có stat nào — hãy tạo stat ở tab Stats trước.")}</div></div><div class="modal-foot"><button class="btn ghost" onclick="modal.close()">${N("cb_cancel", "Đóng")}</button></div></div>`;
            m.showModal();
            return;
        }
        const checkboxes = stats
            .map((st) => {
                const checked = existingIds.has(st.id) ? "checked" : "";
                const disabled = existingIds.has(st.id) ? "disabled" : "";
                const label = st.code ? `${st.name} (${st.code})` : st.name;
                return `<label class="cb-stat-option"><input type="checkbox" data-cbstat="${esc(st.id)}" ${checked} ${disabled}><span>${esc(label)}</span>${existingIds.has(st.id) ? `<span class="muted" style="font-size:11px">(${tFn("creator.sys.cb_added", "đã thêm")})</span>` : ""}</label>`;
            })
            .join("");
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${N("cb_select_title", "Chọn stat để thêm")}</strong><button class="icon-btn" id="cbSelectClose">×</button></div><div class="modal-body"><div class="muted" style="margin-bottom:12px">${N("cb_select_hint", "Chọn các stat bạn muốn thêm vào hạng mục này")}</div><div class="cb-stat-list">${checkboxes}</div></div><div class="modal-foot"><span class="muted" id="cbSelectedCount" style="flex:1;font-size:13px"></span><button class="btn ghost" id="cbSelectCancel">${N("cb_cancel", "Hủy")}</button><button class="btn primary" id="cbSelectConfirm">${N("cb_confirm", "Thêm")}</button></div></div>`;
        m.showModal();
        const updateCount = () => {
            const count = m.querySelectorAll(
                ".cb-stat-option input[data-cbstat]:checked:not([disabled])",
            ).length;
            const total = m.querySelectorAll(
                ".cb-stat-option input[data-cbstat]:not([disabled])",
            ).length;
            $("#cbSelectedCount").textContent =
                `${count}/${total} ${N("cb_selected_count", "đã chọn")}`;
        };
        updateCount();
        m.querySelectorAll(".cb-stat-option input[data-cbstat]").forEach(
            (input) => {
                input.addEventListener("change", updateCount);
            },
        );
        $("#cbSelectClose").onclick = () => m.close();
        $("#cbSelectCancel").onclick = () => m.close();
        $("#cbSelectConfirm").onclick = async () => {
            const selected = [
                ...m.querySelectorAll(
                    ".cb-stat-option input[data-cbstat]:checked:not([disabled])",
                ),
            ].map((i) => i.dataset.cbstat);
            if (!selected.length) {
                m.close();
                return;
            }
            cat.stats = cat.stats || [];
            for (const statId of selected) {
                if (!existingIds.has(statId)) {
                    cat.stats.push({ statId, note: "" });
                }
            }
            await putBook(b);
            toast(tFn("creator.toast.saved", "Đã lưu"));
            m.close();
            render();
        };
    });
}
const SYSTEM_REGEN_UNITS = [
    "sec",
    "min",
    "hour",
    "day",
    "week",
    "month",
    "years",
    "decade",
    "century",
    "millennium",
];
function sysRegenUnitSelect(name, cur) {
    return `<select name="${name}">${SYSTEM_REGEN_UNITS.map(
        (u) =>
            `<option value="${u}" ${cur === u ? "selected" : ""}>${u}</option>`,
    ).join("")}</select>`;
}
function sysRegenLabel(x) {
    const amt = String((x && x.regen) ?? "").trim();
    if (!amt) return "";
    const t =
        x.regenTime != null && String(x.regenTime).trim() !== ""
            ? String(x.regenTime).trim()
            : "1";
    const u = SYSTEM_REGEN_UNITS.includes(x.regenUnit) ? x.regenUnit : "sec";
    return `${amt} / ${t} ${u}`;
}
function sysFormHelpers() {
    const field = (label, inner) =>
        `<div class="field"><label>${label}</label>${inner}</div>`;
    const input = (name, value, ph, req) =>
        `<input name="${name}" value="${esc(value ?? "")}" placeholder="${esc(ph || "")}" ${req ? "required" : ""}>`;
    const num = (name, value, step) =>
        `<input name="${name}" type="number" step="${step || "any"}" value="${esc(value ?? "")}">`;
    const ta = (name, value, ph, mono) =>
        `<textarea name="${name}" placeholder="${esc(ph || "")}" ${mono ? 'class="def-formula-input"' : ""}>${esc(value ?? "")}</textarea>`;
    const select = (name, options, cur) =>
        `<select name="${name}">${options
            .map(
                (v) =>
                    `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(v)}</option>`,
            )
            .join("")}</select>`;
    return { field, input, num, ta, select };
}
function sysCbStatOptions(stats, sel) {
    return (
        `<option value="">—</option>` +
        stats
            .map(
                (st) =>
                    `<option value="${esc(st.id)}" ${sel === st.id ? "selected" : ""}>${esc(st.code ? `${st.name} (${st.code})` : st.name)}</option>`,
            )
            .join("")
    );
}
function combatFormHTML(x, b) {
    const F = sysFormHelpers();
    const N = (k, f) => tFn("creator.sys." + k, f);
    const stats = (b.systems || {}).stats || [];
    const rows = (x.stats || [])
        .map(
            (r) =>
                `<div class="sys-dyn-row" data-cbrow><select data-cbstat>${sysCbStatOptions(stats, r.statId)}</select><input data-cbnote value="${esc(r.note || "")}" placeholder="${esc(N("cb_stat_desc_ph", "Mô tả chỉ số..."))}"><button type="button" class="btn small danger" data-cbrowdel title="${tFn("creator.arc.unlink", "Gỡ")}">×</button></div>`,
        )
        .join("");
    return (
        F.field(
            N("cb_f_name", "Tên hạng mục *"),
            F.input("name", x.name, "Tấn công", 1),
        ) +
        F.field(
            N("cb_f_tags", "Tag"),
            F.input("tags", (x.tags || []).join(", "), "tag1, tag2..."),
        ) +
        `<div class="field"><label>${N("cb_f_stats", "Chỉ số có mặt")}</label><div id="cbStatList" class="sys-dyn-list">${rows}</div><div class="actions" style="margin:8px 0 0"><button type="button" class="btn small ghost" id="cbAddRow">${N("cb_add_row", "＋ Thêm chỉ số")}</button></div></div>`
    );
}
function bindCombatFormRows(m, b) {
    const list = m.querySelector("#cbStatList");
    if (!list) return;
    const container = list.parentElement;
    if (!container) return;
    const stats = (b.systems || {}).stats || [];
    const N = (k, f) => tFn("creator.sys." + k, f);
    container.addEventListener("click", (e) => {
        const del = e.target.closest("[data-cbrowdel]");
        if (del) {
            const row = del.closest("[data-cbrow]");
            if (row) row.remove();
            return;
        }
        if (!e.target.closest("#cbAddRow")) return;
        const existingIds = new Set(
            [...list.querySelectorAll("[data-cbrow] select[data-cbstat]")].map(
                (sel) => sel.value,
            ),
        );
        const modal = $("#modal");
        const savedForm = m.innerHTML;
        const savedScroll = modal.scrollTop;
        if (!stats.length) {
            modal.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${N("cb_select_title", "Chọn stat để thêm")}</strong><button class="icon-btn" id="cbFormSelectClose">×</button></div><div class="modal-body"><div class="muted">${N("cb_no_stats", "Chưa có stat nào — hãy tạo stat ở tab Stats trước.")}</div></div><div class="modal-foot"><button class="btn ghost" id="cbFormSelectCancel">${N("cb_cancel", "Đóng")}</button></div></div>`;
            $("#cbFormSelectClose").onclick = () => {
                m.innerHTML = savedForm;
                modal.scrollTop = savedScroll;
                bindCombatFormRows(m, b);
            };
            $("#cbFormSelectCancel").onclick = () => {
                m.innerHTML = savedForm;
                modal.scrollTop = savedScroll;
                bindCombatFormRows(m, b);
            };
            return;
        }
        const checkboxes = stats
            .map((st) => {
                const checked = existingIds.has(st.id) ? "checked" : "";
                const disabled = existingIds.has(st.id) ? "disabled" : "";
                const label = st.code ? `${st.name} (${st.code})` : st.name;
                return `<label class="cb-stat-option"><input type="checkbox" data-cbstat="${esc(st.id)}" ${checked} ${disabled}><span>${esc(label)}</span>${existingIds.has(st.id) ? `<span class="muted" style="font-size:11px">(${N("cb_added", "đã thêm")})</span>` : ""}</label>`;
            })
            .join("");
        modal.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${N("cb_select_title", "Chọn stat để thêm")}</strong><button class="icon-btn" id="cbFormSelectClose">×</button></div><div class="modal-body"><div class="muted" style="margin-bottom:12px">${N("cb_select_hint", "Chọn các stat bạn muốn thêm vào hạng mục này")}</div><div class="cb-stat-list">${checkboxes}</div></div><div class="modal-foot"><span class="muted" id="cbFormSelectedCount" style="flex:1;font-size:13px"></span><button class="btn ghost" id="cbFormSelectCancel">${N("cb_cancel", "Hủy")}</button><button class="btn primary" id="cbFormSelectConfirm">${N("cb_confirm", "Thêm")}</button></div></div>`;
        const updateCount = () => {
            const count = modal.querySelectorAll(
                ".cb-stat-option input[data-cbstat]:checked:not([disabled])",
            ).length;
            const total = modal.querySelectorAll(
                ".cb-stat-option input[data-cbstat]:not([disabled])",
            ).length;
            $("#cbFormSelectedCount").textContent =
                `${count}/${total} ${N("cb_selected_count", "đã chọn")}`;
        };
        updateCount();
        modal
            .querySelectorAll(".cb-stat-option input[data-cbstat]")
            .forEach((input) => {
                input.addEventListener("change", updateCount);
            });
        $("#cbFormSelectClose").onclick = () => {
            m.innerHTML = savedForm;
            modal.scrollTop = savedScroll;
            bindCombatFormRows(m, b);
        };
        $("#cbFormSelectCancel").onclick = () => {
            m.innerHTML = savedForm;
            modal.scrollTop = savedScroll;
            bindCombatFormRows(m, b);
        };
        $("#cbFormSelectConfirm").onclick = () => {
            const selected = [
                ...modal.querySelectorAll(
                    ".cb-stat-option input[data-cbstat]:checked:not([disabled])",
                ),
            ].map((i) => i.dataset.cbstat);

            m.innerHTML = savedForm;
            modal.scrollTop = savedScroll;

            const newList = m.querySelector("#cbStatList");
            if (!newList) return;

            for (const statId of selected) {
                if (!existingIds.has(statId)) {
                    const div = document.createElement("div");
                    div.className = "sys-dyn-row";
                    div.setAttribute("data-cbrow", "");

                    div.innerHTML =
                        `<select data-cbstat>` +
                        sysCbStatOptions(stats, statId) +
                        `</select>` +
                        `<input data-cbnote placeholder="${esc(
                            N("cb_stat_desc_ph", "Mô tả chỉ số..."),
                        )}">` +
                        `<button type="button" class="btn small danger" data-cbrowdel ` +
                        `title="${esc(tFn("creator.arc.unlink", "Gỡ"))}">×</button>`;

                    newList.appendChild(div);
                }
            }

            bindCombatFormRows(m, b);
        };
    });
}
function sysFormHTML(kind, x, b) {
    const F = sysFormHelpers();
    const defs = (b.definitions || []).filter((d) => d.code);
    const defOpts = (sel) => sysDefOptions(defs, sel);
    const N = (k, f) => tFn("creator.sys." + k, f);
    let rows = "";
    if (kind === "stats") {
        rows =
            `<div class="form-row">` +
            F.field(N("f_name", "Tên *"), F.input("name", x.name, "HP", 1)) +
            F.field("Code", F.input("code", x.code, "HP")) +
            `</div><div class="form-row">` +
            F.field(
                N("f_type", "Type"),
                F.input("type", x.type, "primary / derived / combat"),
            ) +
            F.field(
                N("f_datatype", "Data Type"),
                F.select(
                    "dataType",
                    ["number", "boolean", "string"],
                    x.dataType || "number",
                ),
            ) +
            `</div><div class="form-row">` +
            F.field(
                N("f_unit", "Unit"),
                F.input("unit", x.unit, "điểm, %, m/s..."),
            ) +
            F.field(
                N("f_default", "Default Value"),
                F.input("defaultValue", x.defaultValue, "0"),
            ) +
            `</div><div class="form-row">` +
            F.field(N("f_min", "Minimum"), F.num("min", x.min)) +
            F.field(N("f_max", "Maximum"), F.num("max", x.max)) +
            `</div>` +
            F.field(
                N("f_scope", "Scope"),
                F.select(
                    "scope",
                    ["global", "character", "faction", "item", "ability"],
                    x.scope || "global",
                ),
            ) +
            F.field(
                N("f_tags", "Tags"),
                F.input("tags", (x.tags || []).join(", "), "combat, core..."),
            ) +
            `<div class="field"><label class="switch-label"><input type="checkbox" name="useFormula" ${x.useFormula ? "checked" : ""}> ${N("f_useformula", "Default Value dùng công thức")}</label></div>` +
            F.field(
                N("f_formula", "Formula (Formula DSL)"),
                F.ta("formula", x.formula, "acalc.ATK_BASE * 2", 1),
            ) +
            `${defFormulaGuideHTML()}` +
            `<div class="form-row">` +
            F.field(
                N("f_base", "Definition nguồn (base)"),
                `<select name="baseDefId">${defOpts(x.baseDefId)}</select>`,
            ) +
            F.field(
                N("f_bonus", "Definition nguồn (bonus)"),
                `<select name="bonusDefId">${defOpts(x.bonusDefId)}</select>`,
            ) +
            `</div>`;
    } else if (kind === "resources") {
        rows =
            `<div class="form-row">` +
            F.field(N("f_name", "Tên *"), F.input("name", x.name, "Mana", 1)) +
            F.field("Code", F.input("code", x.code, "MP")) +
            `</div><div class="form-row">` +
            F.field(N("f_max", "Maximum"), F.input("max", x.max, "100")) +
            F.field(
                N("f_current", "Current"),
                F.input("current", x.current, "100"),
            ) +
            `</div>` +
            F.field(
                N("f_regen", "Regeneration"),
                `<div class="form-row" style="gap:6px">${F.num("regen", x.regen, "any")}<span class="muted">/</span>${sysRegenUnitSelect("regenUnit", x.regenUnit)}${F.num("regenTime", x.regenTime ?? "1", "any")}</div>`,
            ) +
            `<div class="muted" style="font-size:12px;margin:-6px 0 10px">${N("f_regen_hint_dsl", "Số hồi phục / khoảng thời gian — vd: 5 / 3 min = hồi 5 mỗi 3 phút.")}</div>` +
            `<div class="field"><label class="switch-label"><input type="checkbox" name="useRegenFormula" ${x.useRegenFormula ? "checked" : ""}> ${N("f_useregen", "Regeneration dùng công thức")}</label></div>` +
            F.field(
                N("f_regenformula", "Regeneration Formula (Formula DSL)"),
                F.ta(
                    "regenFormula",
                    x.regenFormula,
                    "current.hp + 5 * time",
                    1,
                ),
            ) +
            `${defFormulaGuideHTML(tFn("creator.f.def_formula_regen_vars", '<div class="def-guide-block"><div class="def-guide-h">6 · Biến cho Tài nguyên</div><ul><li><code>current.code</code> — giá trị hiện tại của tài nguyên</li><li><code>max.code</code> — giá trị tối đa đã thiết lập</li><li><code>time</code> — số thời gian theo đơn vị hồi phục hiện tại</li></ul></div>'))}`;
    } else {
        rows =
            `<div class="form-row">` +
            F.field(N("f_name", "Tên *"), F.input("name", x.name, "Gold", 1)) +
            F.field("Code", F.input("code", x.code, "GOLD")) +
            `</div><div class="form-row">` +
            F.field(N("f_value", "Value"), F.input("value", x.value, "0")) +
            F.field(
                N("f_symbol", "Symbol"),
                F.input("symbol", x.symbol, "🪙 / $"),
            ) +
            `</div>`;
    }
    return rows;
}
function effectFormHTML(x, b) {
    const F = sysFormHelpers();
    const N = (k, f) => tFn("creator.effect." + k, f);
    const rows =
        `<div class="form-row">` +
        F.field(N("f_name", "Tên *"), F.input("name", x.name, "Poison", 1)) +
        F.field("Code", F.input("code", x.code, "POISON")) +
        `</div><div class="form-row">` +
        F.field(
            N("f_type", "Type"),
            effectComboHTML("type", "type", EFFECT_TYPE_OPTIONS, x.type),
        ) +
        F.field(
            N("f_target", "Target"),
            effectComboHTML(
                "target",
                "target",
                EFFECT_TARGET_OPTIONS,
                x.target,
            ),
        ) +
        `</div>` +
        F.field(
            N("f_tags", "Tags"),
            F.input("tags", (x.tags || []).join(", "), "combat, magic..."),
        );
    return rows;
}
function definitionCard(b, d) {
    const tags = (d.tags || [])
        .map((t) => `<span class="badge">${esc(t)}</span>`)
        .join("");
    const codeBadge = d.code ? `<span class="badge">${esc(d.code)}</span>` : "";
    return `<div class="card entity-card collapsible"><div class="entity-head"><h3>${esc(d.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta">${codeBadge}${tags}</div></div><div class="entity-collapse"><div class="entity-collapse-inner"><div class="muted">${esc(d.description || "") || tFn("creator.nodesc", "Chưa có mô tả.")}</div><div class="actions"><button class="btn small secondary" data-editentity="definition" data-id="${d.id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="definition" data-id="${d.id}">${tFn("creator.ch.delete", "Xóa")}</button></div></div></div></div>`;
}

function tokenizeFormula(src) {
    const s = String(src || "");
    const out = [];
    let i = 0;
    const isWord = (c) => /[A-Za-z0-9_.]/.test(c || "");
    const skipWS = (j) => {
        while (j < s.length && /\s/.test(s[j])) j++;
        return j;
    };
    const kwLabel = (w) => {
        const lw = String(w || "")
            .toLowerCase()
            .replace(/\s+/g, " ");
        return lw === "elseif" || lw === "elif" ? "else if" : lw;
    };
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (c === "{" && s[i + 1] === "{") {
            let depth = 0,
                j = i;
            while (j < s.length) {
                if (s[j] === "{" && s[j + 1] === "{") {
                    depth++;
                    j += 2;
                    continue;
                }
                if (s[j] === "}" && s[j + 1] === "}") {
                    depth--;
                    j += 2;
                    if (depth === 0) break;
                    continue;
                }
                j++;
            }
            out.push({ type: "str", value: s.slice(i, j) });
            i = j;
            continue;
        }
        const kwMatch = s.slice(i).match(/^(if|elif|else\s*if|else)\b/i);
        if (kwMatch) {
            const kw = kwMatch[0];
            let j = i + kw.length;
            j = skipWS(j);
            let cond = "";
            if (s[j] === "(") {
                let depth = 0,
                    k = j;
                while (k < s.length) {
                    if (s[k] === "(") depth++;
                    else if (s[k] === ")") {
                        depth--;
                        if (depth === 0) {
                            k++;
                            break;
                        }
                    }
                    k++;
                }
                cond = s.slice(j + 1, k - 1);
                j = k;
            }
            j = skipWS(j);
            if (s[j] === "{") {
                let depth = 0,
                    k = j;
                while (k < s.length) {
                    if (s[k] === "{") depth++;
                    else if (s[k] === "}") {
                        depth--;
                        if (depth === 0) {
                            k++;
                            break;
                        }
                    }
                    k++;
                }
                const block = s.slice(j + 1, k - 1);
                const isElseHead = kw.toLowerCase() === "else";
                const branches = [
                    {
                        type: "ifbranch",
                        children: [
                            {
                                type: "kw",
                                value: kwLabel(kw),
                            },
                            ...(isElseHead
                                ? []
                                : [
                                      {
                                          type: "group",
                                          children: tokenizeFormula(cond),
                                      },
                                  ]),
                            {
                                type: "group",
                                children: tokenizeFormula(block),
                            },
                        ],
                    },
                ];

                let m = k;
                for (;;) {
                    const ws = skipWS(m);
                    const next = s.slice(ws).match(/^(else\s*if|elif|else)\b/i);
                    if (!next) break;
                    let n2 = ws + next[0].length;
                    n2 = skipWS(n2);
                    let cond2 = "";
                    if (s[n2] === "(") {
                        let depth2 = 0,
                            p = n2;
                        while (p < s.length) {
                            if (s[p] === "(") depth2++;
                            else if (s[p] === ")") {
                                depth2--;
                                if (depth2 === 0) {
                                    p++;
                                    break;
                                }
                            }
                            p++;
                        }
                        cond2 = s.slice(n2 + 1, p - 1);
                        n2 = p;
                    }
                    n2 = skipWS(n2);
                    if (s[n2] !== "{") break;
                    let depth2 = 0,
                        p2 = n2;
                    while (p2 < s.length) {
                        if (s[p2] === "{") depth2++;
                        else if (s[p2] === "}") {
                            depth2--;
                            if (depth2 === 0) {
                                p2++;
                                break;
                            }
                        }
                        p2++;
                    }
                    const block2 = s.slice(n2 + 1, p2 - 1);
                    branches.push({
                        type: "ifbranch",
                        children: [
                            {
                                type: "kw",
                                value: kwLabel(next[0]),
                            },
                            ...(next[0].toLowerCase() === "else"
                                ? []
                                : [
                                      {
                                          type: "group",
                                          children: tokenizeFormula(cond2),
                                      },
                                  ]),
                            {
                                type: "group",
                                children: tokenizeFormula(block2),
                            },
                        ],
                    });
                    m = p2;
                }
                out.push({ type: "ifblock", children: branches });
                i = m;
                continue;
            }
            out.push({ type: "kw", value: kw.toLowerCase() });
            i += kw.length;
            continue;
        }
        const two = s.slice(i, i + 2);
        if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
            out.push({ type: "op", value: two });
            i += 2;
            continue;
        }
        if ("+-*/<>?:".includes(c)) {
            out.push({ type: "op", value: c });
            i++;
            continue;
        }
        if (c === "%") {
            const prev = out[out.length - 1];
            if (prev && prev.type === "num") prev.value += "%";
            i++;
            continue;
        }
        if (c === "(") {
            let depth = 0,
                j = i;
            while (j < s.length) {
                if (s[j] === "(") depth++;
                else if (s[j] === ")") {
                    depth--;
                    if (depth === 0) {
                        j++;
                        break;
                    }
                }
                j++;
            }
            const inner = s.slice(i + 1, j - 1);
            out.push({ type: "group", children: tokenizeFormula(inner) });
            i = j;
            continue;
        }
        if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
            let j = i;
            while (j < s.length && /[0-9.]/.test(s[j])) j++;
            out.push({ type: "num", value: s.slice(i, j) });
            i = j;
            continue;
        }
        if (isWord(c)) {
            let j = i;
            while (j < s.length && isWord(s[j])) j++;
            const word = s.slice(i, j);
            const k = skipWS(j);
            if (s[k] === "(") {
                let depth = 0,
                    m = k;
                while (m < s.length) {
                    if (s[m] === "(") depth++;
                    else if (s[m] === ")") {
                        depth--;
                        if (depth === 0) {
                            m++;
                            break;
                        }
                    }
                    m++;
                }
                const args = s.slice(k + 1, m - 1);
                out.push({ type: "func", value: word.toLowerCase() + "()" });
                out.push({ type: "group", children: tokenizeFormula(args) });
                i = m;
            } else {
                out.push({ type: "word", value: word });
                i = j;
            }
            continue;
        }
        i++;
    }
    return out;
}
function tokensToObjects(tokens) {
    const obj = {};
    let n = 1;
    for (const t of tokens || []) {
        if (
            t.type === "group" ||
            t.type === "ifblock" ||
            t.type === "ifbranch"
        ) {
            obj["object_" + n] = tokensToObjects(t.children || []);
        } else {
            obj["object_" + n] = t.value || "";
        }
        n++;
    }
    return obj;
}
function formulaToDSL(formula) {
    return tokensToObjects(tokenizeFormula(formula));
}
function dslToFormula(obj) {
    const vals = Object.values(obj || {});
    const firstStr = String(vals[0] || "");
    const kw = firstStr.trim().toLowerCase().replace(/\s+/g, " ");
    const branchShape =
        vals.length >= 2 &&
        vals.slice(1).every((v) => v && typeof v === "object");
    const branchKw = /^(if|elif|else\s*if)\(|^else\s*\{/;
    if (
        (branchShape &&
            /^(if|elif|else\s*if)$/.test(kw) &&
            vals.length === 3) ||
        (branchShape && kw === "else" && vals.length === 2)
    ) {
        if (kw === "else") {
            return "else { " + dslToFormula(vals[1]) + " }";
        }
        const head = kw === "elif" ? "else if" : kw;
        const body = vals
            .slice(2)
            .map((v) =>
                v && typeof v === "object" ? dslToFormula(v) : String(v),
            )
            .join(" ")
            .trim();
        return head + "(" + dslToFormula(vals[1]) + ") { " + body + " }";
    }
    if (/^(if|elif|else\s*if|else)\(?/.test(firstStr)) {
        let out = "",
            opened = false;
        for (const v of vals) {
            const s = String(v);
            if (/^(if|elif|else\s*if)\(/.test(s)) {
                out += s + " { ";
                opened = true;
            } else if (s === "else") {
                out += "else { ";
                opened = true;
            } else if (v && typeof v === "object") out += dslToFormula(v) + " ";
            else out += s + " ";
        }
        return out.trim() + (opened ? " }" : "");
    }
    if (
        vals.length &&
        vals.every((v) => v && typeof v === "object") &&
        branchKw.test(dslToFormula(vals[0]))
    ) {
        return vals.map((v) => dslToFormula(v)).join(" ");
    }
    if (
        vals.length === 1 &&
        vals[0] &&
        typeof vals[0] === "object" &&
        branchKw.test(dslToFormula(vals[0]))
    ) {
        return dslToFormula(vals[0]);
    }
    return vals
        .map((v) => {
            if (v && typeof v === "object") return "(" + dslToFormula(v) + ")";
            return String(v);
        })
        .join(" ");
}
function renderDSLObjects(b, obj, level) {
    const s = b.systems || {};
    const raw = [
        ...(b.definitions || []).map((d) => d.code),
        ...(s.stats || []).map((x) => x.code),
        ...(s.resources || []).map((x) => x.code),
    ];
    const codes = [...new Set(raw)].filter(Boolean);
    const rows = Object.entries(obj || {})
        .map(([key, val]) => {
            if (val && typeof val === "object") {
                return `<div class="dsl-sub"><div class="dsl-sub-head">${key}</div>${renderDSLObjects(b, val, level + 1)}</div>`;
            }
            const str = String(val);
            const isNum = /^-?[0-9.]+%?$/.test(str);
            const isStr = /^\{\{[\s\S]*\}\}$/.test(str);
            const opts = [];
            for (const c of codes) {
                opts.push(
                    `<option value="${esc(c)}" ${str === c ? "selected" : ""}>${esc(c)}</option>`,
                    `<option value="base.${esc(c)}" ${str === "base." + c ? "selected" : ""}>base.${esc(c)}</option>`,
                    `<option value="bonus.${esc(c)}" ${str === "bonus." + c ? "selected" : ""}>bonus.${esc(c)}</option>`,
                    `<option value="acalc.${esc(c)}" ${str === "acalc." + c ? "selected" : ""}>acalc.${esc(c)}</option>`,
                    `<option value="bcalc.${esc(c)}" ${str === "bcalc." + c ? "selected" : ""}>bcalc.${esc(c)}</option>`,
                    `<option value="current.${esc(c)}" ${str === "current." + c ? "selected" : ""}>current.${esc(c)}</option>`,
                    `<option value="max.${esc(c)}" ${str === "max." + c ? "selected" : ""}>max.${esc(c)}</option>`,
                );
            }
            const DSL_OPTS = [
                "+",
                "-",
                "*",
                "/",
                "==",
                "!=",
                "<",
                "<=",
                ">",
                ">=",
                "&&",
                "||",
                "?",
                ":",
                "sin()",
                "cos()",
                "tan()",
                "cot()",
                "square()",
                "root()",
                "abs()",
                "min()",
                "max()",
                "clamp()",
                "round()",
                "floor()",
                "ceil()",
                "pow()",
                "log()",
                "exp()",
                "mod()",
                "lerp()",
                "rand()",
                "chance()",
                "dice()",
                "coalesce()",
                "toInt()",
                "toFloat()",
                "if",
                "else if",
                "else",
                "time",
            ];
            for (const o of DSL_OPTS)
                opts.push(
                    `<option value="${esc(o)}" ${str === o ? "selected" : ""}>${esc(o)}</option>`,
                );
            const numOpt = `<option value="__num__" ${isNum ? "selected" : ""}>${tFn("creator.def.dsl_num", "Số...")}</option>`;
            if (isStr) {
                return `<div class="dsl-row"><span class="dsl-key">${key}</span><textarea class="dsl-str" data-dslkey="${key}" rows="1">${esc(str.slice(2, -2))}</textarea></div>`;
            }
            const hasExact = opts.some(
                (o) => o.indexOf(`value="${esc(str)}"`) !== -1,
            );
            const exactOpt = isNum
                ? ""
                : hasExact
                  ? ""
                  : `<option value="${esc(str)}" selected>${esc(str)}</option>`;
            return `<div class="dsl-row"><span class="dsl-key">${key}</span><select class="dsl-select" data-dslkey="${key}"><option value="">${tFn("creator.def.dsl_pick", "— Chọn —")}</option>${opts.join("")}${exactOpt}${numOpt}</select>${isNum ? `<input class="dsl-num" value="${esc(str)}" data-dslkey="${key}">` : ""}</div>`;
        })
        .join("");
    return `<div class="dsl-objects" data-level="${level}">${rows}</div>`;
}
function dslCalcHTML(b, x) {
    const defsMap = {};
    const baseMap = {};
    const s = b.systems || {};
    for (const st of s.stats || []) {
        if (!st.code) continue;
        defsMap[st.code] = st.formula || "";
        const dv =
            st.defaultValue != null ? String(st.defaultValue).trim() : "";
        if (dv !== "") {
            baseMap[st.code] = dv;
            baseMap["base." + st.code] = dv;
        }
        const mx = st.max != null ? String(st.max).trim() : "";
        if (mx !== "") baseMap["max." + st.code] = mx;
    }
    for (const rs of s.resources || []) {
        if (!rs.code) continue;
        defsMap[rs.code] = rs.regenFormula || "";
        const cv = rs.current != null ? String(rs.current).trim() : "";
        if (cv !== "") {
            baseMap[rs.code] = cv;
            baseMap["current." + rs.code] = cv;
        }
        const mx = rs.max != null ? String(rs.max).trim() : "";
        if (mx !== "") baseMap["max." + rs.code] = mx;
    }
    if (x && x.regenTime != null && String(x.regenTime).trim() !== "")
        baseMap["time"] = String(x.regenTime).trim();
    if (baseMap["time"] == null) baseMap["time"] = "1";
    return `<div class="dsl-calc" id="dslCalc" data-calcdefs="${esc(JSON.stringify(defsMap))}" data-calcbase="${esc(JSON.stringify(baseMap))}"><div class="dsl-calc-head"><strong>${tFn("creator.def.calc_title", "Bàn tính")}</strong><span class="muted">${tFn("creator.def.calc_hint", "Nhập số cho biến — acalc tự tính theo công thức")}</span></div><div class="dsl-calc-formula" id="dslCalcFormula"></div><div class="dsl-calc-vars" id="dslCalcVars"></div><div class="dsl-calc-result" id="dslCalcResult"></div></div>`;
}
function dslEditorHTML(b, kind, x) {
    const field = kind === "resources" ? "regenFormula" : "formula";
    const parsed = formulaToDSL(x[field]);
    return `<div class="def-dsl-editor"><div class="def-dsl-head"><h3>${esc(x.name || tFn("creator.noname", "Không tên"))}</h3><div class="meta"><span class="badge">${esc(x.code || "")}</span><span class="badge">${tFn("creator.def.dsl_title", "DSL")}</span></div></div><div class="def-dsl-body" id="dslBody" data-syskind="${esc(kind)}" data-sysid="${esc(x.id)}" data-sysfield="${esc(field)}">${renderDSLObjects(b, parsed, 1)}</div>${dslCalcHTML(b, x)}<div class="def-dsl-foot"><button class="btn small primary" id="dslRefresh" onclick="refreshDSL('${esc(kind)}','${esc(x.id)}')">${tFn("creator.def.dsl_refresh", "Làm mới")}</button></div></div>`;
}
function collectSystemFormulasInto(b, out) {
    const sys = b.systems || {};
    for (const st of sys.stats || []) {
        if (st.code && st.formula)
            out[st.code + ".formula"] = {
                formula: formulaToDSL(st.formula),
            };
    }
    for (const rs of sys.resources || []) {
        if (rs.code && rs.regenFormula)
            out[rs.code + ".regenFormula"] = {
                formula: formulaToDSL(rs.regenFormula),
            };
    }
}
const dslCalcValues = {};
function bindDslCalc() {
    const calc = $("#dslCalc");
    const box = $("#dslCalcVars");
    const body = $("#dslBody");
    if (!calc || !box || !body) return;
    let defs = {};
    try {
        defs = JSON.parse(calc.dataset.calcdefs || "{}");
    } catch (e) {
        defs = {};
    }
    let baseMap = {};
    try {
        baseMap = JSON.parse(calc.dataset.calcbase || "{}");
    } catch (e) {
        baseMap = {};
    }
    const defId = body.dataset.sysid;
    const run = () => {
        const out = $("#dslCalcResult");
        if (!out) return;
        const fBox = $("#dslCalcFormula");
        const formula = String((fBox && fBox.dataset.formula) || "");
        if (!formula) {
            out.textContent = "";
            out.classList.remove("err");
            return;
        }
        try {
            const tokens = dslCalcTokensOf(formula);
            const inputs = {};
            $$("#dslCalcVars input[data-calcvar]").forEach((i) => {
                const n = parseFloat(i.value);
                inputs[i.dataset.calcvar] = isFinite(n) ? n : 0;
            });
            const v = dslCalcRun(
                tokens,
                dslCalcEnvFor(tokens, inputs, defs, {}, new Set()),
            );
            const f = dslCalcFormat(v);
            out.textContent =
                "= " +
                (f === ""
                    ? tFn("creator.def.dsl_empty_formula", "(trống)")
                    : f);
            out.classList.remove("err");
        } catch (e) {
            out.textContent =
                (e && e.message) || tFn("creator.calc.err", "Lỗi tính toán");
            out.classList.add("err");
        }
    };
    const refresh = () => {
        const fBox = $("#dslCalcFormula");
        if (!fBox) return;
        const formula = dslToFormula(collectDSLFromDOM(body)).trim();
        fBox.dataset.formula = formula;
        fBox.innerHTML = formula
            ? `<code>${esc(formula)}</code>`
            : `<span class="muted">${tFn("creator.def.dsl_empty_formula", "(trống)")}</span>`;
        const tokens = formula ? dslCalcTokensOf(formula) : null;
        const refs = tokens ? dslCalcInputRefs(tokens, defs) : [];
        const saved = dslCalcValues[defId] || {};
        box.innerHTML = refs.length
            ? refs
                  .map((r) => {
                      let def = 0;
                      if (
                          baseMap[r] != null &&
                          String(baseMap[r]).trim() !== ""
                      )
                          def = baseMap[r];
                      else {
                          const bm = /^base\.(.*)$/.exec(r);
                          if (
                              bm &&
                              baseMap[bm[1]] != null &&
                              String(baseMap[bm[1]]).trim() !== ""
                          )
                              def = baseMap[bm[1]];
                      }
                      return `<label>${esc(r)}<input type="number" step="any" value="${esc(String(saved[r] ?? def))}" data-calcvar="${esc(r)}"></label>`;
                  })
                  .join("")
            : `<span class="muted">${tFn("creator.def.calc_no_vars", "Công thức không có biến — tính trực tiếp.")}</span>`;
        run();
    };
    $("#dslCalcVars")?.addEventListener("input", (e) => {
        const t = e.target;
        if (t && t.matches("input[data-calcvar]")) {
            dslCalcValues[defId] = dslCalcValues[defId] || {};
            dslCalcValues[defId][t.dataset.calcvar] = t.value;
            run();
        }
    });
    body.addEventListener("change", (e) => {
        refresh();
        const kind = body.dataset.syskind;
        const id = body.dataset.sysid;
        const field = body.dataset.sysfield;
        if (!kind || !id || !field) return;
        getBook(state.bookId).then((b2) => {
            const item = ((b2.systems || {})[kind] || []).find(
                (z) => z.id === id,
            );
            if (!item) return;
            item[field] = dslToFormula(collectDSLFromDOM(body));
            return putBook(b2);
        });
    });
    refresh();
}
function dslCalcTokensOf(src) {
    try {
        return tokenizeFormula(String(src || ""));
    } catch (e) {
        return null;
    }
}
function dslCalcInputRefs(tokens, defs) {
    const out = [];
    const seen = new Set();
    const codes = new Set();
    const walk = (list) => {
        for (const tk of list || []) {
            if (tk.type === "word") {
                const w = String(tk.value || "");
                if (/^acalc\./.test(w)) {
                    const code = w.slice(6);
                    if (!code || codes.has(code)) continue;
                    codes.add(code);
                    const f = String(defs[code] || "").trim();
                    if (f) walk(dslCalcTokensOf(f) || []);
                } else if (/^bcalc\./.test(w)) {
                    const expr = w.slice(6);
                    if (!expr || codes.has(expr)) continue;
                    codes.add(expr);
                    if (expr.startsWith("(") && expr.endsWith(")")) {
                        const innerExpr = expr.slice(1, -1);
                        const subTokens = dslCalcTokensOf(innerExpr);
                        if (subTokens) walk(subTokens);
                    } else {
                        const f = String(defs[expr] || "").trim();
                        if (f) walk(dslCalcTokensOf(f) || []);
                    }
                } else if (!/^(true|false)$/i.test(w) && !seen.has(w)) {
                    seen.add(w);
                    out.push(w);
                }
            } else if (tk.children) {
                walk(tk.children);
            }
        }
    };
    walk(tokens);
    return out;
}
function dslCalcEnvFor(tokens, inputs, defs, memo, stack) {
    const env = {};
    const walk = (list) => {
        for (const tk of list || []) {
            if (tk.type === "word") {
                const w = String(tk.value || "");
                if (w in env) continue;
                if (/^acalc\./.test(w)) {
                    const code = w.slice(6);
                    if (stack.has(code))
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.loop_acalc",
                                    "Vòng lặp acalc: {0}",
                                ),
                                code,
                            ),
                        );
                    if (memo[code] !== undefined) {
                        env[w] = memo[code];
                        continue;
                    }
                    const f = String(defs[code] ?? "").trim();
                    if (!(code in defs))
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.no_def",
                                    "{0}: không có định nghĩa",
                                ),
                                "acalc." + code,
                            ),
                        );
                    if (!f)
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.no_formula",
                                    "{0}: chưa có công thức",
                                ),
                                "acalc." + code,
                            ),
                        );
                    stack.add(code);
                    const subTokens = dslCalcTokensOf(f) || [];
                    let subEnv;
                    try {
                        subEnv = dslCalcEnvFor(
                            subTokens,
                            inputs,
                            defs,
                            memo,
                            stack,
                        );
                    } finally {
                        stack.delete(code);
                    }
                    for (const k of Object.keys(subEnv)) {
                        if (!(k in env)) env[k] = subEnv[k];
                    }
                    const v = dslCalcRun(subTokens, subEnv);
                    memo[code] = v;
                    env[w] = v;
                } else if (/^bcalc\./.test(w)) {
                    const expr = w.slice(6);
                    if (stack.has(expr))
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.loop_bcalc",
                                    "Vòng lặp bcalc: {0}",
                                ),
                                expr,
                            ),
                        );
                    if (memo[expr] !== undefined) {
                        env[w] = memo[expr];
                        continue;
                    }
                    let subTokens;
                    if (expr.startsWith("(") && expr.endsWith(")")) {
                        const innerExpr = expr.slice(1, -1);
                        subTokens = dslCalcTokensOf(innerExpr) || [];
                    } else {
                        const f = String(defs[expr] ?? "").trim();
                        if (!(expr in defs))
                            throw new Error(
                                fmt(
                                    tFn(
                                        "creator.dsl.no_def",
                                        "{0}: không có định nghĩa",
                                    ),
                                    "bcalc." + expr,
                                ),
                            );
                        if (!f)
                            throw new Error(
                                fmt(
                                    tFn(
                                        "creator.dsl.no_formula",
                                        "{0}: chưa có công thức",
                                    ),
                                    "bcalc." + expr,
                                ),
                            );
                        subTokens = dslCalcTokensOf(f) || [];
                    }
                    stack.add(expr);
                    let subEnv;
                    try {
                        subEnv = dslCalcEnvFor(
                            subTokens,
                            inputs,
                            defs,
                            memo,
                            stack,
                        );
                    } finally {
                        stack.delete(expr);
                    }
                    const v = dslCalcRun(subTokens, subEnv);
                    memo[expr] = v;
                    env[w] = v;
                } else {
                    if (!(w in inputs))
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.missing_var",
                                    "Chưa nhập số cho: {0}",
                                ),
                                w,
                            ),
                        );
                    env[w] = inputs[w];
                }
            } else if (tk.children) {
                walk(tk.children);
            }
        }
    };
    walk(tokens);
    return env;
}
function dslCalcEvalSeq(list, env) {
    const p = dslCalcMakeParser(list, env);
    const vals = [];
    while (!p.atEnd()) vals.push(p.parseExpr());
    return vals;
}
function dslCalcRun(tokens, env) {
    if (!tokens || !tokens.length)
        throw new Error(
            tFn("creator.dsl.no_expression", "Chưa có biểu thức để tính"),
        );
    const vals = dslCalcEvalSeq(tokens, env);
    if (vals.length !== 1)
        throw new Error(
            tFn("creator.dsl.invalid_expr", "Biểu thức không hợp lệ"),
        );
    return vals[0];
}
function dslCalcFormat(v) {
    const x = v !== null && typeof v === "object" && v.__pct ? v.n / 100 : v;
    if (typeof x === "number") {
        if (!isFinite(x)) return String(x);
        return String(Math.round(x * 1e6) / 1e6);
    }
    if (typeof x === "boolean") return x ? "true" : "false";
    return String(x ?? "");
}
function dslCalcApplyFunc(name, args) {
    const nums = args.map((v) =>
        v !== null && typeof v === "object" && v.__pct ? v.n / 100 : v,
    );
    const need = (i) => {
        if (typeof nums[i] !== "number" || !isFinite(nums[i]))
            throw new Error(
                fmt(
                    tFn(
                        "creator.dsl.bad_args",
                        "Hàm {0} cần tham số số hợp lệ",
                    ),
                    name,
                ),
            );
        return nums[i];
    };
    const rad = (d) => (d * Math.PI) / 180;
    if (name === "sin") return Math.sin(rad(need(0)));
    if (name === "cos") return Math.cos(rad(need(0)));
    if (name === "tan") return Math.tan(rad(need(0)));
    if (name === "cot") {
        const d = rad(need(0));
        const s = Math.sin(d);
        return s === 0 ? Infinity : Math.cos(d) / s;
    }
    if (name === "square") {
        const x = need(0);
        return x * x;
    }
    if (name === "root") return Math.sqrt(need(0));
    if (name === "abs") return Math.abs(need(0));
    if (name === "min")
        return Math.min(...nums.filter((x) => typeof x === "number"));
    if (name === "max")
        return Math.max(...nums.filter((x) => typeof x === "number"));
    if (name === "clamp") {
        const x = need(0);
        const lo = need(1);
        const hi = need(2);
        return Math.min(Math.max(x, lo), hi);
    }
    if (name === "round") return Math.round(need(0));
    if (name === "floor") return Math.floor(need(0));
    if (name === "ceil") return Math.ceil(need(0));
    if (name === "pow") return Math.pow(need(0), need(1));
    if (name === "log") return Math.log(need(0));
    if (name === "exp") return Math.exp(need(0));
    if (name === "mod") return need(0) % need(1);
    if (name === "lerp") {
        const a = need(0),
            b = need(1),
            t = need(2);
        return a + (b - a) * t;
    }
    if (name === "rand") {
        const lo = need(0),
            hi = need(1);
        return Math.random() * (hi - lo) + lo;
    }
    if (name === "chance") {
        const p = need(0);
        return Math.random() * 100 < p;
    }
    if (name === "dice") {
        const n = Math.max(1, Math.floor(need(0)));
        const d = Math.max(1, Math.floor(need(1)));
        let total = 0;
        for (let i = 0; i < n; i++) total += Math.floor(Math.random() * d) + 1;
        return total;
    }
    if (name === "coalesce") {
        const vals = args.map((v) => plain(v));
        for (const v of vals) {
            if (v !== null && v !== undefined && v !== "") return v;
        }
        return vals.length ? vals[0] : null;
    }
    if (name === "toInt") {
        const x = plain(args[0]);
        if (typeof x === "boolean") return x ? 1 : 0;
        return parseInt(x) || 0;
    }
    if (name === "toFloat") {
        const x = plain(args[0]);
        if (typeof x === "boolean") return x ? 1.0 : 0.0;
        return parseFloat(x) || 0;
    }
    throw new Error(
        fmt(tFn("creator.dsl.unsupported_fn", "Không hỗ trợ hàm: {0}"), name),
    );
}
function dslCalcMakeParser(tokens, env) {
    let pos = 0;
    const peek = () => tokens[pos];
    const advance = () => tokens[pos++];
    const isOp = (v) => {
        const t = peek();
        return !!t && t.type === "op" && t.value === v;
    };
    const isPct = (v) => v !== null && typeof v === "object" && !!v.__pct;
    const plain = (v) => (isPct(v) ? v.n / 100 : v);
    const truthy = (v) => {
        const x = plain(v);
        if (typeof x === "number") return x !== 0;
        if (typeof x === "boolean") return x;
        return String(x ?? "").trim().length > 0;
    };
    const needNum = (v) => {
        const x = plain(v);
        if (typeof x !== "number" || !isFinite(x))
            throw new Error(
                tFn("creator.dsl.need_number", "Cần giá trị số để tính"),
            );
        return x;
    };
    function parseExpr() {
        const cond = parseOr();
        if (isOp("?")) {
            advance();
            const a = parseExpr();
            if (!isOp(":"))
                throw new Error(
                    tFn(
                        "creator.dsl.missing_colon",
                        "Thiếu ':' trong phép ba ngôi",
                    ),
                );
            advance();
            const b = parseExpr();
            return truthy(cond) ? a : b;
        }
        return cond;
    }
    function parseOr() {
        let left = parseAnd();
        while (isOp("||")) {
            advance();
            const right = parseAnd();
            left = truthy(left) || truthy(right);
        }
        return left;
    }
    function parseAnd() {
        let left = parseEq();
        while (isOp("&&")) {
            advance();
            const right = parseEq();
            left = truthy(left) && truthy(right);
        }
        return left;
    }
    function parseEq() {
        let left = parseCmp();
        for (;;) {
            if (isOp("==") || isOp("!=")) {
                const op = advance().value;
                const right = parseCmp();
                const a = plain(left);
                const b = plain(right);
                const eq =
                    typeof a === "string" || typeof b === "string"
                        ? String(a) === String(b)
                        : a === b;
                left = op === "==" ? eq : !eq;
            } else break;
        }
        return left;
    }
    function parseCmp() {
        let left = parseAdd();
        for (;;) {
            if (isOp("<") || isOp("<=") || isOp(">") || isOp(">=")) {
                const op = advance().value;
                const right = parseAdd();
                const a = needNum(left);
                const b = needNum(right);
                left =
                    op === "<"
                        ? a < b
                        : op === "<="
                          ? a <= b
                          : op === ">"
                            ? a > b
                            : a >= b;
            } else break;
        }
        return left;
    }
    function parseAdd() {
        let left = parseMul();
        for (;;) {
            if (isOp("+") || isOp("-")) {
                const op = advance().value;
                const right = parseMul();
                if (isPct(right)) {
                    const base = needNum(left);
                    left =
                        op === "+"
                            ? base + (base * right.n) / 100
                            : base - (base * right.n) / 100;
                } else {
                    const a = plain(left);
                    const b = plain(right);
                    if (op === "+") {
                        left =
                            typeof a === "string" || typeof b === "string"
                                ? String(a) + String(b)
                                : a + b;
                    } else {
                        if (typeof a === "string" || typeof b === "string")
                            throw new Error(
                                tFn(
                                    "creator.dsl.no_string_sub",
                                    "Không trừ được chuỗi",
                                ),
                            );
                        left = a - b;
                    }
                }
            } else break;
        }
        return left;
    }
    function parseMul() {
        let left = parseUnary();
        for (;;) {
            if (isOp("*") || isOp("/")) {
                const op = advance().value;
                const right = parseUnary();
                const a = plain(left);
                const b = plain(right);
                if (typeof a === "string" || typeof b === "string")
                    throw new Error(
                        tFn(
                            "creator.dsl.no_string_mul_div",
                            "Không nhân/chia được chuỗi",
                        ),
                    );
                left = op === "*" ? a * b : a / b;
            } else break;
        }
        return left;
    }
    function parseUnary() {
        if (isOp("-")) {
            advance();
            const v = parseUnary();
            if (isPct(v)) return { __pct: true, n: -v.n };
            if (typeof v !== "number")
                throw new Error(
                    tFn("creator.dsl.need_num_minus", "Cần số sau '-'"),
                );
            return -v;
        }
        if (isOp("+")) {
            advance();
            return parseUnary();
        }
        return parsePrimary();
    }
    function parsePrimary() {
        const t = advance();
        if (!t)
            throw new Error(
                tFn(
                    "creator.dsl.missing_value",
                    "Thiếu giá trị trong biểu thức",
                ),
            );
        if (t.type === "num") {
            const raw = String(t.value);
            const n = parseFloat(raw);
            if (!isFinite(n))
                throw new Error(
                    fmt(
                        tFn(
                            "creator.dsl.invalid_number",
                            "Số không hợp lệ: {0}",
                        ),
                        raw,
                    ),
                );
            return raw.endsWith("%") ? { __pct: true, n } : n;
        }
        if (t.type === "str")
            return String(t.value || "")
                .replace(/^\{\{/, "")
                .replace(/\}\}$/, "");
        if (t.type === "word") {
            const w = String(t.value || "");
            if (/^true$/i.test(w)) return true;
            if (/^false$/i.test(w)) return false;
            if (!(w in env))
                throw new Error(
                    fmt(
                        tFn("creator.dsl.missing_var", "Chưa nhập số cho: {0}"),
                        w,
                    ),
                );
            return env[w];
        }
        if (t.type === "func") {
            const name = String(t.value || "").replace(/\(\)$/, "");
            const g = advance();
            if (!g || g.type !== "group")
                throw new Error(
                    fmt(
                        tFn(
                            "creator.dsl.fn_missing_args",
                            "Hàm {0} thiếu ( ) đối số",
                        ),
                        name,
                    ),
                );
            return dslCalcApplyFunc(name, dslCalcEvalSeq(g.children, env));
        }
        if (t.type === "group") {
            const vals = dslCalcEvalSeq(t.children, env);
            if (vals.length !== 1)
                throw new Error(
                    tFn("creator.dsl.invalid_group", "Nhóm ( ) không hợp lệ"),
                );
            return vals[0];
        }
        if (t.type === "ifblock") {
            for (const br of t.children || []) {
                const kids = br.children || [];
                const kwTk = kids.find((k) => k.type === "kw");
                const kwv = String((kwTk && kwTk.value) || "").toLowerCase();
                const groups = kids.filter((k) => k.type === "group");
                if (kwv === "else") {
                    if (!groups.length)
                        throw new Error(
                            tFn(
                                "creator.dsl.else_missing_block",
                                "Nhánh else thiếu khối { }",
                            ),
                        );
                    const vals = dslCalcEvalSeq(groups[0].children, env);
                    if (vals.length !== 1)
                        throw new Error(
                            tFn(
                                "creator.dsl.else_invalid",
                                "Nhánh else không hợp lệ",
                            ),
                        );
                    return vals[0];
                }
                if (!groups.length)
                    throw new Error(
                        fmt(
                            tFn(
                                "creator.dsl.branch_missing_cond",
                                "Nhánh {0} thiếu (điều kiện)",
                            ),
                            kwv,
                        ),
                    );
                const cond = dslCalcEvalSeq(groups[0].children, env);
                if (cond.length !== 1)
                    throw new Error(
                        tFn(
                            "creator.dsl.invalid_cond",
                            "Điều kiện không hợp lệ",
                        ),
                    );
                if (truthy(cond[0])) {
                    if (groups.length < 2)
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.branch_missing_block",
                                    "Nhánh {0} thiếu khối { }",
                                ),
                                kwv,
                            ),
                        );
                    const vals = dslCalcEvalSeq(groups[1].children, env);
                    if (vals.length !== 1)
                        throw new Error(
                            fmt(
                                tFn(
                                    "creator.dsl.branch_invalid",
                                    "Nhánh {0} không hợp lệ",
                                ),
                                kwv,
                            ),
                        );
                    return vals[0];
                }
            }
            return "";
        }
        throw new Error(
            tFn("creator.dsl.invalid_expr", "Biểu thức không hợp lệ"),
        );
    }
    return {
        parseExpr,
        atEnd: () => pos >= tokens.length,
    };
}
function collectDSLFromDOM(root) {
    const obj = {};
    let n = 1;
    for (const child of root.children) {
        if (child.classList.contains("dsl-sub")) {
            const subRoot = child.querySelector(".dsl-objects");
            if (subRoot) obj["object_" + n] = collectDSLFromDOM(subRoot);
        } else if (child.classList.contains("dsl-row")) {
            const strInput = child.querySelector(".dsl-str");
            const sel = child.querySelector(".dsl-select");
            const num = child.querySelector(".dsl-num");
            const v = strInput
                ? "{{" + strInput.value + "}}"
                : sel && sel.value === "__num__"
                  ? num
                      ? num.value
                      : ""
                  : sel
                    ? sel.value
                    : "";
            obj["object_" + n] = v;
        } else if (child.classList.contains("dsl-objects")) {
            Object.assign(obj, collectDSLFromDOM(child));
        }
        n++;
    }
    return obj;
}
function settingsSectionHTML(b) {
    const rows = [
        ["chapters", tFn("creator.tab.chapters", "Chương"), true],
        ["items", tFn("creator.tab.items", "Vật phẩm"), false],
        ["itemsets", tFn("creator.tab.itemsets", "Bộ vật phẩm"), false],
        ["characters", tFn("creator.tab.characters", "Nhân vật"), false],
        ["factions", tFn("creator.tab.factions", "Thế lực"), false],
        ["realms", tFn("creator.tab.realms", "Giới vực"), false],
        ["locations", tFn("creator.tab.locations", "Vị diện / Vùng"), false],
        [
            "abilities",
            tFn("creator.tab.abilities", "Năng lực / Kỹ năng"),
            false,
        ],
        ["skillsets", tFn("creator.tab.skillsets", "Bộ kỹ năng"), false],
        ["definitions", tFn("creator.tab.definitions", "Định nghĩa"), false],
        ["systems", tFn("creator.tab.systems", "Hệ thống / Stats"), false],
        ["relations", tFn("creator.tab.relations", "Mối quan hệ"), false],
        ["timeline", tFn("creator.sub.timeline", "Dòng thời gian"), false],
    ];
    const sysRows = [
        ["sysstats", tFn("creator.sys.tab_stats", "Stats"), false, true],
        [
            "sysresources",
            tFn("creator.sys.tab_resources", "Tài nguyên"),
            false,
            true,
        ],
        [
            "syscurrencies",
            tFn("creator.sys.tab_currencies", "Tiền tệ"),
            false,
            true,
        ],
        [
            "syseffects",
            tFn("creator.sys.tab_effects", "Effects / Statuses"),
            false,
            true,
        ],
        [
            "sysquests",
            tFn("creator.sys.tab_quests", "Quests / Missions"),
            false,
            true,
        ],
        [
            "syscombat",
            tFn("creator.sys.tab_combat", "Combat Stats"),
            false,
            true,
        ],
    ];
    const ds = b.displaySettings || {};
    const sysDetailsOpen =
        localStorage.getItem("creator-settings-sys-open") === "1";
    const seg = (k, t, fixed, child, group) => {
        const lockedByParent = child && ds.systems === "hidden";
        const disabled = fixed || lockedByParent;
        const chevron = group
            ? `<span class="settings-marker" aria-hidden="true">${
                  sysDetailsOpen ? "▾" : "▸"
              }</span>`
            : "";
        const btns = `<button type="button" class="seg-btn ${
            fixed || (!lockedByParent && ds[k] !== "hidden") ? "active" : ""
        }" data-display="${k}" data-val="visible" ${
            disabled ? "disabled" : ""
        } onclick="event.stopPropagation()">${tFn("creator.settings.visible", "Hiển thị")}</button><button type="button" class="seg-btn ${
            !fixed && !lockedByParent && ds[k] === "hidden" ? "active" : ""
        }" data-display="${k}" data-val="hidden" ${
            disabled ? "disabled" : ""
        } onclick="event.stopPropagation()">${tFn("creator.settings.hidden", "Ẩn")}</button>`;
        const lock = fixed
            ? `<span class="settings-lock">${tFn(
                  "creator.settings.locked",
                  "Luôn hiển thị",
              )}</span>`
            : lockedByParent
              ? `<span class="settings-lock">${tFn(
                    "creator.settings.child_locked",
                    "Bật Hệ thống / Stats để tùy chỉnh",
                )}</span>`
              : "";
        return `<span class="settings-label">${chevron}${esc(
            t,
        )}</span><div class="seg">${btns}</div>${lock}`;
    };

    return `<div class="card"><h2>${tFn(
        "creator.settings.title",
        "Cài đặt hiển thị",
    )}</h2><p class="muted">${tFn(
        "creator.settings.sub",
        "Chọn phần nào hiển thị trong tab của truyện. Chương luôn hiển thị.",
    )}</p><div class="settings-list">${rows
        .map(([k, t, fixed, child]) => {
            if (k !== "systems") {
                return `<div class="settings-row${
                    child ? " settings-child" : ""
                }">${seg(k, t, fixed, child, false)}</div>`;
            }
            const summary = `<summary class="settings-row settings-parent">${seg(
                k,
                t,
                fixed,
                child,
                true,
            )}</summary>`;
            const children = `<div class="settings-group">${sysRows
                .map(
                    (r) =>
                        `<div class="settings-row settings-child">${seg(
                            r[0],
                            r[1],
                            r[2],
                            r[3],
                            false,
                        )}</div>`,
                )
                .join("")}</div>`;
            return `<details class="settings-details" id="sysSettingsDetails" ${
                sysDetailsOpen ? "open" : ""
            }>${summary}${children}</details>`;
        })
        .join("")}</div></div>`;
}
function exportHTML(b) {
    return `<div class="card"><h2>${tFn("creator.tab.export", "Xuất truyện")}</h2><p class="muted">${tFn("creator.exp.sub", "Các định dạng được tạo ngay trên máy. Không cần upload dữ liệu lên server.")}</p><div class="grid cards"><div class="card"><h3>${tFn("creator.exp.epub_title", "EPUB")}</h3><p class="muted">${tFn("creator.exp.epub_desc", "EPUB 3, chứa metadata, bìa và toàn bộ chương.")}</p><button class="btn primary" data-export="epub">${tFn("creator.exp.epub_btn", "Xuất EPUB")}</button></div><div class="card"><h3>${tFn("creator.exp.txt_title", "TXT")}</h3><p class="muted">${tFn("creator.exp.txt_desc", "Văn bản thuần, dễ backup và xử lý tiếp.")}</p><button class="btn primary" data-export="txt">${tFn("creator.exp.txt_btn", "Xuất TXT")}</button></div><div class="card"><h3>${tFn("creator.exp.kindle_title", "Kindle")}</h3><p class="muted">${tFn("creator.exp.kindle_desc", "Xuất EPUB tối ưu để đưa vào hệ sinh thái Kindle/Send to Kindle.")}</p><button class="btn primary" data-export="kindle">${tFn("creator.exp.kindle_btn", "Xuất Kindle EPUB")}</button></div></div><hr style="border:0;border-top:1px solid #e5e7eb;margin:25px 0"><h3>${tFn("creator.exp.backup_title", "Backup dữ liệu")}</h3><p class="muted">${tFn("creator.exp.backup_desc", "File JSON chứa toàn bộ truyện và worldbuilding. Có thể dùng để backup/khôi phục.")}</p><input id="importCreator" type="file" accept=".creator,application/zip" hidden><input id="importJson" type="file" accept=".json,application/json" hidden><button class="btn secondary" data-export="creator">${tFn("creator.exp.creator_btn", "Export .creator")}</button><button class="btn secondary" id="importCreatorBtn">${tFn("creator.exp.creator_import", "Import .creator")}</button></div>`;
}
const dslRefresh = $("#dslRefresh");

function refreshDSL(kind, id) {
    if (!kind || !id) return;

    delete dslCalcValues[id];

    state.systemDslId = null;
    saveState();

    renderWithTransition("#manageBody");

    requestAnimationFrame(() => {
        const target = document.querySelector(
            `[data-sysselect="${CSS.escape(id)}"]`,
        );

        if (!target) return;

        state.systemDslId = id;
        saveState();
        renderWithTransition("#manageBody");
    });
}
function gotoBack() {
    if (state.view === "manage") {
        setView("dashboard");
        return;
    }
    const target = state.returnTo === "manage" ? "manage" : "dashboard";
    const bookId = target === "manage" ? state.bookId : null;
    setView(target, bookId);
    saveState();
}
function updateGenreButtons() {
    const input = $('#bookForm input[name="genres"]');
    if (!input) return;
    const vals = input.value
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
    $$(".genre-toggle").forEach((btn) => {
        btn.classList.toggle("active", vals.includes(btn.dataset.genre));
    });
}

function bindPage() {
    ["#dashImportCreator", "#importCreator", "#importJson"].forEach((selector) => {
        const input = $(selector);
        if (!input) return;
        input.addEventListener("click", async (event) => {
            if (!window.CapacitorFileBridge?.canPick()) return;
            event.preventDefault();
            let file;
            try {
                file = await window.CapacitorFileBridge.pickFile({
                    types:
                        input.accept === ".json,application/json"
                            ? ["application/json"]
                            : ["application/zip", "application/octet-stream"],
                    name:
                        input.accept === ".json,application/json"
                            ? "book.json"
                            : "book.creator",
                });
            } catch (error) {
                alert(
                    tFn(
                        "creator.toast.import_fail",
                        "Import thất bại: ",
                    ) + error.message,
                );
                return;
            }
            if (!file) return;
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
    $("#dashImportBtn")?.addEventListener("click", () =>
        $("#dashImportCreator")?.click(),
    );
    $("#dashImportCreator")?.addEventListener("change", importCreator);
    $("#createBtn")?.addEventListener("click", () => {
        state.returnTo = "dashboard";
        setView("create");
    });
    $$("[data-open]").forEach(
        (x) =>
            (x.onclick = () => {
                setView("manage", x.dataset.open);
                saveState();
            }),
    );
    $$("[data-open-card]").forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            setView("manage", card.dataset.openCard);
            saveState();
        });
    });
    $$("[data-edit]").forEach(
        (x) =>
            (x.onclick = async () => {
                const book = await getBook(x.dataset.edit);

                state.bookId = book.id;
                state.returnTo = "dashboard";
                state.view = "create";
                saveState();
                $("#content").innerHTML = bookFormHTML(book);
                updateGenreButtons();
                bindPage();
            }),
    );
    $$("[data-delete]").forEach(
        (x) => (x.onclick = () => removeBook(x.dataset.delete)),
    );
    $("#editBook")?.addEventListener("click", async () => {
        const b = await getBook(state.bookId);
        state.returnTo = "manage";
        state.view = "create";
        saveState();
        $("#content").innerHTML = bookFormHTML(b);
        updateGenreButtons();
        bindPage();
    });
    $("#deleteCurrent")?.addEventListener("click", () =>
        removeBook(state.bookId),
    );
    $$("[data-tab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.tab === x.dataset.tab) return;
                state.tab = x.dataset.tab;
                state.systemDslId = null;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    const sysDetails = document.getElementById("sysSettingsDetails");
    if (sysDetails) {
        sysDetails.addEventListener("toggle", () => {
            localStorage.setItem(
                "creator-settings-sys-open",
                sysDetails.open ? "1" : "0",
            );
            const marker = sysDetails.querySelector(".settings-marker");
            if (marker) marker.textContent = sysDetails.open ? "▾" : "▸";
        });
    }
    $$("[data-display]").forEach(
        (x) =>
            (x.onclick = () => {
                getBook(state.bookId).then((b) => {
                    b.displaySettings = b.displaySettings || {};
                    b.displaySettings[x.dataset.display] = x.dataset.val;
                    return putBook(b).then(() => {
                        toast(tFn("creator.toast.saved", "Đã lưu"));
                        render();
                    });
                });
            }),
    );
    $$("[data-chaptertab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.chapterTab === x.dataset.chaptertab) return;
                state.chapterTab = x.dataset.chaptertab;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-reltab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.relTab === x.dataset.reltab) return;
                state.relTab = x.dataset.reltab;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-abilitytab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.abilityTab === x.dataset.abilitytab) return;
                state.abilityTab = x.dataset.abilitytab;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-realmtab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.realmTab === x.dataset.realmtab) return;
                state.realmTab = x.dataset.realmtab;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-systab]").forEach(
        (x) =>
            (x.onclick = () => {
                if (state.systemsTab === x.dataset.systab) return;
                state.systemsTab = x.dataset.systab;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-add]").forEach(
        (x) => (x.onclick = () => openEntityModal(x.dataset.add)),
    );
    $$("[data-sysgoto]").forEach(
        (x) =>
            (x.onclick = () => {
                state.systemsTab = x.dataset.sysgoto;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    $$("[data-sysadd]").forEach(
        (x) => (x.onclick = () => openSysModal(x.dataset.sysadd)),
    );
    $$("[data-sysedit]").forEach(
        (x) =>
            (x.onclick = () => openSysModal(x.dataset.sysedit, x.dataset.id)),
    );
    $$("[data-sysdel]").forEach(
        (x) =>
            (x.onclick = () =>
                removeSystemItem(x.dataset.sysdel, x.dataset.id)),
    );
    $$("[data-cbadd]").forEach(
        (x) => (x.onclick = () => openCbStatSelector(x.dataset.cbadd)),
    );
    $$(".sys-dyn-list[data-cbg]").forEach((list) => {
        const catId = list.dataset.cbg;
        list.addEventListener("change", async (e) => {
            const row = e.target.closest(".sys-dyn-row");
            if (!row) return;
            const idx = Array.prototype.indexOf.call(list.children, row);
            const b = await getBook(state.bookId);
            if (!b) return;
            const cat = (b.systems.combat || []).find(
                (c) => c && c.id === catId,
            );
            if (!cat) return;
            cat.stats = cat.stats || [];
            const r = cat.stats[idx] || (cat.stats[idx] = {});
            if (e.target.matches("select")) r.statId = e.target.value;
            if (e.target.matches("input")) r.note = e.target.value;
            await putBook(b);
            toast(tFn("creator.toast.saved", "Đã lưu"));
        });
    });
    $$("[data-cbdel]").forEach(
        (x) =>
            (x.onclick = async () => {
                const row = x.closest(".sys-dyn-row");
                const list = x.closest(".sys-dyn-list[data-cbg]");
                if (!row || !list) return;
                const idx = Array.prototype.indexOf.call(list.children, row);
                const b = await getBook(state.bookId);
                if (!b) return;
                const cat = (b.systems.combat || []).find(
                    (c) => c && c.id === list.dataset.cbg,
                );
                if (!cat) return;
                (cat.stats || []).splice(idx, 1);
                await putBook(b);
                toast(tFn("creator.toast.deleted", "Đã xóa"));
                render();
            }),
    );
    $$("[data-sysselect]").forEach(
        (x) =>
            (x.onclick = (e) => {
                if (e.target.closest("button")) return;
                if (e.target.closest(".drag-handle")) return;
                if (state.systemDslId === x.dataset.sysselect) return;
                const previousId = state.systemDslId;

                if (previousId && previousId !== x.dataset.sysselect) {
                    delete dslCalcValues[previousId];
                }

                state.systemDslId = x.dataset.sysselect;
                saveState();
                renderWithTransition("#manageBody");
            }),
    );
    bindDslCalc();
    $$("[data-editentity]").forEach(
        (x) =>
            (x.onclick = () =>
                openEntityModal(x.dataset.editentity, x.dataset.id)),
    );
    $$("[data-delentity]").forEach(
        (x) =>
            (x.onclick = () => removeEntity(x.dataset.delentity, x.dataset.id)),
    );
    $$("[data-viewchapter]").forEach(
        (x) => (x.onclick = () => openChapterView(x.dataset.viewchapter)),
    );
    bindDragReorder();
    $$("[data-entsearch]").forEach((inp) => {
        inp.addEventListener("input", () => {
            const q = inp.value.trim().toLowerCase();
            const terms = q ? q.split(/\s+/) : [];
            const root =
                (inp.closest(".toolbar") &&
                    inp.closest(".toolbar").parentElement) ||
                document;
            const rows = root.querySelectorAll("[data-entrow]");
            let visible = 0;
            rows.forEach((r) => {
                const hay = (r.dataset.search || "").toLowerCase();
                const hit = terms.every((t) => hay.includes(t));
                r.hidden = !hit;
                if (hit) visible++;
            });
            const nm = root.querySelector(".ent-nomatch");
            if (nm) nm.hidden = visible > 0;
        });
    });
    $("#deleteSelectedChapters")?.addEventListener(
        "click",
        deleteSelectedChapters,
    );
    $("#chkAll")?.addEventListener("change", (e) => {
        $$("#manageBody input[data-chk]").forEach(
            (c) => (c.checked = e.target.checked),
        );
        updateChapterDeleteUi();
    });
    $$("#manageBody input[data-chk]").forEach((c) =>
        c.addEventListener("change", () => {
            const all = $$("#manageBody input[data-chk]");
            const head = $("#chkAll");
            if (head) {
                head.checked = all.length > 0 && all.every((x) => x.checked);
                head.indeterminate =
                    !head.checked && all.some((x) => x.checked);
            }
            updateChapterDeleteUi();
        }),
    );

    const collapseCards = $$(".entity-card.collapsible");
    const closeOtherCollapseCards = (activeCard) => {
        collapseCards.forEach((other) => {
            if (other === activeCard) return;
            other.classList.remove("pinned");
            other.classList.remove("open");
        });
    };

    const inDragDeadZone = (card, ev) => {
        const handle = card.querySelector(".entity-head > .drag-handle");
        if (!handle || typeof ev.clientX !== "number") return false;
        const cardRect = card.getBoundingClientRect();
        const handleRect = handle.getBoundingClientRect();
        if (ev.clientY < cardRect.top || ev.clientY > cardRect.bottom)
            return false;
        return ev.clientX >= cardRect.left && ev.clientX <= handleRect.right;
    };

    collapseCards.forEach((card) => {
        const openHoverCard = () => {
            closeOtherCollapseCards(card);
            if (!card.classList.contains("pinned")) card.classList.add("open");
        };
        const syncHover = (ev) => {
            if (inDragDeadZone(card, ev)) {
                if (!card.classList.contains("pinned"))
                    card.classList.remove("open");
                return;
            }
            if (!card.classList.contains("open")) openHoverCard();
        };
        card.addEventListener("mouseenter", syncHover);
        card.addEventListener("mousemove", syncHover);
        card.addEventListener("mouseleave", () => {
            if (!card.classList.contains("pinned"))
                card.classList.remove("open");
        });
        card.addEventListener("click", (e) => {
            if (e.target.closest("button, a, input, textarea, select, label"))
                return;
            if (inDragDeadZone(card, e)) return;
            if (e.target.closest(".drag-handle")) return;
            const willPin = !card.classList.contains("pinned");
            closeOtherCollapseCards(card);
            card.classList.toggle("pinned", willPin);
            card.classList.toggle("open", willPin);
        });
    });
    $$("[data-export]").forEach(
        (x) => (x.onclick = () => exportBook(x.dataset.export)),
    );
    $("#bookForm")?.addEventListener("submit", saveBookForm);
    $("#cancelForm")?.addEventListener("click", () => gotoBack());
    $$(".genre-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
            const input = $('#bookForm input[name="genres"]');
            if (!input) return;
            const vals = input.value
                .split(/[,;]/)
                .map((x) => x.trim())
                .filter(Boolean);
            const g = btn.dataset.genre;
            const idx = vals.indexOf(g);
            if (idx >= 0) vals.splice(idx, 1);
            else vals.push(g);
            input.value = vals.join(", ");
            btn.classList.toggle("active", vals.includes(g));
        });
    });
    $("#backBtn")?.addEventListener("click", gotoBack);
    $("#coverInput")?.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            $("#coverPreview").src = r.result;
            $("#coverPreview").style.display = "block";
            $("#coverEmpty").style.display = "none";
            $("#bookForm").dataset.cover = r.result;
        };
        r.readAsDataURL(f);
    });
    $("#removeCover")?.addEventListener("click", () => {
        $("#bookForm").dataset.cover = "";
        $("#coverPreview").style.display = "none";
        $("#coverEmpty").style.display = "grid";
    });
    $("#addArc") && ($("#addArc").onclick = () => openArcModal());
    $("#addTimeline") &&
        ($("#addTimeline").onclick = () => openTimelineModal());
    $$("[data-editarc]").forEach(
        (x) => (x.onclick = () => openArcModal(x.dataset.editarc)),
    );
    $$("[data-delarc]").forEach(
        (x) => (x.onclick = () => deleteArc(x.dataset.delarc)),
    );
    $$("[data-addchild]").forEach(
        (x) =>
            (x.onclick = () =>
                openArcChildPicker(x.dataset.id, x.dataset.addchild)),
    );
    $$("[data-unlinkchild]").forEach(
        (x) =>
            (x.onclick = () =>
                unlinkArcChild(x.dataset.unlinkchild, x.dataset.ref)),
    );
    $$("[data-addtimeline]").forEach(
        (x) =>
            (x.onclick = () =>
                openTimelineModal(null, {
                    kind: "arc",
                    ref: x.dataset.addtimeline,
                })),
    );
    $$("[data-edittimeline]").forEach(
        (x) => (x.onclick = () => openTimelineModal(x.dataset.edittimeline)),
    );
    $$("[data-deltimeline]").forEach(
        (x) => (x.onclick = () => deleteTimeline(x.dataset.deltimeline)),
    );
    $$("[data-export]").forEach((x) => {
        if (x.dataset.export === "creator") {
            x.onclick = () => exportCreator();
        } else {
            x.onclick = () => exportBook(x.dataset.export);
        }
    });
    $("#importCreatorBtn")?.addEventListener("click", () =>
        $("#importCreator").click(),
    );
    $("#importCreator")?.addEventListener("change", importCreator);
    $("#importJsonBtn")?.addEventListener("click", () =>
        $("#importJson").click(),
    );
    $("#importJson")?.addEventListener("change", importJSON);
    updateGenreButtons();
}
async function saveBookForm(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    let b = state.bookId ? await getBook(state.bookId) : defaultBook();
    b.id = f.get("id");
    b.title = f.get("title").trim();
    b.description = f.get("description").trim();
    b.genres = f
        .get("genres")
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
    if ("cover" in e.target.dataset) b.cover = e.target.dataset.cover;
    await putBook(b);
    state.bookId = b.id;
    state.view = "manage";
    state.tab = "chapters";
    saveState();
    toast(tFn("creator.toast.saved_book", "Đã lưu truyện"));
    render();
}
async function removeBook(id) {
    const b = await getBook(id);
    if (
        !b ||
        !confirm(
            fmt(
                tFn(
                    "creator.confirm.book",
                    'Xóa truyện "{0}" cùng toàn bộ dữ liệu?',
                ),
                b.title,
            ),
        )
    )
        return;
    await deleteBook(id);
    if (state.bookId === id) {
        state.bookId = null;
        state.view = "dashboard";
        state.tab = "chapters";
        saveState();
    }
    toast(tFn("creator.toast.deleted_book", "Đã xóa truyện"));
    render();
}
function bindComboboxes(root) {
    root.querySelectorAll("[data-combobox]").forEach((combo) => {
        const input = combo.querySelector(".combo-input");
        const toggle = combo.querySelector(".combo-toggle");
        const dropdown = combo.querySelector(".combo-dropdown");
        const hidden = combo.querySelector("input[type=hidden]");
        const closeDropdown = () => dropdown.classList.remove("show");
        const openDropdown = () => {
            dropdown.classList.add("show");
            dropdown.querySelectorAll(".combo-option").forEach((opt) => {
                opt.style.display = "";
            });
        };
        toggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropdown.classList.contains("show")) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        input.addEventListener("click", () => {
            openDropdown();
        });
        input.addEventListener("input", () => {
            const val = input.value.toLowerCase();
            let matched = null;
            dropdown.querySelectorAll(".combo-option").forEach((opt) => {
                opt.style.display = opt.textContent.toLowerCase().includes(val)
                    ? ""
                    : "none";
                if (
                    matched === null &&
                    input.value &&
                    (opt.textContent === input.value ||
                        opt.dataset.value === input.value)
                ) {
                    matched = opt.dataset.value;
                }
            });
            if (hidden) hidden.value = matched !== null ? matched : input.value;
            dropdown.classList.add("show");
        });
        dropdown.addEventListener("click", (e) => {
            const opt = e.target.closest(".combo-option");
            if (opt) {
                input.value = opt.textContent;
                if (hidden) {
                    hidden.value = opt.dataset.value;
                    hidden.dispatchEvent(
                        new Event("change", { bubbles: true }),
                    );
                }
                closeDropdown();
                input.focus();
            }
        });
        document.addEventListener("click", (e) => {
            if (!combo.contains(e.target)) {
                closeDropdown();
            }
        });
    });
}
async function openSysModal(kind, id = null) {
    const b = await getBook(state.bookId);
    if (!b) return;
    b.systems = b.systems || {};
    if (!Array.isArray(b.systems[kind])) b.systems[kind] = [];
    const x = id
        ? b.systems[kind].find((it) => it.id === id) || {}
        : { id: uid() };
    const m = $("#modal");
    const title = tFn("creator.sys.tab_" + kind, kind);
    const formHTML =
        kind === "quests"
            ? questFormHTML(x, b)
            : kind === "effects"
              ? effectFormHTML(x, b)
              : kind === "combat"
                ? combatFormHTML(x, b)
                : sysFormHTML(kind, x, b);
    m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${x.name ? tFn("creator.modal.edit", "Chỉnh sửa") : tFn("creator.modal.add", "Thêm")} ${esc(title)}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><form id="sysForm" class="form">${formHTML}<div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="sysDescription">${esc(x.description || "")}</textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form></div></div>`;
    bindComboboxes(m);
    if (kind === "quests") bindQuestDynRows(m);
    if (kind === "combat") bindCombatFormRows(m, b);
    m.showModal();
    $("#sysForm").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const val = (k) => String(fd.get(k) ?? "").trim();
        const numv = (k) => {
            const v = val(k);
            return v === "" ? "" : Number(v);
        };
        const defIdByCode = (code) => {
            if (!code) return "";
            const d = (b.definitions || []).find((dd) => dd.code === code);
            return d ? d.id : "";
        };
        let obj;
        if (kind === "stats") {
            const dup = (b.systems.stats || []).find(
                (it) =>
                    it.id !== x.id && val("code") && it.code === val("code"),
            );
            if (dup) {
                alert(
                    tFn(
                        "creator.sys.code_dup",
                        "Code stat đã tồn tại! Hãy dùng mã khác.",
                    ),
                );
                return;
            }
            obj = {
                name: val("name"),
                code: val("code"),
                type: val("type"),
                dataType: val("dataType") || "number",
                unit: val("unit"),
                defaultValue: val("defaultValue"),
                min: numv("min"),
                max: numv("max"),
                formula: val("formula"),
                useFormula: !!fd.get("useFormula"),
                baseDefId: defIdByCode(val("baseDefId")),
                bonusDefId: defIdByCode(val("bonusDefId")),
                scope: val("scope") || "global",
            };
        } else if (kind === "resources") {
            obj = {
                name: val("name"),
                code: val("code"),
                max: val("max"),
                current: val("current"),
                regen: val("regen"),
                regenUnit: val("regenUnit") || "sec",
                regenTime: numv("regenTime"),
                useRegenFormula: !!fd.get("useRegenFormula"),
                regenFormula: val("regenFormula"),
                baseDefId: defIdByCode(val("baseDefId")),
            };
        } else if (kind === "effects") {
            const dup = (b.systems.effects || []).find(
                (it) =>
                    it.id !== x.id && val("code") && it.code === val("code"),
            );
            if (dup) {
                alert(
                    tFn(
                        "creator.effect.code_dup",
                        "Code effect đã tồn tại! Hãy dùng mã khác.",
                    ),
                );
                return;
            }
            obj = {
                name: val("name"),
                code: val("code"),
                type: val("type") || "buff",
                target: val("target") || "self",
                description: val("sysDescription"),
                tags: val("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
            };
        } else if (kind === "quests") {
            const dup = (b.systems.quests || []).find(
                (it) =>
                    it.id !== x.id && val("code") && it.code === val("code"),
            );
            if (dup) {
                alert(
                    tFn(
                        "creator.quest.code_dup",
                        "Code quest đã tồn tại! Hãy dùng mã khác.",
                    ),
                );
                return;
            }
            const qtype = val("type");
            obj = {
                name: val("name"),
                code: val("code"),
                type:
                    qtype === "custom"
                        ? val("typeCustom") || "custom"
                        : qtype || "main",
                giver: val("giver"),
                factionId: val("factionId"),
                characterId: val("characterId"),
                location: val("location"),
                priority: val("priority") || "normal",
            };
        } else if (kind === "combat") {
            obj = {
                name: val("name"),
                tags: val("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                stats: [...e.target.querySelectorAll("[data-cbrow]")]
                    .map((row) => ({
                        statId:
                            (row.querySelector("[data-cbstat]") || {}).value ||
                            "",
                        note: (
                            (row.querySelector("[data-cbnote]") || {}).value ||
                            ""
                        ).trim(),
                    }))
                    .filter((r) => r.statId),
            };
        } else {
            obj = {
                name: val("name"),
                code: val("code"),
                value: val("value"),
                symbol: val("symbol"),
                baseDefId: defIdByCode(val("baseDefId")),
            };
        }
        obj.description = val("sysDescription");
        if (kind === "stats")
            obj.tags = val("tags")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
        obj.updatedAt = now();
        const list = b.systems[kind];
        const idx = list.findIndex((it) => it.id === x.id);
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], obj);
        else list.push(Object.assign({ id: x.id, createdAt: now() }, obj));
        await putBook(b);
        m.close();
        toast(tFn("creator.toast.saved", "Đã lưu"));
        render();
        saveState();
    };
}
async function removeSystemItem(kind, id) {
    if (!confirm(tFn("creator.confirm.entity", "Xóa mục này?"))) return;
    const b = await getBook(state.bookId);
    if (!b) return;
    b.systems = b.systems || {};
    if (Array.isArray(b.systems[kind]))
        b.systems[kind] = b.systems[kind].filter((it) => it.id !== id);
    if (state.systemDslId === id) {
        state.systemDslId = null;
        saveState();
    }
    if (Array.isArray(b.systems.combat)) {
        for (const cat of b.systems.combat)
            if (cat && Array.isArray(cat.stats))
                cat.stats = cat.stats.filter((r) => r && r.statId !== id);
    }
    await putBook(b);
    toast(tFn("creator.toast.deleted", "Đã xóa"));
    render();
}
function openEntityModal(type, id = null) {
    if (String(type || "").startsWith("sys:")) {
        openSysModal(type.slice(4), id);
        return;
    }
    if (type === "relation") {
        openRelationDialog(id);
        return;
    }
    getBook(state.bookId).then((b) => {
        const key = entityKey(type);
        b[key] = b[key] || [];
        let item = id ? b[key].find((x) => x.id === id) : null;
        let html = entityForm(type, item, b);
        if (ILLU_TYPES.includes(type)) {
            const sec = illuSectionHTML(item);
            const fi = html.indexOf('<div class="modal-foot">');
            if (fi >= 0) html = html.slice(0, fi) + sec + html.slice(fi);
        }
        const m = $("#modal");
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${item ? tFn("creator.modal.edit", "Chỉnh sửa") : tFn("creator.modal.add", "Thêm")} ${typeLabel(type)}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body">${html}</div></div>`;
        m.showModal();

        const relCloseBtn = m.querySelector(".modal-head .icon-btn");
        if (relCloseBtn)
            relCloseBtn.onclick = () => {
                relDraft = null;
                m.close();
            };

        m.querySelectorAll("[data-dynadd]").forEach((btn) => {
            btn.onclick = () => {
                const kind = btn.dataset.dynadd;
                let rowHTML = "";
                if (kind === "skills") rowHTML = skillPickRowHTML(b);
                else if (kind === "charfactions")
                    rowHTML = charFactionRowHTML(b);
                else if (kind === "ranks") rowHTML = rankRowHTML();
                else if (kind === "realmpicks") rowHTML = realmPickRowHTML(b);
                else if (kind === "factionpicks")
                    rowHTML = factionPickRowHTML(b);
                else if (kind === "skillsets") rowHTML = skillsetPickRowHTML(b);
                else if (kind === "charabilities")
                    rowHTML = abilityPickRowHTML(b);
                else if (kind === "items") rowHTML = itemPickRowHTML(b);
                else if (kind === "owners") rowHTML = ownerPickRowHTML(b);
                else if (kind === "itemsetpicks")
                    rowHTML = itemsetPickRowHTML(b);
                else if (kind === "visitedrealms")
                    rowHTML = realmPickRowHTML(b, "", "charVisitedRealmIds");
                else if (kind === "realmcharacters")
                    rowHTML = characterPickRowHTML(b);
                else if (kind === "locconnected")
                    rowHTML = locationPickRowHTML(
                        b,
                        "",
                        "locConnectedIds",
                        (item && item.id) || "",
                    );
                else if (kind === "loccharacters")
                    rowHTML = characterPickRowHTML(b, "", "locCharacterIds");
                else if (kind === "locfactions")
                    rowHTML = factionPickRowHTML(b, "", "locFactionIds");
                else if (kind === "locitems")
                    rowHTML = itemPickRowHTML(b, {}, "locItemIds");
                else if (kind === "locquests") rowHTML = questPickRowHTML(b);
                else if (kind === "locevents")
                    rowHTML = timelinePickRowHTML(b, "", "locEventIds");
                else if (kind === "loctimeline")
                    rowHTML = timelinePickRowHTML(b, "", "locTimelineIds");
                else if (kind === "loccf") rowHTML = locCustomFieldRowHTML();
                if (rowHTML) btn.insertAdjacentHTML("beforebegin", rowHTML);
                const list = btn.closest(".dyn-list");
                if (list) {
                    const rows = list.querySelectorAll(".dyn-row");
                    (rows[rows.length - 1] || list)
                        .querySelector("input, select")
                        ?.focus();
                }
            };
        });
        $("#entityForm").onclick = (e) => {
            const rm = e.target.closest("[data-dynremove]");
            if (rm) rm.closest(".dyn-row").remove();
        };
        $("#entityForm").addEventListener("change", (e) => {
            if (e.target.matches('select[name="skillIds"]')) {
                const h = e.target.parentElement?.querySelector(
                    'input[name="skill_legacy"]',
                );
                if (h) h.value = "";
            }
        });
        bindComboboxes(m);
        m.querySelectorAll(".ability-row").forEach((row) => {
            const abilitySelect = row.querySelector(".ability-select");
            const chapterSelect = row.querySelector("[data-chapter-select]");
            const statusInput = row.querySelector("[data-status-input]");
            const addBtn = row.querySelector(".ability-add-status");
            const statusesList = row.querySelector("[data-statuses-list]");
            const aid = abilitySelect?.value || "";
            const addHiddenInput = (name, value) => {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = name;
                input.value = value;
                row.appendChild(input);
            };
            const addStatus = () => {
                const chapterId = chapterSelect?.value;
                const status = statusInput?.value?.trim();
                if (!aid || !chapterId || !status) return;
                const existingRow = statusesList.querySelector(
                    `[data-chapter="${chapterId}"]`,
                );
                if (existingRow) {
                    existingRow.querySelector(
                        ".ability-status-value",
                    ).textContent = status;
                    const existingChapterInput = row.querySelector(
                        `input[name="abilityStatus_${aid}_chapter"][value="${chapterId}"]`,
                    );
                    if (existingChapterInput) {
                        const idx = Array.from(
                            row.querySelectorAll(
                                `input[name="abilityStatus_${aid}_chapter"]`,
                            ),
                        ).indexOf(existingChapterInput);
                        const statusInputs = row.querySelectorAll(
                            `input[name="abilityStatus_${aid}_status"]`,
                        );
                        if (statusInputs[idx]) statusInputs[idx].value = status;
                    }
                } else {
                    const chapterOption = chapterSelect.querySelector(
                        `option[value="${chapterId}"]`,
                    );
                    const chapterLabel =
                        chapterOption?.textContent || chapterId;
                    const statusRow = document.createElement("div");
                    statusRow.className = "ability-status-row";
                    statusRow.dataset.chapter = chapterId;
                    statusRow.innerHTML = `<span class="ability-status-chapter">${esc(chapterLabel)}</span><span class="ability-status-value">${esc(status)}</span><button type="button" class="btn small danger ability-status-remove" data-chapter="${chapterId}">×</button>`;
                    statusesList.appendChild(statusRow);
                    addHiddenInput(`abilityStatus_${aid}_chapter`, chapterId);
                    addHiddenInput(`abilityStatus_${aid}_status`, status);
                }
                if (statusInput) statusInput.value = "";
            };
            addBtn?.addEventListener("click", addStatus);
            statusInput?.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addStatus();
                }
            });
            statusesList?.addEventListener("click", (e) => {
                const removeBtn = e.target.closest(".ability-status-remove");
                if (removeBtn) {
                    const chapterId = removeBtn.dataset.chapter;
                    removeBtn.closest(".ability-status-row").remove();
                    const chapterInput = row.querySelector(
                        `input[name="abilityStatus_${aid}_chapter"][value="${chapterId}"]`,
                    );
                    if (chapterInput) {
                        const idx = Array.from(
                            row.querySelectorAll(
                                `input[name="abilityStatus_${aid}_chapter"]`,
                            ),
                        ).indexOf(chapterInput);
                        chapterInput.remove();
                        const statusInputs = row.querySelectorAll(
                            `input[name="abilityStatus_${aid}_status"]`,
                        );
                        if (statusInputs[idx]) statusInputs[idx].remove();
                    }
                }
            });
        });
        if (ILLU_TYPES.includes(type)) {
            m.querySelectorAll("[data-illupick]").forEach(
                (btn) =>
                    (btn.onclick = () => {
                        const box = btn.closest(".illu-box");
                        const inp =
                            box && box.querySelector("input[data-illu]");
                        if (inp) {
                            inp.value = "";
                            inp.click();
                        }
                    }),
            );
            m.querySelectorAll("input[data-illu]").forEach((inp) => {
                inp.addEventListener("change", () => {
                    const f = inp.files && inp.files[0];
                    if (!f) return;
                    const box = inp.closest(".illu-box");
                    const store = box.querySelector(
                        `input[name="illu_${inp.dataset.illu}"]`,
                    );
                    const r = new FileReader();
                    r.onload = () => {
                        if (store) store.value = r.result;
                        const img = box.querySelector("img.illu-img");
                        const ph = box.querySelector(".illu-empty");
                        if (img) {
                            img.src = r.result;
                            img.style.display = "block";
                        }
                        if (ph) ph.style.display = "none";
                    };
                    r.readAsDataURL(f);
                });
            });
            m.querySelectorAll("[data-illuremove]").forEach(
                (btn) =>
                    (btn.onclick = () => {
                        const box = btn.closest(".illu-box");
                        if (!box) return;
                        const store = box.querySelector(
                            `input[name="illu_${btn.dataset.illuremove}"]`,
                        );
                        const img = box.querySelector("img.illu-img");
                        const ph = box.querySelector(".illu-empty");
                        if (store) store.value = "";
                        if (img) {
                            img.removeAttribute("src");
                            img.style.display = "none";
                        }
                        if (ph) ph.style.display = "";
                    }),
            );
        }

        const scopeSel = m.querySelector('select[name="rule_scope"]');
        if (scopeSel) {
            const estWrap = m.querySelector("#ruleEstablisherWrap");
            const toggleEst = () => {
                if (estWrap)
                    estWrap.style.display = scopeSel.value.startsWith(
                        "faction:",
                    )
                        ? ""
                        : "none";
            };
            scopeSel.onchange = toggleEst;
            toggleEst();
        }
        $("#entityForm").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const x = item || { id: uid(), createdAt: now() };
            if (type === "chapter") {
                x.number = Number(fd.get("number"));
                x.title = fd.get("title").trim();
                x.content = fd.get("content");
                x.notes = fd.get("notes");
            } else if (type === "relation") {
                x.from = fd.get("from").trim();
                x.to = fd.get("to").trim();
                x.type = fd.get("rtype").trim();
                x.description = fd.get("description").trim();
            } else if (type === "character") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.age = (fd.get("age") || "").trim();
                x.firstChapterId = fd.get("firstChapterId") || "";
                x.hobbies = (fd.get("hobbies") || "")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.factions = fd
                    .getAll("cf_faction")
                    .map((factionId, i) => ({
                        factionId,
                        role: (fd.getAll("cf_role")[i] || "").trim(),
                    }))
                    .filter((m) => m.factionId);
                const abilityIdsRaw = fd
                    .getAll("charAbilityIds")
                    .filter(Boolean);
                x.abilityIds = abilityIdsRaw.map((aid) => {
                    const chapterStatuses = {};
                    fd.getAll(`abilityStatus_${aid}_chapter`).forEach(
                        (chapterId, i) => {
                            if (chapterId) {
                                const status =
                                    fd.getAll(`abilityStatus_${aid}_status`)[
                                        i
                                    ] || "";
                                if (status.trim()) {
                                    chapterStatuses[chapterId] = status.trim();
                                }
                            }
                        },
                    );
                    return { abilityId: aid, chapterStatuses };
                });
                x.homeRealmId = fd.get("homeRealmId") || "";
                x.visitedRealmIds = fd
                    .getAll("charVisitedRealmIds")
                    .filter(Boolean);
            } else if (type === "faction") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.ranks = fd
                    .getAll("rank_name")
                    .map((name, i) => ({
                        name: (name || "").trim(),
                        description: (fd.getAll("rank_desc")[i] || "").trim(),
                    }))
                    .filter((r) => r.name);
                x.realmIds = fd.getAll("realmIds").filter(Boolean);
            } else if (type === "skillset") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.skills = skillsOfForm(fd, b);

                for (const a of b.abilities || []) {
                    a.skillsetIds = (a.skillsetIds || []).filter(
                        (sid) => sid !== x.id,
                    );
                    if ((x.skills || []).some((s) => s.abilityId === a.id))
                        a.skillsetIds.push(x.id);
                }
            } else if (type === "realm") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.factionIds = fd.getAll("factionIds").filter(Boolean);

                const ids = new Set(x.factionIds);
                for (const f of b.factions || []) {
                    f.realmIds = (f.realmIds || []).filter(
                        (rid) => rid !== x.id,
                    );
                    if (ids.has(f.id)) f.realmIds.push(x.id);
                }

                const wantChars = new Set(
                    fd.getAll("realmCharacterIds").filter(Boolean),
                );
                for (const c of b.characters || []) {
                    if (c.homeRealmId === x.id && !wantChars.has(c.id))
                        c.homeRealmId = "";
                    if (wantChars.has(c.id) && c.homeRealmId !== x.id)
                        c.homeRealmId = x.id;
                }
            } else if (type === "ability") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.skillsetIds = fd.getAll("abilitySkillsetIds").filter(Boolean);
                const wantSS = new Set(x.skillsetIds);
                for (const ss of b.skillsets || []) {
                    ss.skills = (ss.skills || []).filter(
                        (s) => !(s.abilityId === x.id),
                    );
                    if (wantSS.has(ss.id)) ss.skills.push({ abilityId: x.id });
                }
            } else if (type === "item") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.ownerIds = fd.getAll("ownerIds").filter(Boolean);
                x.itemsetIds = fd.getAll("itemItemsetIds").filter(Boolean);
                const wantIS = new Set(x.itemsetIds);
                for (const iset of b.itemsets || []) {
                    iset.items = (iset.items || []).filter(
                        (s) => !(s.itemId === x.id),
                    );
                    if (wantIS.has(iset.id)) iset.items.push({ itemId: x.id });
                }
            } else if (type === "itemset") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                x.items = fd
                    .getAll("itemIds")
                    .filter(Boolean)
                    .map((id) => ({ itemId: id }));
                const wantItems = new Set(x.items.map((s) => s.itemId));
                for (const it of b.items || []) {
                    it.itemsetIds = (it.itemsetIds || []).filter(
                        (sid) => sid !== x.id,
                    );
                    if (wantItems.has(it.id)) it.itemsetIds.push(x.id);
                }
            } else if (type === "rule") {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.punishment = (fd.get("punishment") || "").trim();
                const sv = String(fd.get("rule_scope") || "");
                const ci = sv.indexOf(":");
                x.scopeType = ci > 0 ? sv.slice(0, ci) : "";
                x.scopeId = ci > 0 ? sv.slice(ci + 1) : "";
                x.establisherId =
                    x.scopeType === "faction"
                        ? fd.get("rule_establisher") || ""
                        : "";
            } else if (type === "definition") {
                x.name = fd.get("name").trim();
                x.code = (fd.get("code") || "").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                const dup = (b.definitions || []).find(
                    (d) => d.id !== x.id && d.code === x.code,
                );
                if (dup) {
                    alert(
                        tFn(
                            "creator.def.code_dup",
                            "Mã định nghĩa đã tồn tại! Hãy dùng mã khác.",
                        ),
                    );
                    return;
                }
            } else if (type === "location") {
                x.name = fd.get("name").trim();
                x.code = (fd.get("code") || "").trim();
                x.type = (fd.get("type") || "").trim();
                x.parentLocationId = fd.get("parentLocationId") || "";
                if (x.parentLocationId === x.id) x.parentLocationId = "";
                x.description = fd.get("description").trim();
                x.rules = (fd.get("rules") || "").trim();
                x.connectedLocationIds = fd
                    .getAll("locConnectedIds")
                    .filter((id) => id && id !== x.id);
                x.characterIds = fd.getAll("locCharacterIds").filter(Boolean);
                x.factionIds = fd.getAll("locFactionIds").filter(Boolean);
                x.itemIds = fd.getAll("locItemIds").filter(Boolean);
                x.questIds = fd.getAll("locQuestIds").filter(Boolean);
                x.eventIds = fd.getAll("locEventIds").filter(Boolean);
                x.timelineEventIds = fd
                    .getAll("locTimelineIds")
                    .filter(Boolean);
                x.customFields = fd
                    .getAll("cf_key")
                    .map((k, i) => ({
                        key: (k || "").trim(),
                        value: (fd.getAll("cf_value")[i] || "").trim(),
                    }))
                    .filter((f) => f.key);

                if (x.parentLocationId) {
                    let cur = x.parentLocationId;
                    const seen = new Set([x.id]);
                    while (cur) {
                        if (seen.has(cur)) {
                            x.parentLocationId = "";
                            break;
                        }
                        seen.add(cur);
                        const par = (b.locations || []).find(
                            (z) => z.id === cur,
                        );
                        cur = par ? par.parentLocationId : "";
                    }
                }
            } else {
                x.name = fd.get("name").trim();
                x.description = fd.get("description").trim();
                x.tags = fd
                    .get("tags")
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
            }
            if (ILLU_TYPES.includes(type))
                x.illustration = {
                    icon: (fd.get("illu_icon") || "").trim(),
                    portrait: (fd.get("illu_portrait") || "").trim(),
                };
            x.updatedAt = now();
            if (!item) b[key].push(x);
            await putBook(b);
            m.close();
            toast(tFn("creator.toast.saved", "Đã lưu"));
            render();
            saveState();

            if (relDraft) {
                const d = relDraft;
                relDraft = null;
                openRelationDialog(d.id, d.from, d.to, d.scope, d);
            }
        };
    });
}
function typeLabel(t) {
    return (
        {
            chapter: tFn("creator.type.chapter", "chương"),
            item: tFn("creator.type.item", "vật phẩm"),
            character: tFn("creator.type.character", "nhân vật"),
            faction: tFn("creator.type.faction", "thế lực"),
            ability: tFn("creator.type.ability", "năng lực / kỹ năng"),
            skillset: tFn("creator.type.skillset", "bộ kỹ năng / sức mạnh"),
            itemset: tFn("creator.type.itemset", "bộ vật phẩm"),
            realm: tFn("creator.type.realm", "giới vực"),
            location: tFn("creator.type.location", "vị diện / vùng"),
            rule: tFn("creator.type.rule", "luật lệ / quy tắc"),
            definition: tFn("creator.type.definition", "định nghĩa"),
            relation: tFn("creator.type.relation", "mối quan hệ"),
        }[t] || t
    );
}
function dynRemoveBtn() {
    return `<button type="button" class="btn small danger" data-dynremove title="${tFn("creator.arc.unlink", "Gỡ")}">×</button>`;
}
function skillPickRowHTML(b, k = {}) {
    const abilities = Array.isArray(b.abilities) ? b.abilities : [];

    const obj = k && typeof k === "object" ? k : { name: k || "" };
    let sel = obj.abilityId || "";

    if (!sel && k.name) {
        const found = abilities.find(
            (a) => String(a.name || "").trim() === String(k.name).trim(),
        );
        sel = found?.id || "";
    }

    const legacyName = !sel && obj.name ? obj.name : "";
    const opts = abilities
        .map((a) => {
            const id = String(a.id);
            const name = a.name || tFn("creator.noname", "Không tên");

            return `<option value="${esc(id)}" ${
                String(sel) === id ? "selected" : ""
            }>${esc(name)}</option>`;
        })
        .join("");

    return `
        <div class="dyn-row dyn-row-single">
            <select name="skillIds">
                <option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>
                ${opts}
            </select>
            ${legacyName ? `<span class="badge" title="${tFn("creator.f.skill_legacy_note", "Kỹ năng cũ chưa khớp với Năng lực / Kỹ năng đã tạo")}">${esc(legacyName)}</span>` : ""}<input type="hidden" name="skill_legacy" value="${esc(legacyName)}"> ${dynRemoveBtn()}
        </div>
    `;
}
function realmPickRowHTML(b, rid = "", name = "realmIds") {
    const opts = (b.realms || [])
        .map(
            (r) =>
                `<option value="${r.id}" ${rid === r.id ? "selected" : ""}>${esc(r.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function factionPickRowHTML(b, fid = "", name = "factionIds") {
    const opts = (b.factions || [])
        .map(
            (f) =>
                `<option value="${f.id}" ${fid === f.id ? "selected" : ""}>${esc(f.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function characterPickRowHTML(b, cid = "", name = "realmCharacterIds") {
    const opts = (b.characters || [])
        .map(
            (c) =>
                `<option value="${c.id}" ${cid === c.id ? "selected" : ""}>${esc(c.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function locationPickRowHTML(
    b,
    lid = "",
    name = "locConnectedIds",
    excludeId = "",
) {
    const opts = (b.locations || [])
        .filter((z) => z.id !== excludeId)
        .map(
            (z) =>
                `<option value="${z.id}" ${lid === z.id ? "selected" : ""}>${esc(z.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function locCustomFieldRowHTML(f = {}) {
    return `<div class="dyn-row"><input name="cf_key" value="${esc(f.key || "")}" placeholder="${tFn("creator.f.loc_cf_key_ph", "Key")}"><input name="cf_value" value="${esc(f.value || "")}" placeholder="${tFn("creator.f.loc_cf_value_ph", "Value")}">${dynRemoveBtn()}</div>`;
}
function questPickRowHTML(b, qid = "", name = "locQuestIds") {
    const opts = ((b.systems || {}).quests || [])
        .map(
            (z) =>
                `<option value="${z.id}" ${qid === z.id ? "selected" : ""}>${esc(z.name || z.code || z.id || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function timelinePickRowHTML(b, tid = "", name = "locTimelineIds") {
    const opts = (b.timeline || [])
        .map(
            (t) =>
                `<option value="${t.id}" ${tid === t.id ? "selected" : ""}>${esc(
                    `${t.time || "—"} · ${t.text || t.id || tFn("creator.noname", "Không tên")}`,
                )}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function rankRowHTML(r = {}) {
    return `<div class="dyn-row"><input name="rank_name" value="${esc(r.name || "")}" placeholder="${tFn("creator.f.rank_name_ph", "Tên chức vụ / cấp bậc")}"><input name="rank_desc" value="${esc(r.description || "")}" placeholder="${tFn("creator.f.rank_desc_ph", "Mô tả chức vụ / cấp bậc")}">${dynRemoveBtn()}</div>`;
}
function charFactionRowHTML(b, m = {}) {
    const opts = (b.factions || [])
        .map(
            (f) =>
                `<option value="${f.id}" ${m.factionId === f.id ? "selected" : ""}>${esc(f.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row"><select name="cf_faction"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select><input name="cf_role" value="${esc(m.role || "")}" placeholder="${tFn("creator.f.faction_role_ph", "Chức vụ / vai trò trong thế lực")}">${dynRemoveBtn()}</div>`;
}
function skillsetPickRowHTML(b, sid = "") {
    const opts = (b.skillsets || [])
        .map(
            (ss) =>
                `<option value="${ss.id}" ${sid === ss.id ? "selected" : ""}>${esc(ss.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="abilitySkillsetIds"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function abilityPickRowHTML(b, item = {}) {
    const aid = item.abilityId || "";
    const chapterStatuses = item.chapterStatuses || {};
    const opts = (b.abilities || [])
        .map(
            (a) =>
                `<option value="${a.id}" ${aid === a.id ? "selected" : ""}>${esc(a.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    const chapterOpts = (b.chapters || [])
        .sort((a, z) => a.number - z.number)
        .map(
            (c) =>
                `<option value="${c.id}">${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}${c.title ? ": " + esc(c.title) : ""}</option>`,
        )
        .join("");
    const statusRows = Object.entries(chapterStatuses)
        .map(([chapterId, status]) => {
            const chapter = (b.chapters || []).find((c) => c.id === chapterId);
            const chapterLabel = chapter
                ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${chapter.number}${chapter.title ? ": " + esc(chapter.title) : ""}`
                : chapterId;
            return `<div class="ability-status-row" data-chapter="${chapterId}"><span class="ability-status-chapter">${esc(chapterLabel)}</span><span class="ability-status-value">${esc(status)}</span><button type="button" class="btn small danger ability-status-remove" data-chapter="${chapterId}">×</button></div>`;
        })
        .join("");
    return `<div class="dyn-row ability-row"><div class="ability-row-main"><select name="charAbilityIds" class="ability-select"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select><div class="ability-chapter-add"><select class="ability-chapter-select" data-chapter-select><option value="">${tFn("creator.f.first_chapter_none", "— Chưa rõ —")}</option>${chapterOpts}</select><input type="text" class="ability-status-input" data-status-input placeholder="${tFn("creator.f.ability_status_ph", "Trạng thái...")}"><button type="button" class="btn small secondary ability-add-status">${tFn("creator.f.ability_add_status", "＋ Thêm")}</button></div></div><div class="ability-statuses-list" data-statuses-list>${statusRows}</div>${dynRemoveBtn()}</div>`;
}
function itemPickRowHTML(b, it = {}, name = "itemIds") {
    const sel = it.itemId || "";
    const opts = (b.items || [])
        .map(
            (i) =>
                `<option value="${i.id}" ${sel === i.id ? "selected" : ""}>${esc(i.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="${esc(name)}"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function ownerPickRowHTML(b, cid = "") {
    const opts = (b.characters || [])
        .map(
            (c) =>
                `<option value="${c.id}" ${cid === c.id ? "selected" : ""}>${esc(c.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="ownerIds"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function itemsetPickRowHTML(b, sid = "") {
    const opts = (b.itemsets || [])
        .map(
            (ss) =>
                `<option value="${ss.id}" ${sid === ss.id ? "selected" : ""}>${esc(ss.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    return `<div class="dyn-row dyn-row-single"><select name="itemItemsetIds"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${opts}</select>${dynRemoveBtn()}</div>`;
}
function skillsOfForm(fd, b) {
    b.abilities = b.abilities || [];
    const picked = fd.getAll("skillIds").filter(Boolean);
    const legacy = fd.getAll("skill_legacy").filter(Boolean);
    const existing = new Set(b.abilities.map((a) => (a && a.id) || ""));
    const skills = [];
    for (const id of picked)
        if (existing.has(id)) skills.push({ abilityId: id });
    for (const raw of legacy) {
        const nm = String(raw || "").trim();
        if (!nm) continue;
        let ab = b.abilities.find(
            (a) =>
                a &&
                String(a.name || "")
                    .trim()
                    .toLowerCase() === nm.toLowerCase(),
        );
        if (!ab) {
            ab = {
                id: uid(),
                name: nm,
                description: "",
                tags: [],
                createdAt: now(),
                updatedAt: now(),
            };
            b.abilities.push(ab);
        }
        skills.push({ abilityId: ab.id });
    }
    return skills;
}
function defFormulaGuideHTML(extra) {
    const base = tFn(
        "creator.f.def_formula_guide",
        `<details class="def-guide" open><summary>📘 Cách dùng công thức định nghĩa</summary><div class="def-guide-body"><p>Công thức dùng để tính <b>giá trị cuối cùng</b> của mã định nghĩa này. Viết biểu thức theo các quy tắc dưới đây:</p><div class="def-guide-block"><div class="def-guide-h">1 · Tham chiếu định nghĩa khác</div><p>Gõ tên mã (ví dụ <code>atk</code>) để lấy giá trị cuối của định nghĩa đó. Thêm tiền tố để lấy từng tầng:</p><ul><li><code>code</code> — giá trị cuối cùng của <code>code</code></li><li><code>base.code</code> — chỉ tầng gốc (base)</li><li><code>bonus.code</code> — chỉ tầng cộng thêm (bonus)</li><li><code>acalc.code</code> — chỉ tầng tính toán phụ (acalc)</li></ul></div><div class="def-guide-block"><div class="def-guide-h">2 · Phép tính &amp; so sánh</div><p><code>+ - * /</code> — cộng, trừ, nhân, chia; <code>%</code> — phần trăm (vd: <code>+ 50%</code>). So sánh: <code>== != &lt; &lt;= &gt; &gt;=</code>; kết hợp điều kiện bằng <code>&amp;&amp;</code> (và) / <code>||</code> (hoặc).</p></div><div class="def-guide-block"><div class="def-guide-h">3 · Rẽ nhánh</div><p>Ba ngôi: <code>điều kiện ? đúng : sai</code>. Khối điều kiện: <code>if(điều kiện) { ... } else { ... }</code>; thêm nhánh bằng <code>elif(...)</code> hoặc <code>else if(...)</code>.</p></div><div class="def-guide-block"><div class="def-guide-h">4 · Hàm hỗ trợ</div><ul><li><code>sin() cos() tan() cot()</code> — lượng giác</li><li><code>square() root() abs()</code> — bình phương, căn bậc hai, trị tuyệt đối</li><li><code>min() max() clamp(x, min, max)</code> — nhỏ nhất, lớn nhất, giới hạn trong khoảng</li><li><code>round() floor() ceil()</code> — làm tròn</li></ul></div><div class="def-guide-block"><div class="def-guide-h">5 · Ví dụ</div><ul><li><code>hp → base.hp + bonus.hp</code></li><li><code>dmg → (base.atk * 1.5 + bonus.atk) * (crit ? 2 : 1)</code></li><li><code>def2 → max(base.def, acalc.def) + 100</code></li><li><code>status → if(base.mp &gt;= 50) { "Đủ linh lực" } else { "Thiếu linh lực" }</code></li></ul></div></div></details>`,
    );
    if (!extra) return base;
    return base.replace("</details>", extra + "</details>");
}
function illuOf(x) {
    const ill = x && typeof x === "object" ? x.illustration : null;
    return {
        icon: ill && typeof ill.icon === "string" ? ill.icon : "",
        portrait: ill && typeof ill.portrait === "string" ? ill.portrait : "",
    };
}
function illuFieldHTML(v, kind, label) {
    const cls = kind === "portrait" ? " illu-portrait" : "";
    return `<div class="illu-box"><label>${esc(label)}</label><img class="illu-img${cls}" src="${esc(v || "")}" alt="" ${v ? "" : 'style="display:none"'}><div class="illu-img illu-empty${cls}" ${v ? 'style="display:none"' : ""}>${tFn("creator.f.illu_none", "Chưa có ảnh")}</div><input type="hidden" name="illu_${kind}" value="${esc(v || "")}"><input type="file" accept="image/*" data-illu="${kind}" hidden><div class="actions"><button type="button" class="btn small secondary" data-illupick="${kind}">${tFn("creator.f.illu_pick", "Chọn ảnh...")}</button><button type="button" class="btn small ghost" data-illuremove="${kind}">${tFn("creator.f.illu_remove", "Bỏ ảnh")}</button></div></div>`;
}
function illuSectionHTML(x) {
    const ill = illuOf(x);
    return `<div class="field"><label>${tFn("creator.f.illu", "Ảnh minh hoạ")}</label><div class="illu-row">${illuFieldHTML(ill.icon, "icon", tFn("creator.f.illu_icon", "Icon (ảnh vuông)"))}${illuFieldHTML(ill.portrait, "portrait", tFn("creator.f.illu_portrait", "Ảnh dọc (tỉ lệ 9:16)"))}</div><div class="muted" style="font-size:12px">${tFn("creator.f.illu_hint", "Icon dùng ảnh vuông; ảnh minh hoạ nên theo tỉ lệ dọc 9:16. Ảnh được lưu trực tiếp trong dữ liệu truyện.")}</div></div>`;
}
function illuBodyHTML(x) {
    const ill = illuOf(x);
    const icon = ill.icon
        ? `<img class="illu-thumb-icon" src="${esc(ill.icon)}" alt="">`
        : "";
    const port = ill.portrait
        ? `<img class="illu-thumb-portrait" src="${esc(ill.portrait)}" alt="">`
        : "";
    return icon || port ? `<div class="illu-cards">${icon}${port}</div>` : "";
}
function entRowShell(x, name, tagList, type, id) {
    const ill = illuOf(x);
    const src = ill.icon || ill.portrait;
    const initial =
        esc(
            String(name || "")
                .trim()
                .charAt(0)
                .toUpperCase(),
        ) || "?";
    const search = esc(
        String((name || "") + " " + (tagList || []).join(" ")).toLowerCase(),
    );
    const ico = src
        ? `<span class="ent-ico"><img src="${esc(src)}" alt=""></span>`
        : `<span class="ent-ico"><span class="ent-ico-ph">${initial}</span></span>`;
    return {
        open: `<div class="card entity-card collapsible ent-row" data-entrow data-search="${search}"><div class="entity-head">${ico}<div class="ent-main"><h3>${esc(name || tFn("creator.noname", "Không tên"))}</h3>`,
        actions: `<div class="actions ent-actions"><button class="btn small secondary" data-editentity="${type}" data-id="${id}">${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-delentity="${type}" data-id="${id}">${tFn("creator.ch.delete", "Xóa")}</button></div>`,
    };
}
function locationFormHTML(x, b) {
    x = x || {};
    const selfId = x.id || "";
    const ds = b.displaySettings || {};
    const hideChars = dsHidden(ds, "characters");
    const hideFactions = dsHidden(ds, "factions");
    const hideItems = dsHidden(ds, "items");
    const hideQuests = dsHidden(ds, "quests");
    const hideTimeline = dsHidden(ds, "timeline");
    const locOpts = (b.locations || [])
        .filter((z) => z.id !== selfId)
        .map(
            (z) =>
                `<option value="${z.id}" ${x.parentLocationId === z.id ? "selected" : ""}>${esc(z.name || tFn("creator.noname", "Không tên"))}</option>`,
        )
        .join("");
    const connected = (b.locations || []).some((z) => z.id !== selfId)
        ? `<div class="dyn-list" data-dynlist="locconnected">${(
              x.connectedLocationIds || []
          )
              .map((lid) =>
                  locationPickRowHTML(b, lid, "locConnectedIds", selfId),
              )
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="locconnected">${tFn("creator.f.add_loc_connected", "＋ Thêm vị diện liên kết")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_none_hint", "Chưa có vị diện nào — hãy thêm ở tab Vị diện.")}</div>`;
    const characters = (b.characters || []).length
        ? `<div class="dyn-list" data-dynlist="loccharacters">${(
              x.characterIds || []
          )
              .map((cid) => characterPickRowHTML(b, cid, "locCharacterIds"))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="loccharacters">${tFn("creator.f.add_loc_character", "＋ Thêm nhân vật")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_characters", "Chưa có nhân vật nào — hãy tạo nhân vật trước.")}</div>`;
    const factions = (b.factions || []).length
        ? `<div class="dyn-list" data-dynlist="locfactions">${(
              x.factionIds || []
          )
              .map((fid) => factionPickRowHTML(b, fid, "locFactionIds"))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="locfactions">${tFn("creator.f.add_loc_faction", "＋ Thêm thế lực")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_factions", "Chưa có thế lực nào — hãy thêm ở tab Thế lực.")}</div>`;
    const items = (b.items || []).length
        ? `<div class="dyn-list" data-dynlist="locitems">${(x.itemIds || [])
              .map((iid) => itemPickRowHTML(b, { itemId: iid }, "locItemIds"))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="locitems">${tFn("creator.f.add_loc_item", "＋ Thêm vật phẩm")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_items", "Chưa có vật phẩm nào — hãy thêm ở tab Vật phẩm.")}</div>`;
    const quests = ((b.systems || {}).quests || []).length
        ? `<div class="dyn-list" data-dynlist="locquests">${(x.questIds || [])
              .map((qid) => questPickRowHTML(b, qid))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="locquests">${tFn("creator.f.add_loc_quest", "＋ Thêm quest")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_quests", "Chưa có quest nào — tạo ở Systems → Quests.")}</div>`;
    const events = (b.timeline || []).length
        ? `<div class="dyn-list" data-dynlist="locevents">${(x.eventIds || [])
              .map((tid) => timelinePickRowHTML(b, tid, "locEventIds"))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="locevents">${tFn("creator.f.add_loc_event", "＋ Thêm sự kiện")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_timeline", "Chưa có timeline nào — thêm ở tab Chương → Timeline.")}</div>`;
    const timelineEvents = (b.timeline || []).length
        ? `<div class="dyn-list" data-dynlist="loctimeline">${(
              x.timelineEventIds || []
          )
              .map((tid) => timelinePickRowHTML(b, tid, "locTimelineIds"))
              .join(
                  "",
              )}<button type="button" class="btn small secondary" data-dynadd="loctimeline">${tFn("creator.f.add_loc_timeline", "＋ Thêm mốc timeline")}</button></div>`
        : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_no_timeline", "Chưa có timeline nào — thêm ở tab Chương → Timeline.")}</div>`;
    return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="form-row"><div class="field"><label>${tFn("creator.f.loc_code", "Code / Mã")}</label><input name="code" value="${esc(x.code || "")}" placeholder="${tFn("creator.f.loc_code_ph", "VD: Bắc Sarayı, Hạ Đông...")}"></div><div class="field"><label>${tFn("creator.f.loc_type", "Loại")}</label><input name="type" value="${esc(x.type || "")}" placeholder="${tFn("creator.f.loc_type_ph", "VD: Thành, Ẩn sơn, Tàpınak, Orman...")}"></div></div><div class="field"><label>${tFn("creator.f.loc_parent", "Vị diện cha / Location cha")}</label><select name="parentLocationId"><option value="">${tFn("creator.f.loc_parent_none", "— Chưa có —")}</option>${locOpts}</select>${(b.locations || []).length ? "" : `<div class="muted" style="font-size:12px">${tFn("creator.f.loc_none_hint", "Chưa có vị diện nào — hãy thêm ở tab Vị diện.")}</div>`}</div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.loc_rules", "Luật lệ / Quy tắc")}</label><textarea name="rules" placeholder="${tFn("creator.f.loc_rules_ph", "VD: Quy tắc đặc biệt của vùng này...")}">${esc(x.rules || "")}</textarea></div><h3 style="margin:16px 0 8px">${tFn("creator.f.loc_relations", "Mối quan hệ")}</h3><div class="field"><label>${tFn("creator.f.loc_connected", "Vị diện liên kết")}</label>${connected}</div><div class="field" ${hideChars ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_characters", "Nhân vật")}</label>${characters}</div><div class="field" ${hideFactions ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_factions", "Thế lực")}</label>${factions}</div><div class="field" ${hideItems ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_items", "Vật phẩm")}</label>${items}</div><div class="field" ${hideQuests ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_quests", "Quests / Nhiệm vụ")}</label>${quests}</div><div class="field" ${hideTimeline ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_events", "Sự kiện (Events)")}</label>${events}</div><div class="field" ${hideTimeline ? 'style="display:none"' : ""}><label>${tFn("creator.f.loc_timeline", "Timeline")}</label>${timelineEvents}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
}
function entityForm(type, x, b) {
    x = x || {};
    const ds = b.displaySettings || {};
    const hideChars = dsHidden(ds, "characters");
    const hideFactions = dsHidden(ds, "factions");
    const hideRealms = dsHidden(ds, "realms");
    const hideAbilities = dsHidden(ds, "abilities");
    const hideSkillsets = dsHidden(ds, "skillsets");
    const hideItems = dsHidden(ds, "items");
    const hideItemsets = dsHidden(ds, "itemsets");
    if (type === "location") return locationFormHTML(x, b);
    if (type === "chapter")
        return `<form id="entityForm" class="form"><div class="form-row"><div class="field"><label>${tFn("creator.f.number", "Số chương *")}</label><input type="number" min="1" name="number" value="${x.number ?? b.chapters.length + 1}" required></div><div class="field"><label>${tFn("creator.form.title", "Tiêu đề *")}</label><input name="title" value="${esc(x.title || "")}" required></div></div><div class="field"><label>${tFn("creator.f.content", "Nội dung")}</label><textarea class="content-editor" name="content">${esc(x.content || "")}</textarea></div><div class="field"><label>${tFn("creator.f.notes", "Ghi chú riêng")}</label><textarea name="notes">${esc(x.notes || "")}</textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save_ch", "Lưu chương")}</button></div></form>`;
    if (type === "relation")
        return `<form id="entityForm" class="form"><div class="form-row"><div class="field"><label>${tFn("creator.f.from", "Từ")}</label><input name="from" value="${esc(x.from || "")}" placeholder="${tFn("creator.f.from_ph", "Nhân vật / thế lực")}"></div><div class="field"><label>${tFn("creator.f.to", "Đến")}</label><input name="to" value="${esc(x.to || "")}" placeholder="${tFn("creator.f.from_ph", "Nhân vật / thế lực")}"></div></div><div class="field"><label>${tFn("creator.f.rel_type", "Loại quan hệ")}</label><input name="rtype" value="${esc(x.type || "")}" placeholder="${tFn("creator.f.rel_type_ph", "Bạn bè, thù địch, cấp dưới...")}"></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save_rel", "Lưu quan hệ")}</button></div></form>`;
    if (type === "skillset")
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="field" ${hideAbilities ? 'style="display:none"' : ""}><label>${tFn("creator.f.skills", "Danh sách kỹ năng / sức mạnh của bộ")}</label><div class="dyn-list" data-dynlist="skills">${(x.skills || []).map((s) => skillPickRowHTML(b, s)).join("")}<button type="button" class="btn small secondary" data-dynadd="skills">${tFn("creator.f.add_skill", "＋ Thêm kỹ năng / sức mạnh")}</button></div>${(b.abilities || []).length ? `<div class="muted" style="font-size:12px">${tFn("creator.f.skill_pick_hint", "Chọn từ danh sách Năng lực / Kỹ năng đã tạo.")}</div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.ability_none_hint", "Chưa có năng lực / kỹ năng nào — hãy thêm ở tab Năng lực / Kỹ năng.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    if (type === "character") {
        const chapterOpts = [...(b.chapters || [])]
            .sort((a, z) => a.number - z.number)
            .map(
                (c) =>
                    `<option value="${c.id}" ${x.firstChapterId === c.id ? "selected" : ""}>${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}${c.title ? ": " + esc(c.title) : ""}</option>`,
            )
            .join("");
        const realmOpts = (b.realms || [])
            .map(
                (r) =>
                    `<option value="${r.id}" ${x.homeRealmId === r.id ? "selected" : ""}>${esc(r.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("");
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="form-row"><div class="field"><label>${tFn("creator.f.age", "Tuổi")}</label><input name="age" value="${esc(x.age || "")}" placeholder="${tFn("creator.f.age_ph", "VD: 18, 3000 ...")}"></div><div class="field"><label>${tFn("creator.f.first_chapter", "Xuất hiện lần đầu ở chương")}</label><select name="firstChapterId"><option value="">${tFn("creator.f.first_chapter_none", "— Chưa rõ —")}</option>${chapterOpts}</select></div></div><div class="field"><label>${tFn("creator.f.hobbies", "Sở thích (cách nhau bởi dấu phẩy)")}</label><input name="hobbies" value="${esc((x.hobbies || []).join(", "))}" placeholder="${tFn("creator.f.hobbies_ph", "Luyện đan, Trọng kiếm, Đọc sách ...")}"></div><div class="field" ${hideFactions ? 'style="display:none"' : ""}><label>${tFn("creator.f.char_factions", "Thuộc thế lực & chức vụ trong thế lực")}</label>${(b.factions || []).length ? `<div class="dyn-list" data-dynlist="charfactions">${(x.factions || []).map((m) => charFactionRowHTML(b, m)).join("")}<button type="button" class="btn small secondary" data-dynadd="charfactions">${tFn("creator.f.add_char_faction", "＋ Thêm thế lực")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.faction_none_hint", "Chưa có thế lực nào — hãy thêm ở tab Thế lực.")}</div>`}</div><div class="field" ${hideAbilities ? 'style="display:none"' : ""}><label>${tFn("creator.f.char_abilities", "Sở hữu khả năng / kỹ năng")}</label>${(b.abilities || []).length ? `<div class="dyn-list" data-dynlist="charabilities">${(x.abilityIds || []).map((aid) => abilityPickRowHTML(b, typeof aid === "string" ? { abilityId: aid, chapterStatuses: {} } : aid)).join("")}<button type="button" class="btn small secondary" data-dynadd="charabilities">${tFn("creator.f.add_char_ability", "＋ Thêm khả năng / kỹ năng")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.ability_none_for_char", "Chưa có khả năng / kỹ năng nào — hãy thêm ở tab Năng lực / Kỹ năng.")}</div>`}</div>
<div class="form-row" ${hideRealms ? 'style="display:none"' : ""}><div class="field"><label>${tFn("creator.f.home_realm", "Thuộc giới vực (quê quán)")}</label><select name="homeRealmId"><option value="">${tFn("creator.f.home_realm_none", "— Chưa rõ —")}</option>${realmOpts}</select>${(b.realms || []).length ? "" : `<div class="muted" style="font-size:12px">${tFn("creator.f.realm_none_hint", "Chưa có giới vực nào — hãy thêm ở tab Giới vực.")}</div>`}</div><div class="field"><label>${tFn("creator.f.visited_realms", "Đã từng đi qua giới vực")}</label>${(b.realms || []).length ? `<div class="dyn-list" data-dynlist="visitedrealms">${(x.visitedRealmIds || []).map((rid) => realmPickRowHTML(b, rid, "charVisitedRealmIds")).join("")}<button type="button" class="btn small secondary" data-dynadd="visitedrealms">${tFn("creator.f.add_visited_realm", "＋ Thêm giới vực đã đi qua")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.realm_none_hint", "Chưa có giới vực nào — hãy thêm ở tab Giới vực.")}</div>`}</div></div>
<div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    }
    if (type === "faction") {
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="field"><label>${tFn("creator.f.ranks", "Chức vụ / Cấp bậc trong thế lực")}</label><div class="dyn-list" data-dynlist="ranks">${(x.ranks || []).map((r) => rankRowHTML(r)).join("")}<button type="button" class="btn small secondary" data-dynadd="ranks">${tFn("creator.f.add_rank", "＋ Thêm chức vụ / cấp bậc")}</button></div></div><div class="field" ${hideRealms ? 'style="display:none"' : ""}><label>${tFn("creator.f.realms", "Tồn tại ở giới vực")}</label>${(b.realms || []).length ? `<div class="dyn-list" data-dynlist="realmpicks">${(x.realmIds || []).map((rid) => realmPickRowHTML(b, rid)).join("")}<button type="button" class="btn small secondary" data-dynadd="realmpicks">${tFn("creator.f.add_realm", "＋ Thêm giới vực")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.realm_none_hint", "Chưa có giới vực nào — hãy thêm ở tab Giới vực.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    }
    if (type === "realm") {
        const pickedFactions = (x.factionIds || []).length
            ? x.factionIds
            : x.id
              ? (b.factions || [])
                    .filter((f) => (f.realmIds || []).includes(x.id))
                    .map((f) => f.id)
              : [];
        const pickedCharacters = x.id
            ? (b.characters || [])
                  .filter((c) => c.homeRealmId === x.id)
                  .map((c) => c.id)
            : [];
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="field" ${hideFactions ? 'style="display:none"' : ""}><label>${tFn("creator.f.realm_factions", "Các thế lực tồn tại ở giới vực này")}</label>${(b.factions || []).length ? `<div class="dyn-list" data-dynlist="factionpicks">${pickedFactions.map((fid) => factionPickRowHTML(b, fid)).join("")}<button type="button" class="btn small secondary" data-dynadd="factionpicks">${tFn("creator.f.add_char_faction", "＋ Thêm thế lực")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.faction_none_hint", "Chưa có thế lực nào — hãy thêm ở tab Thế lực.")}</div>`}</div><div class="field" ${hideChars ? 'style="display:none"' : ""}><label>${tFn("creator.f.realm_characters", "Các nhân vật thuộc giới vực này (quê quán)")}</label>${(b.characters || []).length ? `<div class="dyn-list" data-dynlist="realmcharacters">${pickedCharacters.map((cid) => characterPickRowHTML(b, cid)).join("")}<button type="button" class="btn small secondary" data-dynadd="realmcharacters">${tFn("creator.f.add_realm_character", "＋ Thêm nhân vật")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.char_none_hint", "Chưa có nhân vật nào — hãy tạo nhân vật trước.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    }
    if (type === "ability")
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label>${tagComboHTML("abilityTags", ABILITY_TAG_OPTIONS, (x.tags || []).join(", "))}</div><div class="field" ${hideSkillsets ? 'style="display:none"' : ""}><label>${tFn("creator.f.ability_skillsets", "Đến từ bộ kỹ năng")}</label>${(b.skillsets || []).length ? `<div class="dyn-list" data-dynlist="skillsets">${(x.skillsetIds || []).map((sid) => skillsetPickRowHTML(b, sid)).join("")}<button type="button" class="btn small secondary" data-dynadd="skillsets">${tFn("creator.f.add_skillset", "＋ Thêm bộ kỹ năng")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.skillset_none_hint", "Chưa có bộ kỹ năng nào — hãy thêm ở tab Bộ kỹ năng.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    if (type === "item")
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="field" ${hideChars ? 'style="display:none"' : ""}><label>${tFn("creator.f.owners", "Người sở hữu")}</label>${(b.characters || []).length ? `<div class="dyn-list" data-dynlist="owners">${(x.ownerIds || []).map((cid) => ownerPickRowHTML(b, cid)).join("")}<button type="button" class="btn small secondary" data-dynadd="owners">${tFn("creator.f.add_owner", "＋ Thêm người sở hữu")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.owner_none_hint", "Chưa có nhân vật nào — hãy tạo nhân vật trước.")}</div>`}</div><div class="field" ${hideItemsets ? 'style="display:none"' : ""}><label>${tFn("creator.f.item_sets", "Thuộc bộ vật phẩm")}</label>${(b.itemsets || []).length ? `<div class="dyn-list" data-dynlist="itemsetpicks">${(x.itemsetIds || []).map((sid) => itemsetPickRowHTML(b, sid)).join("")}<button type="button" class="btn small secondary" data-dynadd="itemsetpicks">${tFn("creator.f.add_item_set", "＋ Thêm bộ vật phẩm")}</button></div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.itemset_none_hint", "Chưa có bộ vật phẩm nào — hãy thêm ở tab Bộ vật phẩm.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    if (type === "itemset")
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="field" ${hideItems ? 'style="display:none"' : ""}><label>${tFn("creator.f.items", "Danh sách vật phẩm của bộ")}</label><div class="dyn-list" data-dynlist="items">${(x.items || []).map((s) => itemPickRowHTML(b, s)).join("")}<button type="button" class="btn small secondary" data-dynadd="items">${tFn("creator.f.add_item", "＋ Thêm vật phẩm")}</button></div>${(b.items || []).length ? `<div class="muted" style="font-size:12px">${tFn("creator.f.item_pick_hint", "Chọn từ danh sách Vật phẩm đã tạo.")}</div>` : `<div class="muted" style="font-size:12px">${tFn("creator.f.item_none_hint", "Chưa có vật phẩm nào — hãy thêm ở tab Vật phẩm.")}</div>`}</div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    if (type === "rule") {
        const scopeVal =
            x.scopeType === "faction"
                ? "faction:" + (x.scopeId || "")
                : x.scopeType === "realm"
                  ? "realm:" + (x.scopeId || "")
                  : "";
        const realmOpts = (b.realms || [])
            .map(
                (r) =>
                    `<option value="realm:${r.id}" ${scopeVal === "realm:" + r.id ? "selected" : ""}>${esc(r.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("");
        const facOpts = (b.factions || [])
            .map(
                (f) =>
                    `<option value="faction:${f.id}" ${scopeVal === "faction:" + f.id ? "selected" : ""}>${esc(f.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("");
        const charOpts = (b.characters || [])
            .map(
                (c) =>
                    `<option value="${c.id}" ${x.establisherId === c.id ? "selected" : ""}>${esc(c.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("");
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.f.rule_desc", "Mô tả luật lệ/quy tắc")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.rule_punishment", "Hình phạt khi trái lệnh")}</label><input name="punishment" value="${esc(x.punishment || "")}" placeholder="${tFn("creator.f.rule_punishment_ph", "Ví dụ: Trục xuất khỏi tông môn")}"></div><div class="field" ${hideRealms && hideFactions ? 'style="display:none"' : ""}><label>${tFn("creator.f.rule_scope", "Vị diện / tổ chức nào có luật này")}</label><select name="rule_scope"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option><optgroup label="${tFn("creator.f.scope_realm_group", "Vị diện (Giới vực)")}">${realmOpts}</optgroup><optgroup label="${tFn("creator.f.scope_faction_group", "Tổ chức (Thế lực)")}">${facOpts}</optgroup></select></div><div class="field" id="ruleEstablisherWrap" ${scopeVal.startsWith("faction:") && !hideChars ? "" : 'style="display:none"'}><label>${tFn("creator.f.rule_establisher", "Ai đã thiết lập")}</label><select name="rule_establisher"><option value="">${tFn("creator.f.pick_none", "— Chọn —")}</option>${charOpts}</select></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    }
    if (type === "definition") {
        return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.f.def_code", "Mã định nghĩa *")}</label><input name="code" value="${esc(x.code || "")}" required placeholder="${tFn("creator.f.def_code_ph", "Ví dụ: hp, atk, def")}"><div class="muted" style="font-size:12px">${tFn("creator.f.def_code_hint", "Mã không dấu, không được trùng với định nghĩa khác.")}</div></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label>${tagComboHTML("definitionTags", DEFINITION_TAG_OPTIONS, (x.tags || []).join(", "))}</div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
    }
    return `<form id="entityForm" class="form"><div class="field"><label>${tFn("creator.f.name", "Tên *")}</label><input name="name" value="${esc(x.name || "")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(x.description || "")}</textarea></div><div class="field"><label>${tFn("creator.f.tags", "Tags")}</label><input name="tags" value="${esc((x.tags || []).join(", "))}" placeholder="${tFn("creator.f.tags_ph", "Rare, Quest, Boss...")}"></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div></form>`;
}
async function removeEntity(type, id) {
    if (!confirm(tFn("creator.confirm.entity", "Xóa mục này?"))) return;
    const b = await getBook(state.bookId),
        key = entityKey(type);
    b[key] = b[key].filter((x) => x.id !== id);

    if (type === "faction")
        for (const c of b.characters || [])
            c.factions = (c.factions || []).filter((m) => m.factionId !== id);
    if (type === "realm") {
        for (const f of b.factions || [])
            f.realmIds = (f.realmIds || []).filter((rid) => rid !== id);
        for (const c of b.characters || []) {
            if (c.homeRealmId === id) c.homeRealmId = "";
            c.visitedRealmIds = (c.visitedRealmIds || []).filter(
                (rid) => rid !== id,
            );
        }
    }
    if (type === "location")
        for (const l of b.locations || [])
            if (l.id !== id) {
                if (l.parentLocationId === id) l.parentLocationId = "";
                l.connectedLocationIds = (l.connectedLocationIds || []).filter(
                    (lid) => lid !== id,
                );
            }
    if (type === "ability") {
        for (const ss of b.skillsets || [])
            ss.skills = (ss.skills || []).filter((s) => s.abilityId !== id);
        for (const c of b.characters || [])
            c.abilityIds = (c.abilityIds || []).filter((aid) => aid !== id);
    }
    if (type === "skillset")
        for (const a of b.abilities || [])
            a.skillsetIds = (a.skillsetIds || []).filter((sid) => sid !== id);
    if (type === "item")
        for (const iset of b.itemsets || [])
            iset.items = (iset.items || []).filter((s) => s.itemId !== id);
    if (type === "itemset")
        for (const it of b.items || [])
            it.itemsetIds = (it.itemsetIds || []).filter((sid) => sid !== id);
    if (type === "character")
        for (const it of b.items || [])
            it.ownerIds = (it.ownerIds || []).filter((cid) => cid !== id);
    if (type === "realm" || type === "faction")
        for (const r of b.rules || [])
            if (r.scopeType === type && r.scopeId === id) {
                r.scopeType = "";
                r.scopeId = "";
                if (type === "faction") r.establisherId = "";
            }
    if (type === "character")
        for (const r of b.rules || [])
            if (r.establisherId === id) r.establisherId = "";
    await putBook(b);
    toast("Đã xóa");
    render();
}
function updateChapterDeleteUi() {
    const btn = $("#deleteSelectedChapters");
    if (!btn) return;
    const n = $$("#manageBody input[data-chk]:checked").length;
    btn.disabled = n === 0;
    btn.textContent = n
        ? `${tFn("creator.ch.del_sel", "Xóa đã chọn")} (${n})`
        : tFn("creator.ch.del_sel", "Xóa đã chọn");
}
async function deleteSelectedChapters() {
    const ids = $$("#manageBody input[data-chk]:checked").map(
        (x) => x.dataset.chk,
    );
    if (!ids.length) return;
    if (
        !confirm(
            fmt(
                tFn("creator.confirm.chapters", "Xóa {0} chương đã chọn?"),
                ids.length,
            ),
        )
    )
        return;
    const b = await getBook(state.bookId);
    if (!b) return;
    const gone = new Set(ids);
    const before = b.chapters.length;
    b.chapters = b.chapters.filter((c) => !gone.has(c.id));
    await putBook(b);
    toast(
        fmt(
            tFn("creator.toast.ch_del", "Đã xóa {0} chương"),
            before - b.chapters.length,
        ),
    );
    render();
}
function openChapterView(id) {
    getBook(state.bookId).then((b) => {
        if (!b) return;
        const c = b.chapters.find((x) => x.id === id);
        if (!c) return;
        const m = $("#modal");
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><div class="muted" style="font-size:13px">${wordCount(c.content).toLocaleString(localeTag())} ${tFn("creator.unit.word", "từ")} · ${(c.content || "").length.toLocaleString(localeTag())} ${tFn("creator.unit.chars", "ký tự")} · ${tFn("creator.unit.updated", "cập nhật")} ${new Date(c.updatedAt).toLocaleString(localeTag())}</div><div class="chapter-view">${esc(c.content || "") || tFn("creator.ch.view_empty", "Chương đang trống.")}</div></div><div class="modal-foot"><button class="btn secondary" id="chapterViewEdit">${tFn("creator.ch.edit_ch", "Sửa chương")}</button><button class="btn ghost" onclick="modal.close()">${tFn("creator.modal.close", "Đóng")}</button></div></div>`;
        m.showModal();
        $("#chapterViewEdit").onclick = () => {
            m.close();
            openEntityModal("chapter", id);
        };
    });
}
function arcTargetLabel(b, target) {
    const t = String(target || "");
    const i = t.indexOf(":");
    if (i <= 0) return t;
    const kind = t.slice(0, i);
    const ref = t.slice(i + 1);
    if (kind === "chapter") {
        const c = (b.chapters || []).find((x) => x.id === ref);
        return c
            ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${c.title || tFn("creator.ch.untitled", "Không tiêu đề")}`
            : tFn("creator.arc.miss_ch", "(chương không tồn tại)");
    }
    if (kind === "arc") {
        const a = (b.arcs || []).find((x) => x.id === ref);
        return a
            ? `${tFn("creator.tl.prefix_arc", "Arc: ")}${a.title || tFn("creator.noname", "Không tên")}`
            : tFn("creator.arc.miss_arc", "(arc không tồn tại)");
    }
    return t;
}
function arcChildRowHTML(p) {
    const removeBtn = `<button type="button" class="btn small danger" data-removechild="${p.key}" title="${tFn(
        "creator.ch.delete",
        "Xóa",
    )}">×</button>`;
    return `<div data-prow="${p.key}" style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="badge">${
        p.kind === "chapter"
            ? tFn("creator.unit.chapter", "chương")
            : tFn("creator.arc.unit", "arc / phần / tập")
    }</span><span style="flex:1">${esc(p.label)}</span>${removeBtn}</div>`;
}
function arcTlTargetOptions(b, arcId, childRefs, current) {
    const opts = [
        { v: "arc:" + arcId, label: tFn("creator.arc.this_arc", "Arc này") },
    ];
    for (const c of childRefs || []) {
        if (c.kind === "chapter") {
            const ch = (b.chapters || []).find((x) => x.id === c.ref);
            if (ch)
                opts.push({
                    v: "chapter:" + ch.id,
                    label: `${tFn("creator.unit.chapter_prefix", "Chương")} ${ch.number}: ${ch.title || tFn("creator.ch.untitled", "Không tiêu đề")}`,
                });
        } else {
            const sa = (b.arcs || []).find((x) => x.id === c.ref);
            if (sa)
                opts.push({
                    v: "arc:" + sa.id,
                    label: `${tFn("creator.tl.prefix_arc", "Arc: ")}${sa.title || tFn("creator.noname", "Không tên")}`,
                });
        }
    }
    return opts
        .map(
            (o) =>
                `<option value="${o.v}" ${current === o.v ? "selected" : ""}>${esc(o.label)}</option>`,
        )
        .join("");
}
function arcTlRowHTML(r, headHTML) {
    return `<div class="arc-tl-row" data-tlrow="${r.key}"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${headHTML}<input class="tl-time-input" name="tltime_${r.key}" value="${esc(
        r.time || "",
    )}" placeholder="${tFn(
        "creator.tl.time_ph",
        "VD: Năm 1, Sau trận chiến...",
    )}"><button type="button" class="btn small danger" data-removetl="${r.key}" title="${tFn(
        "creator.ch.delete",
        "Xóa",
    )}">×</button></div><input name="tltext_${r.key}" value="${esc(
        r.text || "",
    )}" placeholder="${tFn("creator.tl.text", "Nội dung")}"></div>`;
}
function arcTimelineOrderedTargets(b, arcId, extraChildren) {
    const out = [];
    const seen = new Set();
    const walkArcs = new Set();
    const pushTok = (kind, ref) => {
        const tok = kind + ":" + ref;
        if (seen.has(tok)) return;
        seen.add(tok);
        out.push({ kind, ref });
    };
    const walk = (list) => {
        for (const c of list || []) {
            const kind = c.kind;
            if (kind === "chapter") {
                pushTok("chapter", c.ref);
            } else if (kind === "arc") {
                pushTok("arc", c.ref);
                const sub = (b.arcs || []).find((x) => x.id === c.ref);
                if (sub && !walkArcs.has(c.ref)) {
                    walkArcs.add(c.ref);
                    walk(sub.children || []);
                }
            }
        }
    };
    pushTok("arc", arcId);
    const arc = (b.arcs || []).find((x) => x.id === arcId);
    walk((arc && arc.children) || []);
    walk(extraChildren || []);
    return out;
}
function openArcModal(id = null) {
    getBook(state.bookId).then((b) => {
        b.arcs = b.arcs || [];
        b.chapters = b.chapters || [];
        b.timeline = b.timeline || [];
        const arc = id ? b.arcs.find((x) => x.id === id) : null;
        if (arc) arc.children = arc.children || [];
        const pendingKids = [];
        const removedChildren = new Set();
        const removedTl = [];
        let keySeq = 0;
        const newKey = () => "k" + ++keySeq;
        const arcId = arc ? arc.id : "new";
        const orderedTargets = () => {
            const removed = new Set();
            for (const c of (arc && arc.children) || [])
                if (removedChildren.has(c.id))
                    removed.add((c.kind || "arc") + ":" + c.ref);
            return arcTimelineOrderedTargets(b, arcId, pendingKids).filter(
                (t) => !removed.has(t.kind + ":" + t.ref),
            );
        };
        const rebuildExistingTl = () => {
            const order = orderedTargets();
            const idxOf = (tok) => {
                for (let i = 0; i < order.length; i++)
                    if (order[i].kind + ":" + order[i].ref === tok) return i;
                return -1;
            };
            const rows = [];
            for (const t of b.timeline) {
                const tok = (t.kind || "arc") + ":" + t.ref;
                const oi = idxOf(tok);
                if (oi < 0) continue;
                rows.push({
                    key: newKey(),
                    entryId: t.id,
                    target: tok,
                    time: t.time || "",
                    text: t.text || "",
                    _o: oi,
                });
            }
            return rows.sort((a, z) => a._o - z._o);
        };
        let tlExisting = rebuildExistingTl();
        const tlNew = [];
        const syncTlValues = () => {
            const form = $("#arcForm");
            for (const r of [...tlExisting, ...tlNew]) {
                const sel = form.querySelector(`[name="tltarget_${r.key}"]`);
                if (sel) r.target = sel.value;
                const timeEl = form.querySelector(`[name="tltime_${r.key}"]`);
                if (timeEl) r.time = timeEl.value;
                const textEl = form.querySelector(`[name="tltext_${r.key}"]`);
                if (textEl) r.text = textEl.value;
            }
        };
        const applyTlOrder = () => {
            syncTlValues();
            const order = orderedTargets();
            const idxOf = (tok) => {
                for (let i = 0; i < order.length; i++)
                    if (order[i].kind + ":" + order[i].ref === tok) return i;
                return order.length;
            };
            const all = [...tlExisting, ...tlNew];
            tlExisting = all
                .filter((r) => r.entryId)
                .sort((a, z) => idxOf(a.target) - idxOf(z.target));
            tlNew = all
                .filter((r) => !r.entryId)
                .sort((a, z) => idxOf(a.target) - idxOf(z.target));
            renderTl();
        };
        const existingChildRowHTML = (c) => {
            const label = arcTargetLabel(b, (c.kind || "arc") + ":" + c.ref);
            const removeBtn = `<button type="button" class="btn small ghost" data-removeexistchild="${c.id}" title="${tFn(
                "creator.arc.unlink",
                "Gỡ",
            )}">${tFn("creator.arc.unlink", "Gỡ")}</button>`;
            return `<div data-echild="${c.id}" style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="badge">${
                c.kind === "chapter"
                    ? tFn("creator.unit.chapter", "chương")
                    : tFn("creator.arc.unit", "arc / phần / tập")
            }</span><span style="flex:1">${esc(label)}</span>${removeBtn}</div>`;
        };
        const renderChildren = () => {
            const exHost = $("#arcExistingList");
            if (exHost) {
                const kept = arc
                    ? (arc.children || []).filter(
                          (c) => !removedChildren.has(c.id),
                      )
                    : [];
                exHost.innerHTML = arc
                    ? kept.map(existingChildRowHTML).join("") ||
                      `<div class="muted">${tFn(
                          "creator.arc.children_empty",
                          "Chưa chứa chương hoặc arc nào.",
                      )}</div>`
                    : "";
            }
            const host = $("#arcPendingList");
            if (host)
                host.innerHTML = pendingKids.map(arcChildRowHTML).join("");
            const n = $("#arcChildCount");
            if (n)
                n.textContent = `(${
                    (arc
                        ? arc.children.filter((c) => !removedChildren.has(c.id))
                              .length
                        : 0) + pendingKids.length
                })`;
        };
        const renderTl = () => {
            const host = $("#arcTlList");
            if (!host) return;
            const rows = [...tlExisting, ...tlNew];
            const optsRefs = orderedTargets().filter(
                (t) => !(t.kind === "arc" && t.ref === arcId),
            );
            host.innerHTML = rows
                .map((r) =>
                    arcTlRowHTML(
                        r,
                        r.entryId
                            ? `<span class="badge">${esc(
                                  arcTargetLabel(b, r.target),
                              )}</span>`
                            : `<select name="tltarget_${r.key}">${arcTlTargetOptions(
                                  b,
                                  arcId,
                                  optsRefs,
                                  r.target,
                              )}</select>`,
                    ),
                )
                .join("");
            const n = $("#arcTlCount");
            if (n) n.textContent = `(${rows.length})`;
        };
        const addPendingChild = (kind, ref, label) => {
            pendingKids.push({ key: newKey(), kind, ref, label });
            const tok = kind + ":" + ref;
            const have = new Set(tlExisting.map((r) => r.entryId));
            for (const t of b.timeline)
                if ((t.kind || "arc") + ":" + t.ref === tok && !have.has(t.id))
                    tlExisting.push({
                        key: newKey(),
                        entryId: t.id,
                        target: tok,
                        time: t.time || "",
                        text: t.text || "",
                    });
            renderChildren();
            applyTlOrder();
        };
        const openFormPickDialog = (kind) => {
            const used = new Set();
            for (const c of (arc && arc.children) || [])
                if (!removedChildren.has(c.id)) used.add(c.ref);
            for (const p of pendingKids) used.add(p.ref);
            let candidates = [];
            if (kind === "chapter")
                candidates = [...(b.chapters || [])]
                    .filter((c) => !used.has(c.id))
                    .sort((x, y) => x.number - y.number);
            else {
                const blocked = arcCycleSafeIds(b, arc ? arc.id : "__none__");
                candidates = (b.arcs || []).filter(
                    (a) => !used.has(a.id) && !blocked.has(a.id),
                );
            }
            if (!candidates.length) {
                toast(
                    kind === "chapter"
                        ? tFn(
                              "creator.arc.none_ch",
                              "Tất cả chương đã nằm trong arc này",
                          )
                        : tFn(
                              "creator.arc.none_arc",
                              "Không còn arc hợp lệ để lồng vào (tránh vòng lặp)",
                          ),
                );
                return;
            }
            const dialog = document.createElement("dialog");
            dialog.className = "modal";
            dialog.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${kind === "chapter" ? tFn("creator.arc.pick_ch", "Thêm chương vào") : tFn("creator.arc.pick_arc", "Lồng arc vào")} ${esc(arc ? arc.title || tFn("creator.noname", "Không tên") : tFn("creator.arc.this_arc", "Arc này"))}</strong><button type="button" class="icon-btn" data-close>×</button></div><div class="modal-body"><form id="arcFormPick" class="form"><div class="field"><label>${kind === "chapter" ? tFn("creator.ch.sel_one", "Chọn chương") : tFn("creator.arc.pick_label", "Chọn arc")}</label><select name="ref" required>${candidates
                .map((c) =>
                    kind === "chapter"
                        ? `<option value="${c.id}">${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</option>`
                        : `<option value="${c.id}">${esc(c.title || tFn("creator.noname", "Không tên"))}</option>`,
                )
                .join(
                    "",
                )}</select></div><div class="modal-foot"><button class="btn primary">${tFn("creator.arc.pick_save", "Thêm vào arc")}</button></div></form></div></div>`;
            document.body.appendChild(dialog);
            dialog.showModal();
            dialog.querySelector("[data-close]").onclick = () => {
                dialog.close();
                dialog.remove();
            };
            dialog.querySelector("#arcFormPick").onsubmit = (e) => {
                e.preventDefault();
                const ref = new FormData(e.target).get("ref");
                if (!ref) return;
                const label =
                    kind === "chapter"
                        ? (() => {
                              const c = (b.chapters || []).find(
                                  (x) => x.id === ref,
                              );
                              return c
                                  ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${c.title || tFn("creator.ch.untitled", "Không tiêu đề")}`
                                  : ref;
                          })()
                        : (() => {
                              const a = (b.arcs || []).find(
                                  (x) => x.id === ref,
                              );
                              return a
                                  ? a.title ||
                                        tFn("creator.noname", "Không tên")
                                  : ref;
                          })();
                addPendingChild(kind, ref, label);
                dialog.close();
                dialog.remove();
            };
        };
        const openFormTimelineDialog = () => {
            const targets = orderedTargets().map((t) => ({
                v: t.kind + ":" + t.ref,
                label:
                    t.kind === "arc" && t.ref === arcId
                        ? tFn("creator.arc.this_arc", "Arc này")
                        : arcTargetLabel(b, t.kind + ":" + t.ref),
            }));
            const dialog = document.createElement("dialog");
            dialog.className = "modal";
            dialog.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${tFn("creator.tl.modal_add", "Thêm timeline")}</strong><button type="button" class="icon-btn" data-close>×</button></div><div class="modal-body"><form id="arcTimelineForm" class="form"><div class="field"><label>${tFn("creator.tl.target", "Áp dụng cho")}</label><select name="target" required>${targets
                .map((o) => `<option value="${o.v}">${esc(o.label)}</option>`)
                .join(
                    "",
                )}</select></div><div class="field"><label>${tFn("creator.tl.time", "Thời gian / Mốc")}</label><input name="time" placeholder="${tFn("creator.tl.time_ph", "VD: Năm 1, Sau trận chiến...")}"></div><div class="field"><label>${tFn("creator.tl.text", "Nội dung")}</label><textarea name="text"></textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.tl.save", "Lưu timeline")}</button></div></form></div></div>`;
            document.body.appendChild(dialog);
            dialog.showModal();
            dialog.querySelector("[data-close]").onclick = () => {
                dialog.close();
                dialog.remove();
            };
            dialog.querySelector("#arcTimelineForm").onsubmit = (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const kv = String(fd.get("target") || "arc:" + arcId);
                tlNew.push({
                    key: newKey(),
                    target: kv,
                    time: String(fd.get("time") || "").trim(),
                    text: String(fd.get("text") || "").trim(),
                });
                applyTlOrder();
                dialog.close();
                dialog.remove();
            };
        };
        const m = $("#modal");
        const ds = b.displaySettings || {};
        const tlHidden = ds.timeline === "hidden";
        const formTop = `<div class="field"><label>${tFn("creator.form.title", "Tiêu đề *")}</label><input name="title" value="${esc(arc ? arc.title || "" : "")}" placeholder="${tFn("creator.arc.title_ph", "VD: Phần 1 — Khởi đầu")}" required></div><div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description">${esc(arc ? arc.description || "" : "")}</textarea></div><div style="border-top:1px solid var(--border);margin-top:12px;padding-top:8px"><h4 style="margin:0 0 8px">${tFn("creator.arc.children", "Chương / Arc con")} <span id="arcChildCount" class="muted"></span></h4><div id="arcExistingList" style="margin-bottom:8px"></div><div id="arcPendingList"></div><div class="actions" style="margin-bottom:4px"><button type="button" class="btn small secondary" id="arcAddChildChapter">${tFn("creator.ch.add", "＋ Thêm chương")}</button><button type="button" class="btn small secondary" id="arcAddChildArc">${tFn("creator.arc.add_subarc", "＋ Thêm arc con")}</button></div></div>`;
        const formBottom = tlHidden
            ? `<div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div>`
            : `<div style="border-top:1px solid var(--border);margin-top:12px;padding-top:8px"><h4 style="margin:0 0 8px">${tFn("creator.sub.timeline", "Dòng thời gian")} <span id="arcTlCount" class="muted"></span></h4><div id="arcTlList"></div><div class="actions" style="margin-bottom:4px"><button type="button" class="btn small secondary" id="arcAddTl">${tFn("creator.arc.add_tl_row", "＋ Thêm dòng thời gian")}</button></div></div><div class="modal-foot"><button class="btn primary">${tFn("creator.f.save", "Lưu")}</button></div>`;
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${arc ? tFn("creator.arc.modal_edit", "Sửa Arc/Phần/Tập") : tFn("creator.arc.modal_add", "Thêm Arc/Phần/Tập")}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><form id="arcForm" class="form">${formTop}${formBottom}</form></div></div>`;
        m.showModal();
        renderChildren();
        if (!tlHidden) renderTl();
        $("#arcAddChildChapter").onclick = () => openFormPickDialog("chapter");
        $("#arcAddChildArc").onclick = () => openFormPickDialog("arc");
        if (!tlHidden) $("#arcAddTl").onclick = () => openFormTimelineDialog();
        $("#arcForm").addEventListener("click", (e) => {
            const rc = e.target.closest("[data-removechild]");
            if (rc) {
                const key = rc.dataset.removechild;
                const i = pendingKids.findIndex((p) => p.key === key);
                if (i >= 0) {
                    const p = pendingKids[i];
                    pendingKids.splice(i, 1);
                    const tok = (p.kind || "arc") + ":" + p.ref;
                    tlExisting = tlExisting.filter((r) => r.target !== tok);
                    for (let j = tlNew.length - 1; j >= 0; j--)
                        if (tlNew[j].target === tok) tlNew.splice(j, 1);
                    renderChildren();
                    applyTlOrder();
                }
                return;
            }
            const re = e.target.closest("[data-removeexistchild]");
            if (re) {
                if (!arc) return;
                const c = (arc.children || []).find(
                    (x) => x.id === re.dataset.removeexistchild,
                );
                if (!c) return;
                removedChildren.add(c.id);
                const tok = (c.kind || "arc") + ":" + c.ref;
                tlExisting = tlExisting.filter((r) => r.target !== tok);
                tlNew = tlNew.filter((r) => r.target !== tok);
                renderChildren();
                applyTlOrder();
                return;
            }
            const rt = e.target.closest("[data-removetl]");
            if (rt) {
                const key = rt.dataset.removetl;
                const ei = tlExisting.findIndex((x) => x.key === key);
                if (ei >= 0) {
                    if (tlExisting[ei].entryId)
                        removedTl.push(tlExisting[ei].entryId);
                    tlExisting.splice(ei, 1);
                    renderTl();
                    return;
                }
                const ni = tlNew.findIndex((x) => x.key === key);
                if (ni >= 0) {
                    tlNew.splice(ni, 1);
                    renderTl();
                }
            }
        });
        $("#arcForm").addEventListener("change", (e) => {
            const sel = e.target.closest("[name^=tltarget_]");
            if (!sel) return;
            const r = tlNew.find((x) => x.key === sel.name.slice(9));
            if (r) r.target = sel.value;
        });
        $("#arcForm").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const targetArc = arc || {
                id: uid(),
                title: "",
                description: "",
                children: [],
                createdAt: now(),
            };
            if (removedChildren.size)
                targetArc.children = (targetArc.children || []).filter(
                    (c) => !removedChildren.has(c.id),
                );
            for (const p of pendingKids)
                targetArc.children.push({
                    id: uid(),
                    kind: p.kind,
                    ref: p.ref,
                });
            targetArc.title = String(fd.get("title") || "").trim();
            targetArc.description = String(fd.get("description") || "").trim();
            targetArc.updatedAt = now();
            if (!arc) b.arcs.push(targetArc);
            if (removedTl.length)
                b.timeline = b.timeline.filter(
                    (t) => !removedTl.includes(t.id),
                );
            for (const r of tlExisting) {
                const t = b.timeline.find((x) => x.id === r.entryId);
                if (t) {
                    t.time = String(fd.get("tltime_" + r.key) || "").trim();
                    t.text = String(fd.get("tltext_" + r.key) || "").trim();
                }
            }
            for (const r of tlNew) {
                const tv = String(
                    fd.get("tltarget_" + r.key) || r.target || "",
                );
                const time = String(fd.get("tltime_" + r.key) || "").trim();
                const text = String(fd.get("tltext_" + r.key) || "").trim();
                let kind = "arc",
                    ref = targetArc.id;
                const i = tv.indexOf(":");
                if (i > 0) {
                    kind = tv.slice(0, i);
                    ref = tv.slice(i + 1);
                }
                if (ref === "" || ref === "new") {
                    kind = "arc";
                    ref = targetArc.id;
                }
                if (!kind || !ref) continue;
                b.timeline.push({ id: uid(), kind, ref, time, text });
            }
            await putBook(b);
            m.close();
            toast(
                arc
                    ? tFn("creator.arc.toast_saved", "Đã lưu arc")
                    : tFn("creator.arc.toast_added", "Đã thêm arc"),
            );
            render();
        };
    });
}
function openArcChildPicker(arcId, kind) {
    getBook(state.bookId).then((b) => {
        b.arcs = b.arcs || [];
        const arc = b.arcs.find((x) => x.id === arcId);
        if (!arc) return;
        arc.children = arc.children || [];
        const used = new Set(arc.children.map((c) => c.ref));
        let candidates;
        if (kind === "chapter") {
            candidates = [...(b.chapters || [])]
                .filter((c) => {
                    if (used.has(c.id)) return false;

                    const parentArc = findChapterParentArc(b, c.id, arcId);
                    if (parentArc) return false;

                    return true;
                })
                .sort((x, y) => x.number - y.number);
        } else {
            const blocked = arcCycleSafeIds(b, arcId);
            candidates = b.arcs.filter(
                (a) => !used.has(a.id) && !blocked.has(a.id),
            );
        }
        if (!candidates.length) {
            toast(
                kind === "chapter"
                    ? tFn(
                          "creator.arc.none_ch",
                          "Tất cả chương đã nằm trong arc này",
                      )
                    : tFn(
                          "creator.arc.none_arc",
                          "Không còn arc hợp lệ để lồng vào (tránh vòng lặp)",
                      ),
            );
            return;
        }
        const options = candidates
            .map((c) =>
                kind === "chapter"
                    ? `<option value="${c.id}">${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</option>`
                    : `<option value="${c.id}">${esc(c.title || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("");
        const m = $("#modal");
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${kind === "chapter" ? tFn("creator.arc.pick_ch", "Thêm chương vào") : tFn("creator.arc.pick_arc", "Lồng arc vào")} "${esc(arc.title || tFn("creator.noname", "Không tên"))}"</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><form id="arcChildForm" class="form"><div class="field"><label>${kind === "chapter" ? tFn("creator.ch.sel_one", "Chọn chương") : tFn("creator.arc.pick_label", "Chọn arc")}</label><select name="ref" required>${options}</select></div><div class="modal-foot"><button class="btn primary">${tFn("creator.arc.pick_save", "Thêm vào arc")}</button></div></form></div></div>`;
        m.showModal();
        $("#arcChildForm").onsubmit = async (e) => {
            e.preventDefault();
            const ref = new FormData(e.target).get("ref");
            if (!ref) return;
            arc.children.push({ id: uid(), kind, ref });
            await putBook(b);
            m.close();
            toast(tFn("creator.arc.toast_child", "Đã thêm vào arc"));
            render();
        };
    });
}
async function unlinkArcChild(arcId, childId) {
    const b = await getBook(state.bookId);
    if (!b) return;
    const arc = (b.arcs || []).find((x) => x.id === arcId);
    if (!arc) return;
    arc.children = (arc.children || []).filter((c) => c.id !== childId);
    await putBook(b);
    toast(tFn("creator.arc.toast_unlink", "Đã gỡ khỏi arc"));
    render();
}
async function deleteArc(id) {
    if (
        !confirm(
            tFn(
                "creator.arc.confirm_del",
                "Xóa arc này? Các chương bên trong sẽ không bị xóa.",
            ),
        )
    )
        return;
    const b = await getBook(state.bookId);
    if (!b) return;
    b.arcs = (b.arcs || []).filter((x) => x.id !== id);
    for (const a of b.arcs)
        a.children = (a.children || []).filter(
            (c) => !(c.kind === "arc" && c.ref === id),
        );
    b.timeline = (b.timeline || []).filter(
        (t) => !(t.kind === "arc" && t.ref === id),
    );
    await putBook(b);
    toast(tFn("creator.arc.toast_deleted", "Đã xóa arc"));
    render();
}
function applyTimelineOrder(b, ids) {
    b.timeline = b.timeline || [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    const queue = b.timeline
        .filter((t) => t && rank.has(t.id))
        .sort((a, z) => rank.get(a.id) - rank.get(z.id));
    let qi = 0;
    for (let i = 0; i < b.timeline.length; i++)
        if (b.timeline[i] && rank.has(b.timeline[i].id))
            b.timeline[i] = queue[qi++];
}
function dragRowHTML(html, id) {
    const handle = `<span class="drag-handle" data-draghandle title="${tFn(
        "creator.drag.hint",
        "Kéo để di chuyển thứ tự",
    )}">⁝⁝</span>`;
    return html
        .replace(
            '<div class="entity-head">',
            `<div class="entity-head drag-head">${handle}`,
        )
        .replace(
            /<div class="card entity-card[^"]*"/,
            (m) => `${m} data-dragrow="${id}"`,
        );
}
function applyEntityOrder(b, key, ids) {
    const arr = b[key];
    if (!Array.isArray(arr)) return;
    const rank = new Map(ids.map((id, i) => [id, i]));
    const queue = arr
        .filter((x) => x && rank.has(x.id))
        .sort((a, z) => rank.get(a.id) - rank.get(z.id));
    let qi = 0;
    for (let i = 0; i < arr.length; i++)
        if (arr[i] && rank.has(arr[i].id)) arr[i] = queue[qi++];
}
function applySystemOrder(b, kind, ids) {
    const arr = (b.systems || {})[kind];
    if (!Array.isArray(arr)) return;
    const rank = new Map(ids.map((id, i) => [id, i]));
    const queue = arr
        .filter((x) => x && rank.has(x.id))
        .sort((a, z) => rank.get(a.id) - rank.get(z.id));
    let qi = 0;
    for (let i = 0; i < arr.length; i++)
        if (arr[i] && rank.has(arr[i].id)) arr[i] = queue[qi++];
}
function applySystemCombatOrder(b, catId, ids) {
    const cat = ((b.systems || {}).combat || []).find(
        (c) => c && c.id === catId,
    );
    if (!cat || !Array.isArray(cat.stats) || !cat.stats.length) return;
    const arr = cat.stats;
    const sorted = [];
    for (const s of ids) {
        const i = Number(s);
        if (i >= 0 && i < arr.length && arr[i]) sorted.push(arr[i]);
    }
    if (sorted.length) cat.stats = sorted;
}
function bindDragReorder() {
    const groups = new Map();
    for (const row of $$("[data-dragrow]")) {
        if (!row.parentNode) continue;
        if (!groups.has(row.parentNode)) groups.set(row.parentNode, []);
        groups.get(row.parentNode).push(row);
    }
    for (const [container, rows] of groups) {
        let dragged = null;
        let dropped = false;
        for (const row of rows) {
            const handle = row.querySelector("[data-draghandle]");
            if (!handle) continue;
            handle.addEventListener(
                "pointerdown",
                () => (row.draggable = true),
            );
            handle.addEventListener("pointerup", () => (row.draggable = false));
            row.addEventListener("dragstart", (e) => {
                dropped = false;
                dragged = row;
                row.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
                try {
                    e.dataTransfer.setData("text/plain", row.dataset.dragrow);
                } catch (err) {}
            });
            row.addEventListener("dragend", () => {
                row.classList.remove("dragging");
                row.draggable = false;
                dragged = null;
                if (!dropped) render();
            });
            row.addEventListener("dragover", (e) => {
                if (!dragged || dragged === row) return;
                if (dragged.parentNode !== row.parentNode) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = row.getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                container.insertBefore(dragged, before ? row : row.nextSibling);
            });
        }
        container.addEventListener("dragover", (e) => e.preventDefault());
        container.addEventListener("drop", async (e) => {
            e.preventDefault();
            if (!dragged) return;
            dropped = true;
            const ids = [...container.querySelectorAll("[data-dragrow]")].map(
                (n) => n.dataset.dragrow,
            );
            if (!ids.length) return;
            const b = await getBook(state.bookId);
            const dl = container.dataset.draglist;
            if (dl === "chapters") {
                const pos = new Map(ids.map((id, i) => [id, i + 1]));
                for (const c of b.chapters || [])
                    if (pos.has(c.id)) c.number = pos.get(c.id);
            } else if (dl === "definitions") {
                applyEntityOrder(b, "definitions", ids);
            } else if (dl === "cb") {
                applySystemCombatOrder(b, container.dataset.cbg, ids);
            } else if (
                dl === "stats" ||
                dl === "resources" ||
                dl === "currencies" ||
                dl === "combat"
            ) {
                applySystemOrder(b, dl, ids);
            } else if (dl && dl !== "timeline") {
                applyEntityOrder(b, dl, ids);
            } else {
                applyTimelineOrder(b, ids);
            }
            await putBook(b);
            toast(tFn("creator.drag.saved", "Đã cập nhật thứ tự."));
            dragged = null;
            render();
        });
    }
}
function openTimelineModal(id = null, presetTarget = null) {
    getBook(state.bookId).then((b) => {
        b.arcs = b.arcs || [];
        b.timeline = b.timeline || [];
        const entry = id ? b.timeline.find((x) => x.id === id) : null;
        const targets = [
            ...b.arcs.map((a) => ({
                v: "arc:" + a.id,
                label:
                    tFn("creator.tl.prefix_arc", "Arc: ") +
                    (a.title || tFn("creator.noname", "Không tên")),
            })),
            ...[...b.chapters]
                .sort((x, y) => x.number - y.number)
                .map((c) => ({
                    v: "chapter:" + c.id,
                    label: `${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${c.title || tFn("creator.ch.untitled", "Không tiêu đề")}`,
                })),
        ];
        if (!targets.length) {
            toast(
                tFn(
                    "creator.tl.need_target",
                    "Cần có chương hoặc arc trước khi thêm timeline",
                ),
            );
            return;
        }
        const current = entry
            ? entry.kind + ":" + entry.ref
            : presetTarget
              ? presetTarget.kind + ":" + presetTarget.ref
              : "";
        const options = targets
            .map(
                (o) =>
                    `<option value="${o.v}" ${current === o.v ? "selected" : ""}>${esc(o.label)}</option>`,
            )
            .join("");
        const m = $("#modal");
        m.innerHTML = `<div class="modal-card"><div class="modal-head"><strong>${entry ? tFn("creator.tl.modal_edit", "Sửa timeline") : tFn("creator.tl.modal_add", "Thêm timeline")}</strong><button class="icon-btn" onclick="modal.close()">×</button></div><div class="modal-body"><form id="timelineForm" class="form"><div class="field"><label>${tFn("creator.tl.target", "Áp dụng cho")}</label><select name="target" required>${options}</select></div><div class="field"><label>${tFn("creator.tl.time", "Thời gian / Mốc")}</label><input name="time" value="${esc(entry ? entry.time || "" : "")}" placeholder="${tFn("creator.tl.time_ph", "VD: Năm 1, Sau trận chiến...")}"></div><div class="field"><label>${tFn("creator.tl.text", "Nội dung")}</label><textarea name="text">${esc(entry ? entry.text || "" : "")}</textarea></div><div class="modal-foot"><button class="btn primary">${tFn("creator.tl.save", "Lưu timeline")}</button></div></form></div></div>`;
        m.showModal();
        $("#timelineForm").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const [kind, ref] = String(fd.get("target") || "").split(":");
            if (!kind || !ref) return;
            if (entry) {
                entry.kind = kind;
                entry.ref = ref;
                entry.time = fd.get("time").trim();
                entry.text = fd.get("text").trim();
            } else {
                b.timeline.push({
                    id: uid(),
                    kind,
                    ref,
                    time: fd.get("time").trim(),
                    text: fd.get("text").trim(),
                });
            }
            await putBook(b);
            m.close();
            toast(
                entry
                    ? tFn("creator.tl.toast_saved", "Đã lưu timeline")
                    : tFn("creator.tl.toast_added", "Đã thêm timeline"),
            );
            render();
        };
    });
}

let relDraft = null;
let relChartBook = null;

let relEdgeCache = null;
let relDragBusy = false;
let relRenderQueued = false;
let relLineRaf = 0;
const relLinePending = new Set();

function relSortedSnaps(snaps) {
    return [...(snaps || [])].sort(
        (a, b) =>
            (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0) ||
            String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")),
    );
}
function relSnapshots(b, r) {
    if (r && Array.isArray(r.snapshots) && r.snapshots.length)
        return relSortedSnaps(r.snapshots);
    const chapters = [...((b && b.chapters) || [])].sort(
        (x, y) => (x.number || 0) - (y.number || 0),
    );
    let chapterId = "",
        chapterNumber = 0;
    if (r && r.scopeType === "chapter" && r.scopeRef) {
        const c = chapters.find((x) => x.id === r.scopeRef);
        if (c) {
            chapterId = c.id;
            chapterNumber = c.number || 0;
        }
    } else if (chapters.length) {
        chapterId = chapters[0].id;
        chapterNumber = chapters[0].number || 0;
    }
    return [
        {
            chapterId,
            chapterNumber,
            type: (r && r.type) || "",
            state: (r && r.state) || "",
            intensity: Number((r && r.intensity) || 0),
            description: (r && r.description) || "",
            visibility: (r && r.visibility) || "public",
            updatedAt: (r && (r.updatedAt || r.createdAt)) || "",
        },
    ];
}
function relSnapAt(snaps, chapterNumber) {
    let out = null;
    for (const s of relSortedSnaps(snaps))
        if ((Number(s.chapterNumber) || 0) <= chapterNumber) out = s;
    return out;
}
function relSnapLabel(b, snap) {
    if (!snap) return "";
    if (!snap.chapterId)
        return tFn("creator.rel.story_start", "Khởi đầu truyện");
    const c = (b.chapters || []).find((x) => x.id === snap.chapterId);
    return c
        ? `${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${c.title || tFn("creator.ch.untitled", "Không tiêu đề")}`
        : `${tFn("creator.unit.chapter_prefix", "Chương")} ${snap.chapterNumber ?? ""}`.trim();
}
function relMilestoneNumber(b, scope) {
    const s = String(scope || "");
    if (s.indexOf("chapter:") === 0) {
        const c = (b.chapters || []).find((x) => x.id === s.slice(8));
        if (c) return c.number || 0;
    }
    return Infinity;
}

function relationChart(b) {
    const nodes = [],
        byKey = new Map();
    const add = (kind, id, name, tags) => {
        const key =
            (kind === "faction" ? "f:" : kind === "character" ? "c:" : "n:") +
            id;
        if (byKey.has(key)) return byKey.get(key);
        const n = { key, kind, id, name, tags: tags || [] };
        nodes.push(n);
        byKey.set(key, n);
        return n;
    };
    const resolve = (side, r) => {
        const refId = side === "from" ? r.fromId : r.toId;
        const nm = side === "from" ? r.from : r.to;
        if (refId) {
            const c = byKey.get("c:" + refId),
                f = byKey.get("f:" + refId);
            if (c || f) return c || f;
            if (byKey.get("n:" + refId)) return byKey.get("n:" + refId);
            return add("n", refId, nm, []);
        }
        for (const n of nodes) if (n.name === nm) return n;
        return add("n", nm, nm, []);
    };
    for (const c of b.characters || []) add("character", c.id, c.name, c.tags);
    for (const f of b.factions || []) add("faction", f.id, f.name, f.tags);
    const edges = [];
    for (const r of b.relations || [])
        edges.push({
            r,
            from: resolve("from", r),
            to: resolve("to", r),
            key: "r:" + r.id,
        });
    return { nodes, byKey, edges };
}

function nodeFactions(b, node, edges) {
    if (node.kind === "faction") return [node.name];
    const ch =
        node.kind === "character"
            ? (b.characters || []).find((c) => c.id === node.id)
            : null;
    const out = [];
    for (const f of b.factions || []) {
        if (ch && (ch.factions || []).some((m) => m.factionId === f.id)) {
            if (!out.includes(f.name)) out.push(f.name);
            continue;
        }
        if ((node.tags || []).includes(f.name)) {
            if (!out.includes(f.name)) out.push(f.name);
            continue;
        }
        const member = edges.some((e) => {
            const t = String(e.r.type || "").toLowerCase();
            if (!/thuộc|thuoc|thà|vien|member|belong/.test(t)) return false;
            return (
                (node.id === e.from.id || node.id === e.to.id) &&
                (f.id === e.from.id || f.id === e.to.id)
            );
        });
        if (member && !out.includes(f.name)) out.push(f.name);
    }
    return out;
}

function relColor(v) {
    const val = v === undefined || v === null ? 0 : Number(v);
    const t = (Math.max(-5, Math.min(5, val)) + 5) / 10;
    return `hsl(${Math.round(t * 120)},72%,48%)`;
}

function relIntLabel(v) {
    const val = Number(v || 0);
    if (val === 0) return tFn("creator.rel.intensity_neutral", "Neutral");
    if (val < 0) return `${tFn("creator.rel.oppose", "Đối đầu")} ${-val}`;
    return `${tFn("creator.rel.close", "Gắn bó")} ${val}`;
}
function relEndpointOptionsHTML(b, selected) {
    const chars = b.characters || [],
        factions = b.factions || [];
    let html = `<option value="">${tFn("creator.rel.charsel", "Chọn nhân vật/thế lực")}</option>`;
    if (chars.length)
        html += `<optgroup label="${tFn("creator.tab.characters", "Nhân vật")}">${chars
            .map(
                (c) =>
                    `<option value="c:${c.id}" ${selected === "c:" + c.id ? "selected" : ""}>${esc(c.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("")}</optgroup>`;
    if (factions.length)
        html += `<optgroup label="${tFn("creator.tab.factions", "Thế lực")}">${factions
            .map(
                (f) =>
                    `<option value="f:${f.id}" ${selected === "f:" + f.id ? "selected" : ""}>${esc(f.name || tFn("creator.noname", "Không tên"))}</option>`,
            )
            .join("")}</optgroup>`;

    if (
        selected &&
        selected.charAt(1) === ":" &&
        !html.includes(`value="${selected}"`)
    ) {
        const chart = relationChart(b);
        const n = chart.byKey.get(selected);
        if (n)
            html += `<option value="${selected}" selected>${esc(n.name)} (${tFn("creator.rel.stub", "tạm")})</option>`;
    }
    return html;
}

function relScopeOptionsHTML(b, current) {
    const chapters = [...(b.chapters || [])].sort(
        (x, y) => (x.number || 0) - (y.number || 0),
    );
    const latest = chapters[chapters.length - 1] || null;
    let html = `<option value="latest" ${!current || current === "latest" ? "selected" : ""}>${tFn("creator.rel.scope_latest", "Chương mới nhất (tiến độ hiện tại)")}${latest ? ` — ${tFn("creator.unit.chapter_prefix", "Chương")} ${latest.number}` : ""}</option>`;
    const older = chapters.slice(0, -1);
    if (older.length)
        html += `<optgroup label="${tFn("creator.rel.scope_older_group", "Các chương cũ hơn")}">${older
            .map(
                (c) =>
                    `<option value="chapter:${c.id}" ${current === "chapter:" + c.id ? "selected" : ""}>${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</option>`,
            )
            .join("")}</optgroup>`;
    return html;
}
function relMilestoneOptionsHTML(b, current) {
    const chapters = [...(b.chapters || [])].sort(
        (x, y) => (x.number || 0) - (y.number || 0),
    );
    return chapters
        .map(
            (c) =>
                `<option value="chapter:${c.id}" ${current === "chapter:" + c.id ? "selected" : ""}>${tFn("creator.unit.chapter_prefix", "Chương")} ${c.number}: ${esc(c.title || tFn("creator.ch.untitled", "Không tiêu đề"))}</option>`,
        )
        .join("");
}
function relFilterNodeOptionsHTML(b) {
    const chart = relationChart(b);
    const used = new Set();
    for (const e of chart.edges) {
        used.add(e.from.key);
        used.add(e.to.key);
    }
    const chars = chart.nodes.filter(
        (n) => n.kind === "character" && used.has(n.key),
    );
    const factions = chart.nodes.filter(
        (n) => n.kind === "faction" && used.has(n.key),
    );
    let h = `<option value="">${tFn("creator.rel.any", "Tất")}</option>`;
    if (chars.length)
        h += `<optgroup label="${tFn("creator.tab.characters", "Nhân vật")}">${chars
            .map((n) => `<option value="${n.key}">${esc(n.name)}</option>`)
            .join("")}</optgroup>`;
    if (factions.length)
        h += `<optgroup label="${tFn("creator.tab.factions", "Thế lực")}">${factions
            .map((n) => `<option value="${n.key}">${esc(n.name)}</option>`)
            .join("")}</optgroup>`;
    return h;
}

function relFilterTypeOptionsHTML(b) {
    const s = new Set();
    for (const r of b.relations || [])
        for (const snap of relSnapshots(b, r)) {
            const t = String(snap.type || "").trim();
            if (t) s.add(t);
        }
    return (
        `<option value="">${tFn("creator.rel.any", "Tất")}</option>` +
        [...s]
            .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
            .join("")
    );
}

function relFilterFactionOptionsHTML(b) {
    return (
        `<option value="">${tFn("creator.rel.any", "Tất")}</option>` +
        (b.factions || [])
            .map(
                (f) => `<option value="${esc(f.name)}">${esc(f.name)}</option>`,
            )
            .join("")
    );
}

function relationDiagramHTML(b) {
    return `<div class="rel-diagram-head"><h3>${tFn("creator.rel.diagram_title", "Sơ đồ quan hệ")}</h3><p class="muted">${tFn("creator.rel.diagram_hint", "Chuột phải / giữ chuột trái để di chuyển nót, kéo từ nót (cạnh) để tạo quan hệ, bấm 2× để xem mục, kéo vùng trống để di chuyển sơ đồ.")}</p></div>
    <div class="rel-filters">
      <div class="field"><label>${tFn("creator.rel.filter_node", "Nhân vật / thế lực có quan hệ liên quan")}</label><select id="relFilterNode">${relFilterNodeOptionsHTML(b)}</select></div>
      <div class="field"><label>${tFn("creator.rel.filter_type", "Loại quan hệ")}</label><select id="relFilterType">${relFilterTypeOptionsHTML(b)}</select></div>
      <div class="field"><label>${tFn("creator.rel.filter_faction", "Faction")}</label><select id="relFilterFaction">${relFilterFactionOptionsHTML(b)}</select></div>
      <div class="field"><label>${tFn("creator.rel.filter_depth", "Độ sâu (liên quan gián tiếp)")}</label><select id="relFilterDepth"><option value="1">1 — ${tFn("creator.rel.depth_direct", "trực tiếp")}</option><option value="2" selected>2 — ${tFn("creator.rel.depth_one", "qua 1 trung giới")}</option><option value="3">3 — ${tFn("creator.rel.depth_two", "qua 2")}</option><option value="4">4 — ${tFn("creator.rel.depth_three", "qua 3")}</option><option value="99">∞ — ${tFn("creator.rel.depth_all", "tất")}</option></select></div>
      <div class="field"><label>${tFn("creator.rel.scope", "Thời điểm áp dụng")}</label><select id="relScopeSel">${relScopeOptionsHTML(b, "")}</select></div>
      <div class="rel-view-btns"><button class="btn small secondary" id="relLayoutBtn">${tFn("creator.rel.layout", "Xắp xếp tự động")}</button><button class="btn small ghost" id="relResetBtn">${tFn("creator.rel.reset", "Đặt lại")}</button></div>
    </div>
    <div class="rel-canvas-wrap"><div class="rel-canvas" id="relCanvas"><div class="rel-scene" id="relScene"></div><div class="rel-tip"></div></div></div>
    <div class="rel-detail" id="relDetail"></div>`;
}
function relationsSectionHTML(b) {
    const rels = b.relations || [];
    const subs = [
        ["list", tFn("creator.sub.list", "Danh sách")],
        ["diagram", tFn("creator.rel.diagram_title", "Sơ đồ quan hệ")],
    ];
    const body =
        state.relTab === "diagram"
            ? `<div class="card" style="padding:0">${relationDiagramHTML(b)}</div>`
            : `<div class="grid cards" data-draglist="relations">${
                  rels
                      .map((x) => dragRowHTML(relationCard(b, x), x.id))
                      .join("") ||
                  `<div class="card empty" style="grid-column:1/-1"><strong>${tFn("creator.tab.relations", "Mối quan hệ")}</strong>${tFn("creator.ent.empty_hint", "Thêm dữ liệu để xây dựng thế giới truyện.")}</div>`
              }${rels.length ? `<div class="ent-nomatch" hidden>${tFn("creator.ent.no_result", "Không tìm thấy kết quả nào.")}</div>` : ""}</div>`;
    return `<div class="toolbar"><div><h2 style="margin:0">${tFn("creator.tab.relations", "Mối quan hệ")}</h2><div class="muted">${rels.length} ${tFn("creator.ent.count", "mục")} · ${tFn("creator.rel.diagram_hint2", "nót = nhân vật / thế lực, cạnh = quan hệ theo chương / arc")}</div></div>${state.relTab === "list" ? `<input class="ent-search" type="search" data-entsearch placeholder="${tFn("creator.ent.search_ph", "Tìm theo tên / thẻ...")}" aria-label="${tFn("creator.ent.search_ph", "Tìm theo tên / thẻ...")}">` : ""}<button class="btn primary" data-add="relation">${tFn("creator.ent.add", "＋ Thêm")}</button></div><div class="tabs subtabs">${subs
        .map(
            ([k, t]) =>
                `<button class="tab ${state.relTab === k ? "active" : ""}" data-reltab="${k}">${t}</button>`,
        )
        .join("")}</div>${body}`;
}
async function deleteTimeline(id) {
    if (!confirm(tFn("creator.tl.confirm_del", "Xóa mốc timeline này?")))
        return;
    const b = await getBook(state.bookId);
    if (!b) return;
    b.timeline = (b.timeline || []).filter((x) => x.id !== id);
    await putBook(b);
    toast(tFn("creator.tl.toast_deleted", "Đã xóa timeline"));
    render();
}
async function saveRelGraph() {
    const b =
        relChartBook || (state.bookId ? await getBook(state.bookId) : null);
    if (b) await putBook(b);
}

function showRelNodeDetail(b, key) {
    const chart = relationChart(b);
    const n = chart.byKey.get(key);
    const d = $("#relDetail");
    if (!n) {
        if (d) d.innerHTML = "";
        return;
    }
    const subs = nodeFactions(b, n, chart.edges)
        .map((x) => `<span class="badge">${esc(x)}</span>`)
        .join("");
    const rels = (b.relations || []).filter(
        (r) =>
            r.fromId === n.id ||
            r.toId === n.id ||
            r.from === n.name ||
            r.to === n.name,
    ).length;
    const kind =
        n.kind === "faction"
            ? tFn("creator.tab.factions", "Thế lực")
            : n.kind === "character"
              ? tFn("creator.tab.characters", "Nhân vật")
              : tFn("creator.rel.stub", "tạm");
    d.innerHTML = `<strong>${esc(n.name)}</strong> <span class="badge">${kind}</span><span class="badge">${rels} ${tFn("creator.rel.edge_count", "quan hệ")}</span>${subs}${n.kind === "character" || n.kind === "faction" ? `<div class="actions" style="margin-top:10px"><button class="btn small secondary" data-rel-edit-node>${tFn("creator.ch.edit", "Sửa")}</button></div>` : ""}`;
    const btn = d.querySelector("[data-rel-edit-node]");
    if (btn)
        btn.onclick = () =>
            openEntityModal(
                n.kind === "faction" ? "faction" : "character",
                n.id,
            );
}

function showRelEdgeDetail(b, relId) {
    const d = $("#relDetail");
    const raw = (b.relations || []).find((x) => x.id === relId);
    if (!raw) return;
    const scope = ($("#relScopeSel") || {}).value || "latest";
    const snap = relSnapAt(relSnapshots(b, raw), relMilestoneNumber(b, scope));
    const r = snap
        ? {
              ...raw,
              type: snap.type || "",
              state: snap.state || "",
              intensity: Number(snap.intensity || 0),
              description: snap.description || "",
          }
        : raw;
    const snaps = relSnapshots(b, raw);
    const chips = [];
    if (snap)
        chips.push(`<span class="badge">${esc(relSnapLabel(b, snap))}</span>`);
    chips.push(
        `<span class="badge">${snaps.length} ${tFn("creator.rel.changes_count", "lần thay đổi")}</span>`,
    );
    if (r.type) chips.push(`<span class="badge">${esc(r.type)}</span>`);
    if (r.state) chips.push(`<span class="badge">${esc(r.state)}</span>`);
    if (r.visibility && r.visibility !== "public")
        chips.push(
            `<span class="badge">${esc(r.visibility === "group" ? tFn("creator.rel.vis_group", "Bán công khai") : tFn("creator.rel.vis_secret", "Bí mật"))}</span>`,
        );
    if (typeof r.intensity === "number")
        chips.push(
            `<span class="badge" style="color:${relColor(r.intensity)}">${r.intensity > 0 ? "+" : ""}${r.intensity} · ${relIntLabel(r.intensity)}</span>`,
        );
    d.innerHTML = `<strong>${esc(r.from)}</strong> → <strong>${esc(r.to)}</strong><div class="meta">${chips.join("")}</div><div class="muted">${esc(r.description || "")}</div><div class="actions" style="margin-top:10px"><button class="btn small secondary" data-rel-edit-edge>${tFn("creator.ch.edit", "Sửa")}</button><button class="btn small danger" data-rel-del-edge>${tFn("creator.ch.delete", "Xóa")}</button></div>`;
    d.querySelector("[data-rel-edit-edge]").onclick = () =>
        openRelationDialog(r.id);
    d.querySelector("[data-rel-del-edge]").onclick = () =>
        removeEntity("relation", r.id);
}
function relBindControls(c, scene, view) {
    [
        "relFilterNode",
        "relFilterType",
        "relFilterFaction",
        "relFilterDepth",
        "relScopeSel",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el)
            el.addEventListener("change", () => {
                if (relChartBook) renderRelationDiagram(relChartBook);
            });
    });
    const lb = $("#relLayoutBtn");
    if (lb)
        lb.onclick = () => {
            if (relChartBook) {
                relChartBook.relationGraph = { nodes: {} };
                renderRelationDiagram(relChartBook);
            }
        };
    const rb = $("#relResetBtn");
    if (rb)
        rb.onclick = () => {
            $("#relFilterNode").value = "";
            $("#relFilterType").value = "";
            $("#relFilterFaction").value = "";
            $("#relScopeSel").value = "latest";
            $("#relFilterDepth").value = "2";
            if (relChartBook) relChartBook.relationGraph = { nodes: {} };
            view.vx = 0;
            view.vy = 0;
            scene.style.transform = "translate(0,0)";
            if (relChartBook) renderRelationDiagram(relChartBook);
        };
}

function bindRelationDiagram() {
    const c = $("#relCanvas");
    if (!c) return;
    const scene = $("#relScene") || c.querySelector(".rel-scene");
    if (!scene) return;
    const view = {
        vx: Number(c.dataset.vx || 0),
        vy: Number(c.dataset.vy || 0),
    };
    const drag = {
        mode: null,
        node: null,
        offX: 0,
        offY: 0,
        fromNode: null,
        fromKey: null,
        fromP: null,
        hoverNode: null,
        line: null,
        panX: 0,
        panY: 0,
        moved: false,
    };
    scene.style.transform = `translate(${view.vx}px,${view.vy}px)`;
    const nodePos = () =>
        relChartBook && relChartBook.relationGraph
            ? relChartBook.relationGraph.nodes
            : {};
    relBindPointers(c, scene, drag, view, nodePos);
    relBindControls(c, scene, view);

    if (state.bookId)
        getBook(state.bookId).then((b) => b && renderRelationDiagram(b));
}
function relBindPointers(c, scene, drag, view, nodePos) {
    const onMove = (ev) => {
        if (!drag.mode) return;
        const rect = c.getBoundingClientRect();
        const x = ev.clientX - rect.left - view.vx,
            y = ev.clientY - rect.top - view.vy;
        drag.moved = true;
        if (drag.mode === "move" && drag.node) {
            const p = nodePos()[drag.node.dataset.key];
            if (p) {
                p[0] = x - drag.offX;
                p[1] = y - drag.offY;

                const sz = relNodeSize(drag.node.dataset.key);
                drag.node.style.left = p[0] - (sz ? sz[0] / 2 : 75) + "px";
                drag.node.style.top = p[1] - (sz ? sz[1] / 2 : 25) + "px";

                scheduleUpdateLines(drag.node.dataset.key);
            }
        } else if (drag.mode === "connect" && drag.line) {
            relUpdateConnectLine(drag, x, y);

            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const under = el && el.closest ? el.closest(".rel-node") : null;
            const target = under && under !== drag.fromNode ? under : null;
            if (drag.hoverNode && drag.hoverNode !== target)
                drag.hoverNode.classList.remove("rel-connect-hover");
            if (target) target.classList.add("rel-connect-hover");
            drag.hoverNode = target;
        } else if (drag.mode === "pan") {
            view.vx = ev.clientX - drag.panX;
            view.vy = ev.clientY - drag.panY;
            scene.style.transform = `translate(${view.vx}px,${view.vy}px)`;
        }
    };
    const onUp = (ev) => {
        if (!drag.mode) return;
        if (drag.mode === "move") {
            if (drag.moved) {
                updateLines();
                saveRelGraph();
            }
            if (!drag.moved && drag.node) {
                $$(".rel-node").forEach((n) =>
                    n.classList.toggle(
                        "rel-selected",
                        n.dataset.key === drag.node.dataset.key,
                    ),
                );
                const sel = $("#relFilterNode");
                if (
                    sel &&
                    [...sel.options].some(
                        (o) => o.value === drag.node.dataset.key,
                    )
                )
                    sel.value = drag.node.dataset.key;
                if (relChartBook)
                    showRelNodeDetail(relChartBook, drag.node.dataset.key);
            }
        }
        if (drag.mode === "connect") {
            if (ev.type !== "pointercancel" && drag.fromKey && drag.moved) {
                const el = document.elementFromPoint(ev.clientX, ev.clientY);
                const target = el && el.closest(".rel-node");
                if (
                    target &&
                    target !== drag.fromNode &&
                    target.dataset.key !== drag.fromKey
                ) {
                    openRelationDialog(
                        null,
                        drag.fromKey,
                        target.dataset.key,
                        ($("#relScopeSel") || {}).value || "",
                        null,
                    );
                }
            }
            if (drag.line && drag.line.parentNode)
                drag.line.parentNode.removeChild(drag.line);
        }
        if (drag.hoverNode) {
            drag.hoverNode.classList.remove("rel-connect-hover");
            drag.hoverNode = null;
        }
        scene.style.cursor = "";
        c.style.cursor = "";
        drag.mode = null;
        drag.node = null;
        drag.line = null;
        drag.fromNode = null;
        drag.fromP = null;
        relDragBusy = false;

        if (relRenderQueued) {
            relRenderQueued = false;
            if (relChartBook) renderRelationDiagram(relChartBook);
        }
    };
    const onDown = (e) => {
        const node = e.target.closest(".rel-node");
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left - view.vx,
            y = e.clientY - rect.top - view.vy;
        if (node) {
            if (
                e.button === 2 ||
                (e.button === 0 && !e.target.closest(".rel-port"))
            ) {
                drag.mode = "move";
                drag.node = node;
                drag.moved = false;
                const p = nodePos()[node.dataset.key] || [x, y];
                drag.offX = x - p[0];
                drag.offY = y - p[1];
                scene.style.cursor = "grabbing";
            } else if (e.target.closest(".rel-port")) {
                drag.mode = "connect";
                drag.fromNode = node;
                drag.fromKey = node.dataset.key;
                drag.moved = false;
                const p = nodePos()[node.dataset.key] || [x, y];
                drag.fromP = [p[0], p[1]];
                const svg = scene.querySelector("svg");
                if (svg) {
                    const dx = x - p[0],
                        dy = y - p[1];
                    const len = Math.hypot(dx, dy) || 1;
                    const sz = relNodeSize(drag.fromKey);
                    const o1 = sz
                        ? relBoundaryInset(sz[0], sz[1], dx / len, dy / len, 6)
                        : 24;
                    const sx = p[0] + (dx / len) * Math.min(o1, len),
                        sy = p[1] + (dy / len) * Math.min(o1, len);
                    const ln = document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "path",
                    );
                    ln.setAttribute("fill", "none");
                    ln.style.stroke = "var(--primary)";
                    ln.setAttribute("stroke-width", "2");
                    ln.setAttribute("stroke-dasharray", "6 5");
                    ln.setAttribute("stroke-linecap", "round");
                    ln.setAttribute("d", relBezier(sx, sy, x, y).d);
                    svg.appendChild(ln);
                    drag.line = ln;
                }
            }
        } else {
            drag.mode = "pan";
            drag.panX = e.clientX - view.vx;
            drag.panY = e.clientY - view.vy;
            c.style.cursor = "grabbing";
        }
        relDragBusy = true;
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        e.preventDefault();
    };
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("contextmenu", (e) => {
        if (e.target.closest(".rel-node") || e.target === c) e.preventDefault();
    });
    c.addEventListener("dblclick", (e) => {
        const node = e.target.closest(".rel-node");
        if (!node || !relChartBook) return;
        const n = relationChart(relChartBook).byKey.get(node.dataset.key);
        if (!n || (n.kind !== "character" && n.kind !== "faction")) return;
        openEntityModal(n.kind === "faction" ? "faction" : "character", n.id);
    });
    scene.addEventListener("click", (e) => {
        const edge = e.target.closest(".rel-edge");
        if (!edge) return;
        if (relChartBook) showRelEdgeDetail(relChartBook, edge.dataset.rel);
    });
}
function relationDiagramFilters() {
    return {
        node: ($("#relFilterNode") || {}).value || "",
        type: ($("#relFilterType") || {}).value || "",
        faction: ($("#relFilterFaction") || {}).value || "",
        depth: Number(($("#relFilterDepth") || {}).value || 2),
        scope: ($("#relScopeSel") || {}).value || "latest",
    };
}

function relationDiagramData(b, chart, f) {
    const milestoneNum = relMilestoneNumber(b, f.scope);
    const edges = [];
    for (const e of chart.edges) {
        if (f.type && String(e.r.type || "") !== f.type) continue;
        const snap = relSnapAt(relSnapshots(b, e.r), milestoneNum);
        if (!snap) continue;
        edges.push({
            ...e,
            r: {
                ...e.r,
                type: snap.type || "",
                state: snap.state || "",
                intensity: Number(snap.intensity || 0),
                description: snap.description || "",
            },
        });
    }
    const visible = new Set(),
        shown = [];

    if (!f.node && !f.faction) {
        edges.forEach((e) => {
            visible.add(e.from.key);
            visible.add(e.to.key);
            shown.push(e);
        });
        return { visible, shown };
    }
    const depthOf = new Map();
    let seeds = [];
    if (f.node) {
        const s = chart.byKey.get(f.node);
        if (!s) return { visible, shown: [] };
        seeds = [s];
    } else if (f.faction) {
        seeds = chart.nodes.filter((n) =>
            nodeFactions(b, n, edges).includes(f.faction),
        );
    }
    for (const s of seeds) {
        visible.add(s.key);
        depthOf.set(s.key, 0);
    }
    const queue = [...seeds];
    while (queue.length) {
        const u = queue.shift();
        const d = depthOf.get(u.key);
        if (d >= f.depth) continue;
        for (const e of edges) {
            const nb =
                e.from.key === u.key
                    ? e.to
                    : e.to.key === u.key
                      ? e.from
                      : null;
            if (nb && !visible.has(nb.key)) {
                visible.add(nb.key);
                depthOf.set(nb.key, d + 1);
                queue.push(nb);
            }
        }
    }
    for (const e of edges)
        if (visible.has(e.from.key) && visible.has(e.to.key)) shown.push(e);
    return { visible, shown };
}

function relBoundaryInset(w, h, ux, uy, pad) {
    const p = pad || 0;
    const ix = ux ? (w / 2 + p) / Math.abs(ux) : Infinity;
    const iy = uy ? (h / 2 + p) / Math.abs(uy) : Infinity;
    return Math.min(ix, iy);
}

function relEdgePoints(p1, p2, s1, s2) {
    const dx = p2[0] - p1[0],
        dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (!len) return [p1[0], p1[1], p2[0], p2[1]];
    const ux = dx / len,
        uy = dy / len;
    let o1 = s1 ? relBoundaryInset(s1[0], s1[1], ux, uy, 4) : 24;
    let o2 = s2 ? relBoundaryInset(s2[0], s2[1], ux, uy, 4) : 24;
    o1 = Math.min(o1, len / 2);
    o2 = Math.min(o2, len / 2);
    const sx = p1[0] + ux * o1,
        sy = p1[1] + uy * o1,
        tx = p2[0] - ux * o2,
        ty = p2[1] - uy * o2;
    if (Math.hypot(tx - sx, ty - sy) < 4) return [p1[0], p1[1], p2[0], p2[1]];
    return [sx, sy, tx, ty];
}

function relBezier(x1, y1, x2, y2) {
    const dx = x2 - x1,
        dy = y2 - y1;
    const off = Math.min(Math.hypot(dx, dy) * 0.45, 110);
    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) >= Math.abs(dy)) {
        const s = dx >= 0 ? 1 : -1;
        c1x = x1 + off * s;
        c1y = y1;
        c2x = x2 - off * s;
        c2y = y2;
    } else {
        const s = dy >= 0 ? 1 : -1;
        c1x = x1;
        c1y = y1 + off * s;
        c2x = x2;
        c2y = y2 - off * s;
    }
    return {
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,

        mx: (x1 + 3 * c1x + 3 * c2x + x2) / 8,
        my: (y1 + 3 * c1y + 3 * c2y + y2) / 8,
    };
}

function relCacheDiagramScene(scene, shown) {
    const paths = new Map(),
        labels = new Map(),
        nodes = new Map();
    scene.querySelectorAll(".rel-edge").forEach((g) => {
        const p = g.querySelector("path");
        if (p) paths.set(g.dataset.rel, p);
    });
    scene
        .querySelectorAll(".rel-edge-text")
        .forEach((t) => labels.set(t.dataset.rel, t));
    scene.querySelectorAll(".rel-node").forEach((el) =>
        nodes.set(el.dataset.key, {
            el,
            w: el.offsetWidth || 150,
            h: el.offsetHeight || 50,
        }),
    );
    relEdgeCache = {
        scene,
        paths,
        labels,
        nodes,
        edges: (shown || []).map((e) => ({
            id: String(e.r.id),
            from: e.from.key,
            to: e.to.key,
        })),
    };
}

function relNodeSize(key) {
    const n = relEdgeCache && relEdgeCache.nodes.get(key);
    return n ? [n.w, n.h] : null;
}

function updateLines(onlyKey) {
    if (!relEdgeCache || !relChartBook || !relChartBook.relationGraph) return;
    const pos = relChartBook.relationGraph.nodes || {};
    for (const e of relEdgeCache.edges) {
        if (onlyKey && e.from !== onlyKey && e.to !== onlyKey) continue;
        const path = relEdgeCache.paths.get(e.id);
        if (!path) continue;
        const p1 = pos[e.from],
            p2 = pos[e.to];
        if (!p1 || !p2) continue;
        const [sx, sy, tx, ty] = relEdgePoints(
            p1,
            p2,
            relNodeSize(e.from),
            relNodeSize(e.to),
        );
        const bez = relBezier(sx, sy, tx, ty);
        if (path.getAttribute("d") !== bez.d) path.setAttribute("d", bez.d);
        const label = relEdgeCache.labels.get(e.id);
        if (label)
            label.setAttribute(
                "transform",
                `translate(${bez.mx.toFixed(1)},${bez.my.toFixed(1)})`,
            );
    }
}

function scheduleUpdateLines(onlyKey) {
    if (onlyKey) relLinePending.add(onlyKey);
    if (relLineRaf) return;
    relLineRaf = requestAnimationFrame(() => {
        relLineRaf = 0;
        const keys = [...relLinePending];
        relLinePending.clear();
        if (!keys.length) updateLines();
        else keys.forEach((k) => updateLines(k));
    });
}

function relUpdateConnectLine(drag, x, y) {
    if (!drag.line || !drag.fromP) return;
    const dx = x - drag.fromP[0],
        dy = y - drag.fromP[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
        uy = dy / len;
    const sz = relNodeSize(drag.fromKey);
    const o1 = sz ? relBoundaryInset(sz[0], sz[1], ux, uy, 6) : 24;
    const sx = drag.fromP[0] + ux * Math.min(o1, len),
        sy = drag.fromP[1] + uy * Math.min(o1, len);
    drag.line.setAttribute("d", relBezier(sx, sy, x, y).d);
}

function renderRelationDiagram(b) {
    if (relDragBusy) {
        relRenderQueued = true;
        return;
    }
    relChartBook = b;
    const c = $("#relCanvas");
    if (!c) return;
    const scene = $("#relScene") || c.querySelector(".rel-scene");
    if (!scene) return;
    let vx = Number(c.dataset.vx || 0),
        vy = Number(c.dataset.vy || 0);
    const chart = relationChart(b);
    const f = relationDiagramFilters();
    const data = relationDiagramData(b, chart, f);
    if (!b.relationGraph || typeof b.relationGraph !== "object")
        b.relationGraph = {};
    const g = (b.relationGraph.nodes = b.relationGraph.nodes || {});
    const W = c.clientWidth || 900,
        H = 560;
    const R =
        Math.max(90, ((chart.nodes.length - 1) * 70) / (2 * Math.PI)) + 80;
    chart.nodes.forEach((n, i) => {
        if (typeof g[n.key] === "undefined") {
            const ang =
                (i / Math.max(chart.nodes.length, 1)) * 2 * Math.PI -
                Math.PI / 2;
            g[n.key] = [W / 2 + Math.cos(ang) * R, H / 2 + Math.sin(ang) * R];
        }
    });
    let edgesHtml = "";
    for (const e of data.shown) {
        const p1 = g[e.from.key],
            p2 = g[e.to.key];
        if (!p1 || !p2) continue;
        const col = relColor(e.r.intensity || 0);
        const [sx, sy, tx, ty] = relEdgePoints(
            p1,
            p2,
            relNodeSize(e.from.key) || [150, 50],
            relNodeSize(e.to.key) || [150, 50],
        );
        const bez = relBezier(sx, sy, tx, ty);
        const label = esc(e.r.type || tFn("creator.rel.unknown", "quan hệ"));
        const bw = label.length * 7 + 8;
        edgesHtml += `<g class="rel-edge" data-rel="${e.r.id}" style="cursor:pointer"><title>${label}</title><path d="${bez.d}" fill="none" stroke="${col}" stroke-width="2.5" marker-end="url(#relArrow)"/></g>`;
        edgesHtml += `<g class="rel-edge-text" data-rel="${e.r.id}" transform="translate(${bez.mx.toFixed(1)},${bez.my.toFixed(1)})"><rect x="${(-bw / 2).toFixed(1)}" y="-10" width="${bw}" height="15" rx="4" fill="var(--card-bg)" stroke="var(--border)"/><text x="0" y="0" dominant-baseline="central" text-anchor="middle" fill="${col}">${label}</text></g>`;
    }
    const focusKey = f.node;
    let nodesHtml = "";
    for (const key of data.visible) {
        const n = chart.byKey.get(key);
        if (!n) continue;
        const p = g[key];
        const subs = nodeFactions(b, n, data.shown)
            .map((x) => `<span class="rel-faction-chip">${esc(x)}</span>`)
            .join("");
        nodesHtml += `<div class="rel-node ${n.kind}${key === focusKey ? " rel-selected" : ""}" data-key="${key}" style="left:${p[0] - 75}px;top:${p[1] - 25}px" title="${esc(n.name)}"><span class="rel-port" title="${tFn("creator.rel.port", "Kéo để tạo quan hệ")}"></span><span class="rel-name">${esc(n.name)}</span>${subs ? `<span class="rel-sub">${subs}</span>` : ""}<span class="rel-kind">${n.kind === "faction" ? tFn("creator.rel.faction", "thế lực") : n.kind === "character" ? tFn("creator.rel.character", "nhân vật") : tFn("creator.rel.stub", "tạm")}</span></div>`;
    }
    scene.style.width = W + "px";
    scene.style.height = H + "px";
    scene.style.transform = `translate(${vx}px,${vy}px)`;
    scene.innerHTML = `<svg class="rel-edges" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><marker id="relArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="rel-arrow" d="M0 0 L9 4 L11 5 L9 6 L0 10 z"/></marker></defs>${edgesHtml}</svg><div class="rel-layer">${nodesHtml}</div>`;

    relCacheDiagramScene(scene, data.shown);

    relEdgeCache.nodes.forEach(({ el, w, h }, key) => {
        const p = g[key];
        if (!p) return;
        el.style.left = p[0] - w / 2 + "px";
        el.style.top = p[1] - h / 2 + "px";
    });

    updateLines();
}
function relKeyForEndpoint(b, rel, side) {
    const refId = side === "from" ? rel.fromId : rel.toId;
    const name = side === "from" ? rel.from : rel.to;
    const chart = relationChart(b);
    if (refId) {
        const n =
            chart.byKey.get("c:" + refId) ||
            chart.byKey.get("f:" + refId) ||
            chart.byKey.get("n:" + refId);
        if (n) return n.key;
    }
    if (name) {
        for (const n of chart.nodes) if (n.name === name) return n.key;
        return "n:" + name;
    }
    return "";
}
function relFormHTML(b, rel, o) {
    const snaps = rel ? relSnapshots(b, rel) : [];
    const historyRows = snaps
        .slice()
        .reverse()
        .map(
            (s) =>
                `<div class="rel-hist-row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px 0;border-bottom:1px dashed var(--border)"><span class="badge">${esc(relSnapLabel(b, s))}</span>${s.type ? `<span class="badge">${esc(s.type)}</span>` : ""}${s.state ? `<span class="badge">${esc(s.state)}</span>` : ""}<span class="badge" style="color:${relColor(Number(s.intensity || 0))}">${relIntLabel(Number(s.intensity || 0))}</span></div>`,
        )
        .join("");
    return `<form id="entityForm" class="form rel-form" novalidate>
  <div class="card rel-intro"><p class="rel-step">${tFn("creator.rel.intro_step", "BƯỚC NHANH · 3 THÔNG TIN")}</p><p class="muted">${tFn("creator.rel.intro_hint", "Ai đang hướng cảm xúc hoặc hành động đến ai, và đó là quan hệ gì?")}</p></div>
  <div class="form-row rel-3col">
    <div class="field"><label>${tFn("creator.rel.from_char", "Từ nhân vật/thế lực")}</label><select name="fromKey" required>${relEndpointOptionsHTML(b, o.fromKey)}</select><div class="rel-err" id="relErrFrom"></div><button type="button" class="btn small secondary rel-create" data-create="character">＋ ${tFn("creator.rel.create_char", "Tạo nhân vật")}</button></div>
    <button type="button" class="btn ghost rel-swap" id="relSwap" title="${tFn("creator.rel.swap", "Đổi chiều hai nhân vật")}" aria-label="${tFn("creator.rel.swap", "Đổi chiều")}">⇄</button>
    <div class="field"><label>${tFn("creator.rel.to_char", "Hướng đến nhân vật/thế lực")}</label><select name="toKey" required>${relEndpointOptionsHTML(b, o.toKey)}</select><div class="rel-err" id="relErrTo"></div><button type="button" class="btn small secondary rel-create" data-create="faction">＋ ${tFn("creator.rel.create_faction", "Tạo thế lực")}</button></div>
  </div>
  <div class="field"><label>${tFn("creator.rel.type_label", "Loại quan hệ")}</label><input name="rtype" list="relTypeSuggest" value="${esc(o.rtype)}" placeholder="${tFn("creator.rel.type_ph", "Ví dụ: Đồng đội, người giám sát, mục tiêu nhiệm vụ…")}"></div>
  <div class="card rel-adv">
    <button type="button" class="rel-adv-toggle" id="relAdvToggle" aria-expanded="true"><span class="rel-adv-title">⚙ ${tFn("creator.rel.adv_toggle", "Chi tiết nâng cao")} <span class="muted">${tFn("creator.rel.adv_hint", "Trạng thái, mức độ và mô tả")}</span></span><span class="rel-adv-arrow">▾</span></button>
    <div class="rel-adv-body open" id="relAdvBody">
      <div class="field"><label>${tFn("creator.rel.state", "Trạng thái hiện tại")}</label><input name="state" list="relStateSuggest" value="${esc(o.st)}" placeholder="${tFn("creator.rel.state_ph", "Chọn gợi ý hoặc tự nhập")}"></div>
      <div class="field rel-intensity"><label>${tFn("creator.rel.intensity", "Mức độ gần gũi hay đối đầu")}</label><div class="rel-intensity-box"><div class="rel-intensity-labels"><span class="danger">${tFn("creator.rel.oppose", "Đối đầu")}</span><output id="relIntOut">${relIntLabel(o.inten)}</output><span class="success">${tFn("creator.rel.close", "Gắn bó")}</span></div><input type="range" id="relIntensity" name="intensity" min="-5" max="5" step="1" value="${o.inten}"><div class="rel-intensity-ticks"><span>${tFn("creator.rel.very_tense", "Rất căng thẳng")}</span><span>${tFn("creator.rel.neutral", "Trung tính")}</span><span>${tFn("creator.rel.very_close", "Rất gần gũi")}</span></div></div></div>
      <div class="field"><label>${tFn("creator.rel.scope", "Thời điểm áp dụng")}</label><select name="scope" id="relMilestoneSel">${relMilestoneOptionsHTML(b, o.scope)}</select><div class="muted" style="font-size:12px">${tFn("creator.rel.scope_hint", "Mỗi chương chỉ giữ một trạng thái. Trạng thái tại một chương lấy theo lần thay đổi gần nhất của chương đó.")}</div></div>
      ${historyRows ? `<div class="field"><label>${tFn("creator.rel.history", "Lịch sử thay đổi")}</label><div class="rel-history">${historyRows}</div></div>` : ""}
      <div class="field"><label>${tFn("creator.form.desc", "Mô tả")}</label><textarea name="description" placeholder="${tFn("creator.rel.desc_ph", "Điều gì khiến mối quan hệ này đáng nhớ?")}">${esc(o.desc)}</textarea></div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn primary">${tFn("creator.f.save_rel", "Lưu quan hệ")}</button></div>
</form>`;
}
function openRelationDialog(
    id = null,
    presetFrom = null,
    presetTo = null,
    presetScope = null,
    draft = null,
) {
    getBook(state.bookId).then((b) => {
        b.relations = b.relations || [];
        const rel = id ? b.relations.find((r) => r.id === id) : null;
        const chapters = [...(b.chapters || [])].sort(
            (x, y) => (x.number || 0) - (y.number || 0),
        );
        const latestCh = chapters[chapters.length - 1] || null;
        let fromKey = "",
            toKey = "",
            rtype = "",
            desc = "",
            st = "",
            inten = 0,
            scope = "";
        if (draft) {
            fromKey = draft.from || "";
            toKey = draft.to || "";
            rtype = draft.rtype || "";
            st = draft.state || "";
            inten = Number(draft.intensity || 0);
            scope = draft.scope || presetScope || "";
            desc = draft.description || "";
        } else if (rel) {
            fromKey = relKeyForEndpoint(b, rel, "from");
            toKey = relKeyForEndpoint(b, rel, "to");
            const snaps = relSnapshots(b, rel);
            const lastSnap = snaps[snaps.length - 1] || null;
            rtype = lastSnap ? lastSnap.type || "" : "";
            st = lastSnap ? lastSnap.state || "" : "";
            inten = Number(lastSnap ? lastSnap.intensity || 0 : 0);
            desc = lastSnap ? lastSnap.description || "" : "";
            scope =
                presetScope ||
                (lastSnap && lastSnap.chapterId
                    ? "chapter:" + lastSnap.chapterId
                    : "");
        } else {
            fromKey = presetFrom || "";
            toKey = presetTo || "";
            scope = presetScope || "";
        }
        if (
            (!scope ||
                scope === "latest" ||
                !chapters.some((c) => "chapter:" + c.id === scope)) &&
            latestCh
        )
            scope = "chapter:" + latestCh.id;
        const m = $("#modal");
        m.innerHTML = `<div class="modal-card rel-modal"><div class="modal-head"><strong>${rel ? tFn("creator.modal.edit", "Chỉnh sửa") : tFn("creator.modal.add", "Thêm")} ${tFn("creator.type.relation", "mối quan hệ")}</strong><button class="icon-btn" id="relClose">×</button></div><div class="modal-body">${relFormHTML(
            b,
            rel,
            {
                fromKey,
                toKey,
                rtype,
                desc,
                st,
                inten,
                scope,
            },
        )}</div></div>`;
        m.showModal();
        $("#relClose").onclick = () => {
            relDraft = null;
            m.close();
        };
        $("#relSwap").onclick = () => {
            const f = $("#entityForm [name=fromKey]"),
                t = $("#entityForm [name=toKey]");
            const tmp = f.value;
            f.value = t.value;
            t.value = tmp;
        };
        $("#relAdvToggle").addEventListener("click", () => {
            const body = $("#relAdvBody"),
                btn = $("#relAdvToggle");
            const open = body.classList.toggle("open");
            btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        $("#relIntensity").addEventListener("input", () => {
            $("#relIntOut").textContent = relIntLabel($("#relIntensity").value);
        });
        $("#entityForm [name=scope]").addEventListener("change", () => {
            const sel = $("#entityForm [name=scope]");
            const c = chapters.find((x) => "chapter:" + x.id === sel.value);
            if (!c) return;
            const snap = relSnapAt(
                rel ? relSnapshots(b, rel) : [],
                c.number || 0,
            );
            $("#entityForm [name=rtype]").value = snap ? snap.type || "" : "";
            $("#entityForm [name=state]").value = snap ? snap.state || "" : "";
            $("#entityForm [name=intensity]").value = snap
                ? Number(snap.intensity || 0)
                : 0;
            $("#relIntOut").textContent = relIntLabel(
                $("#entityForm [name=intensity]").value,
            );
            $("#entityForm [name=description]").value = snap
                ? snap.description || ""
                : "";
        });
        $$("#entityForm .rel-create").forEach((btn) => {
            btn.onclick = () => {
                relDraft = {
                    id: rel ? rel.id : null,
                    from: $("#entityForm [name=fromKey]").value,
                    to: $("#entityForm [name=toKey]").value,
                    rtype: $("#entityForm [name=rtype]").value,
                    state: $("#entityForm [name=state]").value,
                    intensity: $("#entityForm [name=intensity]").value,
                    scope: $("#entityForm [name=scope]").value,
                    description: $("#entityForm [name=description]").value,
                };
                m.close();
                openEntityModal(btn.dataset.create);
            };
        });
        $("#entityForm").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const fromKey = fd.get("fromKey"),
                toKey = fd.get("toKey");
            if (!fromKey || !toKey) {
                $("#relErrFrom").textContent = fromKey
                    ? ""
                    : tFn(
                          "creator.rel.invalid_empty",
                          "Bắt buộc chọn nhân vật / thế lực",
                      );
                $("#relErrTo").textContent = toKey
                    ? ""
                    : tFn(
                          "creator.rel.invalid_empty",
                          "Bắt buộc chọn nhân vật / thế lực",
                      );
                toast(
                    tFn("creator.rel.need_ends", "Chọn cả hai đầu mối quan hệ"),
                );
                return;
            }
            if (fromKey === toKey) {
                toast(
                    tFn(
                        "creator.rel.invalid_same",
                        "Không thể tạo quan hệ với chính mình",
                    ),
                );
                return;
            }
            const parse = (k) => {
                const p = k.indexOf(":");
                return { kind: k.slice(0, p), id: k.slice(p + 1) };
            };
            const pf = parse(fromKey),
                pt = parse(toKey);
            const chart = relationChart(b);
            const nf = chart.byKey.get(fromKey),
                nt = chart.byKey.get(toKey);
            const x = rel || { id: uid(), createdAt: now() };
            x.from = nf ? nf.name : pf.id;
            x.fromId = pf.id;
            x.fromKind = pf.kind;
            x.to = nt ? nt.name : pt.id;
            x.toId = pt.id;
            x.toKind = pt.kind;
            const sc = String(fd.get("scope") || "");
            const ch = [...(b.chapters || [])].find(
                (c) => "chapter:" + c.id === sc,
            );
            if (!ch) {
                toast(
                    tFn(
                        "creator.rel.need_chapter",
                        "Cần ít nhất một chương để đặt mốc quan hệ.",
                    ),
                );
                return;
            }
            x.visibility = (rel && rel.visibility) || "public";
            const snap = {
                chapterId: ch.id,
                chapterNumber: ch.number || 0,
                type: fd.get("rtype").trim(),
                state: fd.get("state").trim(),
                intensity: Number(fd.get("intensity")) || 0,
                description: fd.get("description").trim(),
                visibility: x.visibility,
                updatedAt: now(),
            };
            const rest = (rel ? relSnapshots(b, rel) : []).filter(
                (s) => s.chapterId !== ch.id,
            );
            x.snapshots = relSortedSnaps([...rest, snap]);
            delete x.type;
            delete x.state;
            delete x.intensity;
            delete x.description;
            delete x.scopeType;
            delete x.scopeRef;
            x.updatedAt = now();
            if (!rel) b.relations.push(x);
            await putBook(b);
            m.close();
            toast(tFn("creator.toast.saved", "Đã lưu"));
            render();
        };
    });
}
async function download(blob, name) {
    if (window.CapacitorFileBridge) {
        await window.CapacitorFileBridge.downloadFile(blob, name);
        return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bookText(b) {
    let out = `${b.title}\n\n${b.description || ""}\n\n${"=".repeat(70)}\n`;
    for (const c of [...b.chapters].sort((a, z) => a.number - z.number))
        out += `\nCHƯƠNG ${c.number}: ${c.title}\n\n${c.content || ""}\n\n${"=".repeat(70)}\n`;
    return out;
}
const IMAGE_KEYS = ["cover", "illustration.icon", "illustration.portrait"];
function collectImagePaths(b) {
    var res = {};
    function walk(node, trail) {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) walk(node[i], trail);
            return;
        }
        if (
            node &&
            typeof node === "object" &&
            typeof node.illustration === "object" &&
            node.illustration !== null
        ) {
            if (
                typeof node.illustration.icon === "string" &&
                node.illustration.icon
            )
                res[
                    "illustration/" + (trail + "." + node.id || "id") + ".icon"
                ] = node.illustration.icon;
            if (
                typeof node.illustration.portrait === "string" &&
                node.illustration.portrait
            )
                res[
                    "illustration/" +
                        (trail + "." + node.id || "id") +
                        ".portrait"
                ] = node.illustration.portrait;
        }
        for (var k in node) {
            if (k === "illustration" || k === "cover") continue;
            walk(node[k], trail ? trail + "." + k : k);
        }
    }
    [
        "characters",
        "items",
        "itemsets",
        "abilities",
        "skillsets",
        "realms",
        "arcs",
        "timelines",
    ].forEach(function (key) {
        walk(b[key], key);
    });
    return res;
}
async function exportCreator() {
    if (!window.JSZip) {
        alert(
            tFn(
                "creator.exp.need_jszip_export",
                "Export .creator cần JSZip. Hãy mở trang khi có Internet để tải thư viện.",
            ),
        );
        return;
    }
    var b = await getBook(state.bookId);
    if (!b) return;
    var slugName = slug(b.title);
    var zip = new JSZip();
    var out = JSON.parse(JSON.stringify(b));
    out.formulas = {};
    collectSystemFormulasInto(b, out.formulas);
    var images = {};
    if (b.cover) images["cover"] = b.cover;
    var illPath = collectImagePaths(b);
    Object.keys(illPath).forEach(function (k) {
        images[k] = illPath[k];
        out.images = out.images || {};
        out.images[k] = { filename: k.split("/").pop() };
    });
    zip.file("novel.json", JSON.stringify(out, null, 2));
    Object.keys(images).forEach(function (p) {
        var b64 = images[p].split(",")[1];
        var ext = (images[p].match(/image\/([^;]+)/) || [])[1] || "png";
        if (ext === "svg+xml") ext = "svg";
        var fn = p;
        try {
            var arr = Uint8Array.from(atob(b64), function (c) {
                return c.charCodeAt(0);
            });
            zip.file(fn, arr);
        } catch (e) {}
    });
    var blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/zip",
    });
    await download(blob, slugName + ".creator");
}
async function importCreator(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!window.JSZip) {
        alert(
            tFn(
                "creator.exp.need_jszip_import",
                "Import .creator cần JSZip. Hãy mở trang khi có Internet để tải thư viện.",
            ),
        );
        e.target.value = "";
        return;
    }
    try {
        var zip = await JSZip.loadAsync(file);
        var njf = zip.file("novel.json");
        if (!njf)
            throw new Error(
                tFn(
                    "creator.toast.bad_creator",
                    "File .creator không hợp lệ: thiếu novel.json",
                ),
            );
        var jsonText = await njf.async("string");
        var data = JSON.parse(jsonText);
        if (!data.id || !data.title)
            throw new Error(tFn("creator.toast.bad_json", "JSON không hợp lệ"));
        if (data.images) {
            var keysToLoad = Object.keys(data.images);
            for (var k of keysToLoad) {
                var entry = zip.file(k);
                if (!entry) continue;
                var b64 = await entry.async("base64");
                var mime = entry.name.endsWith(".svg")
                    ? "image/svg+xml"
                    : "image/png";
                var full = "data:" + mime + ";base64," + b64;
                var parts = k.split("/");
                var leaf = parts[parts.length - 1];
                if (leaf === "cover") {
                    data.cover = full;
                } else {
                    var arr = [
                        "characters",
                        "items",
                        "itemsets",
                        "abilities",
                        "skillsets",
                        "realms",
                        "arcs",
                        "timelines",
                    ];
                    for (var ai = 0; ai < arr.length; ai++) {
                        var ak = arr[ai];
                        if (Array.isArray(data[ak])) {
                            for (var ni = 0; ni < data[ak].length; ni++) {
                                var nd = data[ak][ni];
                                if (
                                    !nd ||
                                    typeof nd !== "object" ||
                                    !nd.illustration
                                )
                                    continue;
                                var isIcon = k.indexOf(".icon") >= 0;
                                var isPort = k.indexOf(".portrait") >= 0;
                                if (
                                    (isIcon || isPort) &&
                                    nd.illustration[
                                        isIcon ? "icon" : "portrait"
                                    ] === leaf
                                )
                                    nd.illustration[
                                        isIcon ? "icon" : "portrait"
                                    ] = full;
                            }
                        }
                    }
                }
            }
        }
        await putBook(normalizeBook(data));
        toast(tFn("creator.toast.imported", "Đã import"));
        render();
    } catch (err) {
        alert(
            tFn("creator.toast.import_fail", "Import thất bại: ") + err.message,
        );
    }
    e.target.value = "";
}
function creationConfigForBook(b) {
    const lines = String(b.description || "").split(/\r?\n/);
    const config = {
        toc_name: {},
        cover_href: b.cover ? "images/cover.png" : "",
        custom_toc: {
            enabled: false,
            override_appendix: false,
            locked: false,
            appendix: {},
        },
        author: "",
        genre: {},
        desc: {},
        title: b.title || "",
        language: "",
        generate_in_ebook: { 1: "toc", 2: "cover", 3: "desc" },
        expand_parsing: false,
        render_appendix: false,
        parse: { parsing_type: "br-multiple", parent_tag: "p", child_tag: "p" },
    };
    (b.genres || []).forEach(
        (value, i) => (config.genre[String(i + 1)] = value),
    );
    lines.forEach((value, i) => (config.desc["line_" + (i + 1)] = value));
    const arcs = b.arcs || [];
    const nested = new Set(
        arcs.flatMap((arc) =>
            (arc.children || [])
                .filter((child) => child.kind === "arc")
                .map((child) => child.ref),
        ),
    );
    const collect = (arcId, seen = new Set()) => {
        if (seen.has(arcId)) return [];
        seen.add(arcId);
        const arc = arcs.find((item) => item.id === arcId);
        if (!arc) return [];
        return (arc.children || []).flatMap((child) =>
            child.kind === "chapter"
                ? [child.ref]
                : child.kind === "arc"
                  ? collect(child.ref, seen)
                  : [],
        );
    };
    arcs.filter((arc) => !nested.has(arc.id)).forEach((arc, index) => {
        const block = { id: arc.id, chapter_id: {} };
        collect(arc.id).forEach((chapterId, chapterIndex) => {
            const chapter = (b.chapters || []).find(
                (item) => item.id === chapterId,
            );
            if (chapter)
                block.chapter_id[String(chapterIndex + 1)] =
                    `${arc.id}/chapter-${(b.chapters || []).indexOf(chapter) + 1}.html`;
        });
        config.custom_toc[String(index + 1)] = block;
    });
    const hidden = b.displaySettings || {};
    const hasArcs = (b.arcs || []).length > 0;
    config.custom_toc.enabled = hasArcs;
    config.custom_toc.locked = hasArcs;
    config.custom_toc.appendix = {
        item: tFn("creator.appendix.item", "Vật phẩm"),
        itemset: tFn("creator.appendix.itemset", "Bộ vật phẩm"),
        character: tFn("creator.appendix.character", "Nhân vật"),
        faction: tFn("creator.appendix.faction", "Phe phái"),
        realms: tFn("creator.appendix.realms", "Vị diện"),
        abilities: tFn("creator.appendix.abilities", "Khả năng"),
        skillset: tFn("creator.appendix.skillset", "Kỹ năng"),
        definition: tFn("creator.appendix.definition", "Định nghĩa"),
        relations: tFn("creator.appendix.relations", "Quan hệ"),
        timeline: tFn("creator.appendix.timeline", "Timeline"),
        systems: tFn("creator.appendix.systems", "Hệ thống / Stats"),
    };
    config.appendix = {
        is_from_creator: true,
        render: {
            item: hidden.items !== "hidden",
            itemset: hidden.itemsets !== "hidden",
            character: hidden.characters !== "hidden",
            faction: hidden.factions !== "hidden",
            realms: hidden.realms !== "hidden",
            abilities: hidden.abilities !== "hidden",
            skillset: hidden.skillsets !== "hidden",
            definition: hidden.definitions !== "hidden",
            relations: hidden.relations !== "hidden",
            timeline: hidden.timeline !== "hidden",
            systems: hidden.systems !== "hidden",
        },
        path: {
            item: "appendix/item",
            itemset: "appendix/itemset",
            character: "appendix/character",
            faction: "appendix/faction",
            realms: "appendix/realms",
            abilities: "appendix/abilities",
            skillset: "appendix/skillset",
            definition: "appendix/definition",
            relations: "appendix/relations",
            timeline: "appendix/timeline",
            systems: "appendix/systems",
        },
    };
    const appendixSourceMap = [
        ["item", "items"],
        ["itemset", "itemsets"],
        ["character", "characters"],
        ["faction", "factions"],
        ["realms", "realms"],
        ["abilities", "abilities"],
        ["skillset", "skillsets"],
    ];
    appendixSourceMap.forEach(([type, sourceKey]) => {
        if (!config.appendix.render[type]) return;
        const fileMap = {};
        (b[sourceKey] || []).forEach((entity, index) => {
            fileMap[String(index + 1)] =
                `${config.appendix.path[type]}/${index + 1}.xhtml`;
        });
        if (Object.keys(fileMap).length) {
            config.custom_toc.appendix[`${type}appendix`] = fileMap;
        }
    });
    if (config.appendix.render.definition) {
        config.custom_toc.appendix.definitionappendix = {
            1: `${config.appendix.path.definition}/definitions.xhtml`,
        };
    }
    if (config.appendix.render.relations) {
        const charRelationMap = {};
        let charIndex = 0;
        (b.characters || []).forEach((char, index) => {
            const hasRelations = (b.relations || []).some(
                (r) => r.fromId === char.id || r.toId === char.id,
            );
            if (hasRelations) {
                charIndex++;
                charRelationMap[String(charIndex)] =
                    `${config.appendix.path.relations}/char-${index + 1}.xhtml`;
            }
        });
        if (Object.keys(charRelationMap).length) {
            config.custom_toc.appendix.relationsappendix = charRelationMap;
        }
    }
    if (config.appendix.render.timeline) {
        config.custom_toc.appendix.timelineappendix = {
            1: `${config.appendix.path.timeline}/timeline.xhtml`,
        };
    }
    return config;
}
function creatorDataUrlToBinary(value) {
    const match =
        typeof value === "string"
            ? value.match(/^data:([^;]+);base64,(.*)$/)
            : null;
    if (!match) return null;
    return {
        mime: match[1],
        data: Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)),
    };
}
function creatorImageExtension(mime) {
    return (String(mime || "").split("/")[1] || "png")
        .replace("jpeg", "jpg")
        .replace("svg+xml", "svg");
}
function creatorHtmlText(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function creatorWikiLabel(key, fallback) {
    return tFn(`creator.appendix.wiki.field.${key}`, fallback);
}
function creatorWikiHumanize(key) {
    return String(key || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
function creatorWikiText(value) {
    const text = String(value === undefined || value === null ? "" : value)
        .trim();
    if (!text) return "";
    return text
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => `<p>${creatorHtmlText(paragraph).replace(/\r?\n/g, "<br />")}</p>`)
        .join("");
}
function creatorWikiReference(st, key, value, fromPath) {
    const rawKey = String(key || "");
    const plural = rawKey.endsWith("Ids");
    const singular = rawKey.endsWith("Id");
    if (!plural && !singular) return null;
    const typeMap = {
        itemset: "itemsets",
        skillset: "skillsets",
        faction: "factions",
        character: "characters",
        ability: "abilities",
        item: "items",
        baseDef: "definitions",
        bonusDef: "definitions",
        baseDefinition: "definitions",
        bonusDefinition: "definitions",
        stat: "stats",
        chapter: "chapters",
        arc: "arcs",
    };
    const prefix = rawKey.replace(/Ids?$/, "");
    const type = typeMap[prefix];
    if (!st || !st.book || !st.entityPaths) return "";
    if (!type) return "";
    const ids = plural ? (Array.isArray(value) ? value : [value]) : [value];
    const items = ids.map((id) => {
        const entity = type === "stats"
            ? (st.book.systems && st.book.systems.stats || []).find((entry) => entry.id === id)
            : (st.book[type] || []).find((entry) => entry.id === id);
        const label = entity && (entity.name || entity.title || entity.code ||
            (type === "chapters" ? `${tFn("chapter", "Chapter")} ${entity.number || ""}`.trim() : ""));
        const targetType = type === "definitions" ? "definition" : type;
        const target = st.entityPaths[`${targetType}:${id}`];
        if (!label) return "";
        const text = creatorHtmlText(label);
        return target
            ? `<a href="${creatorHtmlText(creatorRelativeHref(fromPath, target))}">${text}</a>`
            : text;
    }).filter(Boolean);
    if (!items.length) return "";
    return plural ? `<ul class="wiki-related-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : items[0];
}
function creatorWikiValue(value, fromPath, st, key) {
    if (value === undefined || value === null || value === "") return "";
    const reference = creatorWikiReference(st, key, value, fromPath);
    if (reference !== null) return reference;
    if (Array.isArray(value)) {
        const items = value
            .map((item) => creatorWikiValue(item, fromPath, st, key))
            .filter(Boolean)
            .map((item) => `<li>${item}</li>`)
            .join("");
        return items ? `<ul class="wiki-list">${items}</ul>` : "";
    }
    if (typeof value === "object") {
        const rows = Object.entries(value)
            .filter(([key]) => !new Set(["id", "createdAt", "updatedAt", "created_at", "updated_at", "created", "updated"]).has(key))
            .map(([key, item]) => {
                const rendered = creatorWikiValue(item, fromPath, st, key);
                return rendered
                    ? `<div><dt>${creatorHtmlText(creatorWikiLabel(key, creatorWikiHumanize(key)))}</dt><dd>${rendered}</dd></div>`
                    : "";
            })
            .filter(Boolean)
            .join("");
        return rows ? `<dl class="wiki-nested-data">${rows}</dl>` : "";
    }
    return creatorHtmlText(value);
}
function creatorWikiSection(title, content, id) {
    if (!content) return "";
    return `<section class="wiki-section"${id ? ` id="${creatorHtmlText(id)}"` : ""}><h2>${creatorHtmlText(title)}</h2>${content}</section>`;
}
function creatorWikiLinks(st, fromPath, type, ids, fallback) {
    const values = Array.isArray(ids) ? ids : ids ? [ids] : [];
    const items = values
        .map((id) => {
            const entity = (st.book[type] || []).find((entry) => entry.id === id);
            const label = entity && (entity.name || entity.title || entity.code);
            if (!label) return "";
            const target = st.entityPaths[`${type}:${id}`];
            return target
                ? `<li><a href="${creatorHtmlText(creatorRelativeHref(fromPath, target))}">${creatorHtmlText(label || id)}</a></li>`
                : label ? `<li>${creatorHtmlText(label)}</li>` : "";
        })
        .filter(Boolean)
        .join("");
    return items ? `<ul class="wiki-related-list">${items}</ul>` : fallback || "";
}
function creatorWikiChanges(src) {
    const changes = Array.isArray(src.changes)
        ? src.changes
        : Array.isArray(src.history)
          ? src.history
          : [];
    if (!changes.length) return "";
    return `<ol class="wiki-change-list">${changes
        .map((change) => {
            const value = typeof change === "object" ? change : { description: change };
            const when = value.chapter || value.time || value.at || value.date;
            const before = value.from !== undefined ? ` — ${creatorHtmlText(value.from)} → ${creatorHtmlText(value.to)}` : "";
            const text = value.description || value.note || value.text || "";
            return `<li>${when ? `<strong>${creatorHtmlText(when)}</strong> ` : ""}${creatorHtmlText(text)}${before}</li>`;
        })
        .join("")}</ol>`;
}
function creatorRelativeHref(fromPath, toPath) {
    const fromDir = String(fromPath || "").split("/").slice(0, -1);
    const toParts = String(toPath || "").split("/");
    let shared = 0;
    while (
        shared < fromDir.length &&
        shared < toParts.length - 1 &&
        fromDir[shared] === toParts[shared]
    ) {
        shared += 1;
    }
    const ups = fromDir.slice(shared).map(() => "..");
    const rel = [...ups, ...toParts.slice(shared)].join("/");
    return rel || String(toPath || "");
}
function creatorUniquePath(taken, base, ext) {
    let candidate = base;
    let n = 2;
    while (taken.has(candidate)) {
        candidate = `${base}-${n}`;
        n += 1;
    }
    taken.add(candidate);
    return candidate + ext;
}
function creatorAppendixPageHTML(opts) {
    const lang = String(opts.lang || "vi").replace(/[^\w-]/g, "");
    const title = creatorHtmlText(opts.title || "");
    const backHref = creatorHtmlText(opts.backHref || "");
    const backTitle = creatorHtmlText(opts.backTitle || "");
    const body = opts.body || "";
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <style>
        .wiki-page { max-width: 56em; margin: 0 auto; padding: 1em; line-height: 1.5; }
        .wiki-header { border-bottom: 2px solid #888; margin-bottom: 1em; }
        .wiki-layout { display: block; }
        .wiki-infobox { border: 1px solid #aaa; padding: .75em; margin: 0 0 1em; }
        .wiki-infobox h2, .wiki-section h2 { margin: 0 0 .5em; }
        .wiki-infobox dl, .wiki-nested-data { margin: 0; }
        .wiki-infobox dl > div, .wiki-nested-data > div { display: grid; grid-template-columns: minmax(7em, 35%) 1fr; gap: .5em; border-top: 1px solid #ddd; padding: .25em 0; }
        .wiki-infobox dt, .wiki-nested-data dt { font-weight: bold; }
        .wiki-infobox dd, .wiki-nested-data dd { margin: 0; }
        .wiki-tags, .wiki-list, .wiki-related-list, .wiki-change-list { padding-left: 1.4em; }
        .wiki-tags { display: flex; flex-wrap: wrap; gap: .4em; list-style: none; padding-left: 0; }
        .wiki-tags span { border: 1px solid #aaa; padding: .1em .4em; }
        .wiki-section { margin: 1.2em 0; }
        .wiki-table { border-collapse: collapse; width: 100%; }
        .wiki-table th, .wiki-table td { border: 1px solid #aaa; padding: .35em; text-align: left; }
        .wiki-illustration { margin: 0 0 1em; text-align: center; }
        .wiki-illustration img { max-width: 100%; height: auto; }
        .wiki-illustration figcaption { font-style: italic; }
        .wiki-navigation { border-top: 1px solid #aaa; margin-top: 2em; padding-top: .75em; }
        code, pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    </style>
</head>
<body>
    <article class="wiki-page">
        <nav class="wiki-navigation" aria-label="${creatorHtmlText(tFn("creator.appendix.wiki.navigation", "Navigation"))}"><a href="${backHref}">← ${backTitle}</a></nav>
        ${body}
    </article>
</body>
</html>`;
}
function creatorAppendixListUL(items, fromPath) {
    if (!(items && items.length)) return "";
    const lis = items
        .map(
            (it) =>
                `                <li style="margin: 0.5em 0;"><a href="${creatorHtmlText(
                    creatorRelativeHref(fromPath, it.href),
                )}" style="text-decoration: none; color: #0066cc;">${creatorHtmlText(
                    it.title,
                )}</a></li>`,
        )
        .join("\n");
    return `            <ul style="list-style-type: none; padding-left: 0;">
${lis}
            </ul>`;
}
function creatorEntityHref(taken, folder, src, index, fallbackKey) {
    const base =
        slug(src.name || src.title || "") ||
        `${fallbackKey || "entity"}-${index + 1}`;
    return creatorUniquePath(taken, `${folder}/${base}`, ".xhtml");
}
function creatorAppendixEntityPage(st, src, href, opts) {
    opts = opts || {};
    src = src || {};
    const titleLabel =
        String(src.name || src.title || "").trim() ||
        opts.fallbackTitle ||
        "Không tên";
    const parts = href.split("/");
    const dir = parts.slice(0, -1).join("/");
    const base = (parts[parts.length - 1] || "").replace(/\.xhtml$/i, "");
    st.entityPaths = st.entityPaths || {};
    if (src.id !== undefined && opts.type) {
        st.entityPaths[`${opts.type}:${src.id}`] = href;
    }
    const images = [];
    const illustration = (src && src.illustration) || {};
    [
        ["icon", illustration.icon],
        ["portrait", illustration.portrait],
    ].forEach(([kind, source]) => {
        const image = creatorDataUrlToBinary(source);
        if (!image) return;
        const ext = creatorImageExtension(image.mime);
        st.zip.file(`${dir}/${base}-${kind}.${ext}`, image.data);
        const altKey = kind === "icon"
            ? "creator.appendix.wiki.icon_alt"
            : "creator.appendix.wiki.portrait_alt";
        images.push(`<figure class="wiki-illustration"><img src="${base}-${kind}.${ext}" alt="${creatorHtmlText(tFn(altKey, kind))}" /><figcaption>${creatorHtmlText(titleLabel)}</figcaption></figure>`);
    });
    const tags = (Array.isArray(src.tags) ? src.tags : [])
        .filter((tag) => tag !== undefined && tag !== null && tag !== "")
        .map((tg) => `<li><span>#${creatorHtmlText(tg)}</span></li>`)
        .join("");
    const excluded = new Set(["id", "name", "title", "description", "tags", "illustration", "icon", "portrait", "changes", "history", "createdAt", "updatedAt", "created_at", "updated_at", "created", "updated"]);
    const fieldEntries = Object.entries(src).filter(([key, value]) =>
        !excluded.has(key) && value !== undefined && value !== null && value !== "");
    const infobox = fieldEntries.map(([key, value]) => {
        const rendered = creatorWikiValue(value, href, st, key);
        return rendered
            ? `<div><dt>${creatorHtmlText(creatorWikiLabel(key, creatorWikiHumanize(key)))}</dt><dd>${rendered}</dd></div>`
            : "";
    }).filter(Boolean).join("");
    const sections = [];
    if (images.length) sections.push(images.join(""));
    if (tags) sections.push(`<section class="wiki-section" id="tags"><h2>${creatorHtmlText(tFn("creator.appendix.wiki.tags", "Tags"))}</h2><ul class="wiki-tags">${tags}</ul></section>`);
    if (infobox) sections.push(creatorWikiSection(tFn("creator.appendix.wiki.info", "Information"), `<dl>${infobox}</dl>`, "information"));
    const description = creatorWikiText(src.description);
    if (description) sections.push(creatorWikiSection(tFn("creator.appendix.wiki.description", "Description"), description, "overview"));
    if (opts.type === "item" && src.itemsetIds && src.itemsetIds.length) {
        sections.push(creatorWikiSection(tFn("creator.appendix.wiki.belongs_to", "Belongs to"), creatorWikiLinks(st, href, "itemsets", src.itemsetIds), "belongs-to"));
    }
    if ((opts.type === "abilities" || opts.type === "ability") && src.skillsetIds && src.skillsetIds.length) {
        sections.push(creatorWikiSection(tFn("creator.appendix.wiki.belongs_to", "Belongs to"), creatorWikiLinks(st, href, "skillsets", src.skillsetIds), "belongs-to"));
    }
    const relations = src.relations || src.related || src.relatedIds;
    if (relations) sections.push(creatorWikiSection(tFn("creator.appendix.wiki.related", "Related"), creatorWikiValue(relations, href, st, "related"), "relations"));
    const changes = creatorWikiChanges(src);
    if (changes) sections.push(creatorWikiSection(tFn("creator.appendix.wiki.changes", "Changes"), changes, "changes"));
    if (opts.extra) sections.push(opts.extra);
    const body = `<header class="wiki-header"><h1>${creatorHtmlText(titleLabel)}</h1></header><div class="wiki-layout"><main class="wiki-content">${sections.join("")}</main></div>`;
    st.zip.file(
        href,
        creatorAppendixPageHTML({
            lang: st.lang,
            title: titleLabel,
            backHref: creatorRelativeHref(href, opts.backHref),
            backTitle: opts.backTitle,
            body: body,
        }),
    );
    return { title: titleLabel, href: href };
}
function creatorAppendixIndexPage(st, indexHref, title, backHref, backTitle, members) {
    st.zip.file(
        indexHref,
        creatorAppendixPageHTML({
            lang: st.lang,
            title: title,
            backHref: creatorRelativeHref(indexHref, backHref),
            backTitle: backTitle,
            body: creatorAppendixListUL(members, indexHref),
        }),
    );
}
function buildCreatorGroupedAppendixSection(st, section) {
    const entities = section.entities || [];
    if (!entities.length || st.render[section.type] === false) return null;
    const activeGroups = (section.groups || []).filter((grp) =>
        entities.some((e) => (section.memberOf(e) || []).includes(grp.id)),
    );
    if (!activeGroups.length) {
        return buildCreatorFlatAppendixSection(st, {
            type: section.type,
            title: section.title,
            folder: section.folder,
            entities: entities,
        });
    }
    const indexHref = creatorUniquePath(
        st.taken,
        `${section.folder}/index`,
        ".xhtml",
    );
    const children = [];
    const assigned = new Set();
    activeGroups.forEach((grp, gIndex) => {
        const members = entities.filter((e) =>
            (section.memberOf(e) || []).includes(grp.id),
        );
        if (!members.length) return;
        const grpSlug =
            slug(grp.name || "") || `${section.type}-group-${gIndex + 1}`;
        const grpFolder = creatorUniquePath(
            st.taken,
            `${section.folder}/${grpSlug}`,
            "",
        );
        const grpHref = `${grpFolder}/index.xhtml`;
        st.entityPaths = st.entityPaths || {};
        const groupType = section.type === "abilities" ? "skillsets" : "itemsets";
        if (grp.id !== undefined) st.entityPaths[`${groupType}:${grp.id}`] = grpHref;
        const groupChildren = members.map((m, i) => {
            assigned.add(m.id);
            return creatorAppendixEntityPage(
                st,
                m,
                creatorEntityHref(st.taken, grpFolder, m, i, section.type),
                {
                    type: section.type === "abilities" ? "abilities" : section.type,
                    backHref: grpHref,
                    backTitle: grp.name || "",
                    fallbackTitle: `${section.title} ${gIndex + 1}-${i + 1}`,
                },
            );
        });
        st.zip.file(
            grpHref,
            creatorAppendixPageHTML({
                lang: st.lang,
                title: grp.name || "",
                backHref: creatorRelativeHref(grpHref, indexHref),
                backTitle: section.title,
                body: `<article class="wiki-page"><header class="wiki-header"><h1>${creatorHtmlText(grp.name || "")}</h1></header>${grp.code ? creatorWikiSection(tFn("creator.appendix.wiki.info", "Information"), `<dl><div><dt>${creatorHtmlText(tFn("creator.appendix.wiki.code", "Code"))}</dt><dd><code>${creatorHtmlText(grp.code)}</code></dd></div></dl>`, "information") : ""}${creatorWikiSection(tFn("creator.appendix.wiki.members", "Members"), creatorAppendixListUL(groupChildren, grpHref), "members")}${creatorWikiText(grp.description) ? creatorWikiSection(tFn("creator.appendix.wiki.description", "Description"), creatorWikiText(grp.description), "overview") : ""}</article>`,
            }),
        );
        children.push({
            kind: "group",
            title: grp.name || "",
            href: grpHref,
            children: groupChildren,
        });
    });
    const others = entities.filter((e) => !assigned.has(e.id));
    if (others.length) {
        const othersTitle = tFn("creator.appendix.others", "Others");
        const othersHref = `${creatorUniquePath(
            st.taken,
            `${section.folder}/others`,
            "",
        )}/index.xhtml`;
        const othersDir = othersHref.slice(0, othersHref.lastIndexOf("/"));
        const othersChildren = others.map((e, i) =>
            creatorAppendixEntityPage(
                st,
                e,
                creatorEntityHref(st.taken, othersDir, e, i, section.type),
                {
                    type: section.type,
                    backHref: othersHref,
                    backTitle: othersTitle,
                    fallbackTitle: `${section.title} ${i + 1}`,
                },
            ),
        );
        st.zip.file(
            othersHref,
            creatorAppendixPageHTML({
                lang: st.lang,
                title: othersTitle,
                backHref: creatorRelativeHref(othersHref, indexHref),
                backTitle: section.title,
                body: creatorAppendixListUL(othersChildren, othersHref),
            }),
        );
        children.push({
            kind: "group",
            title: othersTitle,
            href: othersHref,
            children: othersChildren,
        });
    }
    if (!children.length) return null;
    creatorAppendixIndexPage(
        st,
        indexHref,
        section.title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: section.type,
        title: section.title,
        folder: section.folder,
        index_href: indexHref,
        grouped: true,
        children: children,
    };
}
function buildCreatorFlatAppendixSection(st, section) {
    const entities = section.entities || [];
    if (!entities.length || st.render[section.type] === false) return null;
    const indexHref = creatorUniquePath(
        st.taken,
        `${section.folder}/index`,
        ".xhtml",
    );
    const children = entities.map((e, i) =>
        creatorAppendixEntityPage(
            st,
            e,
            creatorEntityHref(st.taken, section.folder, e, i, section.type),
            {
                type: section.type,
                backHref: indexHref,
                backTitle: section.title,
                fallbackTitle: `${section.title} ${i + 1}`,
            },
        ),
    );
    creatorAppendixIndexPage(
        st,
        indexHref,
        section.title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: section.type,
        title: section.title,
        folder: section.folder,
        index_href: indexHref,
        grouped: false,
        children: children,
    };
}
function creatorAppendixSections(book) {
    return [
        ["items", "item", "appendix/item"],
        ["itemsets", "itemset", "appendix/itemset"],
        ["characters", "character", "appendix/character"],
        ["factions", "faction", "appendix/faction"],
        ["realms", "realms", "appendix/realms"],
        ["abilities", "abilities", "appendix/abilities"],
        ["skillsets", "skillset", "appendix/skillset"],
        ["relations", "relations", "appendix/relations"],
        ["timeline", "timeline", "appendix/timeline"],
    ];
}
function creatorSystemRowsHTML(kind, list, book) {
    const field = (label, value) =>
        value !== undefined && value !== "" && value !== null
            ? `<div><dt>${creatorHtmlText(tFn(`creator.appendix.wiki.field.${label}`, label))}</dt><dd>${creatorHtmlText(value)}</dd></div>`
            : "";
    const rows = (list || []).map((item) => {
        let html = "";
        if (kind === "stats") {
            html = [
                field("code", item.code),
                field("type", item.type),
                field("dataType", item.dataType),
                field("unit", item.unit),
                field("defaultValue", item.defaultValue),
                field("min", item.min),
                field("max", item.max),
                field("scope", item.scope),
            ].join("");
        } else if (kind === "resources") {
            html = [
                field("code", item.code),
                field("max", item.max),
                field("current", item.current),
                field("regen", item.regenFormula || item.regen),
            ].join("");
        } else if (kind === "currencies") {
            html = [
                field("code", item.code),
                field("value", item.value),
                field("symbol", item.symbol),
            ].join("");
        } else if (kind === "effects") {
            html = [
                field("type", item.type),
                field("target", item.target),
                field("duration", item.duration),
                field("value", item.value),
            ].join("");
        } else if (kind === "quests") {
            html = [
                field("type", item.type),
                field("priority", item.priority),
                field("location", item.location),
            ].join("");
        } else if (kind === "combat") {
            const statRows = (item.stats || [])
                .map((sr) => {
                    const stat = ((book.systems || {}).stats || []).find(
                        (s) => s.id === sr.statId,
                    );
                    if (!stat) return "";
                    return `<li>${creatorHtmlText(stat.code || stat.name || "")}${sr.note ? ` — ${creatorHtmlText(sr.note)}` : ""}</li>`;
                })
                .join("");
            html = statRows
                ? `<div style="margin: 0.3em 0;"><span style="font-weight:600;">Stats</span><ul style="margin: 0.2em 0 0 0; padding-left: 1.2em;">${statRows}</ul></div>`
                : "";
        }
        const desc = creatorWikiText(item.description);
        const name = creatorHtmlText(item.name || item.code || item.id || "");
        const formula = item.formula || item.regenFormula;
        return `<section class="wiki-section"><h3>${name}</h3>${html ? `<dl class="wiki-infobox">${html}</dl>` : ""}${formula ? `<pre><code>${creatorHtmlText(formula)}</code></pre>` : ""}${desc}</section>`;
    });
    return rows.join("\n");
}
function buildCreatorDefinitionsAppendixSection(st) {
    const defs = st.book.definitions || [];
    if (!defs.length || st.render.definition === false) return null;
    const folder = st.path.definition || "appendix/definition";
    const title = tFn("creator.appendix.definition", "Định nghĩa");
    const indexHref = creatorUniquePath(
        st.taken,
        `${folder}/index`,
        ".xhtml",
    );
    const children = defs.map((d, i) =>
        creatorAppendixEntityPage(
            st,
            d,
            creatorEntityHref(st.taken, folder, d, i, "definition"),
            {
                type: "definition",
                backHref: indexHref,
                backTitle: title,
                fallbackTitle: `${title} ${i + 1}`,
                extra: d.code
                    ? `<div style="margin: 0.4em 0;"><code>${creatorHtmlText(d.code)}</code></div>`
                    : "",
            },
        ),
    );
    creatorAppendixIndexPage(
        st,
        indexHref,
        title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: "definition",
        title: title,
        folder: folder,
        index_href: indexHref,
        grouped: false,
        children: children,
    };
}
function buildCreatorRelationsAppendixSection(st) {
    if (!st.render.relations) return null;
    const folder = st.path.relations || "appendix/relations";
    const chars = (st.book.characters || []).filter((c) =>
        (st.book.relations || []).some(
            (r) => r.fromId === c.id || r.toId === c.id,
        ),
    );
    if (!chars.length) return null;
    const title = tFn("creator.appendix.relations", "Quan hệ");
    const indexHref = creatorUniquePath(
        st.taken,
        `${folder}/index`,
        ".xhtml",
    );
    const children = appendRelationsToZip(st.book, st.zip, folder, {
        lang: st.lang,
        backHref: indexHref,
        backTitle: title,
        entityPaths: st.entityPaths,
    });
    children.forEach((c) => st.taken.add(c.href));
    creatorAppendixIndexPage(
        st,
        indexHref,
        title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: "relations",
        title: title,
        folder: folder,
        index_href: indexHref,
        grouped: false,
        children: children,
    };
}
function buildCreatorTimelineAppendixSection(st) {
    if (!st.render.timeline) return null;
    if (!(st.book.timeline || []).length) return null;
    const folder = st.path.timeline || "appendix/timeline";
    const title = tFn("creator.appendix.timeline", "Timeline");
    const indexHref = creatorUniquePath(
        st.taken,
        `${folder}/index`,
        ".xhtml",
    );
    const entry = appendTimelineToZip(st.book, st.zip, folder, {
        lang: st.lang,
        backHref: indexHref,
        backTitle: title,
    });
    st.taken.add(entry.href);
    const children = [entry];
    creatorAppendixIndexPage(
        st,
        indexHref,
        title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: "timeline",
        title: title,
        folder: folder,
        index_href: indexHref,
        grouped: false,
        children: children,
    };
}
function buildCreatorSystemsAppendixSection(st) {
    if (st.render.systems === false) return null;
    const ds = st.book.displaySettings || {};
    const sys = st.book.systems || {};
    const title = tFn("creator.appendix.systems", "Hệ thống / Stats");
    const tabs = [
        ["stats", tFn("creator.sys.tab_stats", "Stats"), sys.stats],
        ["resources", tFn("creator.sys.tab_resources", "Tài nguyên"), sys.resources],
        ["currencies", tFn("creator.sys.tab_currencies", "Tiền tệ"), sys.currencies],
        ["effects", tFn("creator.sys.tab_effects", "Effects / Statuses"), sys.effects],
        ["quests", tFn("creator.sys.tab_quests", "Quests / Missions"), sys.quests],
        ["combat", tFn("creator.sys.tab_combat", "Combat Stats"), Array.isArray(sys.combat) ? sys.combat : []],
    ];
    const rendered = tabs.filter(
        ([k, , list]) => ds["sys" + k] !== "hidden" && list.length,
    );
    if (!rendered.length) return null;
    const folder = st.path.systems || "appendix/systems";
    const indexHref = creatorUniquePath(
        st.taken,
        `${folder}/index`,
        ".xhtml",
    );
    const children = rendered.map(([k, label, list]) => {
        const href = creatorUniquePath(
            st.taken,
            `${folder}/${k}`,
            ".xhtml",
        );
        st.zip.file(
            href,
            creatorAppendixPageHTML({
                lang: st.lang,
                title: label,
                backHref: creatorRelativeHref(href, indexHref),
                backTitle: title,
                body: creatorSystemRowsHTML(k, list, st.book),
            }),
        );
        return { kind: "system", title: label, href: href };
    });
    creatorAppendixIndexPage(
        st,
        indexHref,
        title,
        st.appendixHref,
        st.rootTitle,
        children,
    );
    return {
        type: "systems",
        title: title,
        folder: folder,
        index_href: indexHref,
        grouped: false,
        children: children,
    };
}
function buildCreatorAppendixPackage(book, config, zip) {
    const render = config.appendix.render || {};
    const path = config.appendix.path || {};
    const st = {
        book: book,
        config: config,
        zip: zip,
        render: render,
        path: path,
        lang: config.language || "vi",
        taken: new Set(["appendix-toc.xhtml"]),
        entityPaths: {},
        rootTitle: tFn("epub.appendix_root", "Phụ lục"),
        appendixHref: "appendix-toc.xhtml",
    };
    const structure = [];
    const itemSection = buildCreatorGroupedAppendixSection(st, {
        type: "item",
        title: tFn("creator.appendix.item", "Vật phẩm"),
        folder: path.item || "appendix/item",
        entities: book.items || [],
        groups: render.itemset ? book.itemsets || [] : [],
        memberOf: (it) =>
            (it.itemsetIds || []).filter((sid) =>
                (book.itemsets || []).some((g) => g.id === sid),
            ),
    });
    if (itemSection) structure.push(itemSection);
    const abilitySection = buildCreatorGroupedAppendixSection(st, {
        type: "abilities",
        title: tFn("creator.appendix.abilities", "Khả năng"),
        folder: path.abilities || "appendix/abilities",
        entities: book.abilities || [],
        groups: render.skillset ? book.skillsets || [] : [],
        memberOf: (a) =>
            (a.skillsetIds || []).filter((sid) =>
                (book.skillsets || []).some((g) => g.id === sid),
            ),
    });
    if (abilitySection) structure.push(abilitySection);
    [
        {
            type: "character",
            title: tFn("creator.appendix.character", "Nhân vật"),
            folder: path.character || "appendix/character",
            entities: book.characters || [],
        },
        {
            type: "faction",
            title: tFn("creator.appendix.faction", "Phe phái"),
            folder: path.faction || "appendix/faction",
            entities: book.factions || [],
        },
        {
            type: "realms",
            title: tFn("creator.appendix.realms", "Vị diện"),
            folder: path.realms || "appendix/realms",
            entities: book.realms || [],
        },
    ].forEach((section) => {
        const built = buildCreatorFlatAppendixSection(st, section);
        if (built) structure.push(built);
    });
    const defs = buildCreatorDefinitionsAppendixSection(st);
    if (defs) structure.push(defs);
    const rels = buildCreatorRelationsAppendixSection(st);
    if (rels) structure.push(rels);
    const tl = buildCreatorTimelineAppendixSection(st);
    if (tl) structure.push(tl);
    const syss = buildCreatorSystemsAppendixSection(st);
    if (syss) structure.push(syss);
    if (structure.length) {
        const rootBody = creatorAppendixListUL(
            structure.map((sec) => ({ href: sec.index_href, title: sec.title })),
            st.appendixHref,
        );
        zip.file(
            st.appendixHref,
            creatorAppendixPageHTML({
                lang: st.lang,
                title: st.rootTitle,
                backHref: "toc.xhtml",
                backTitle: tFn("epub.toc", "Mục lục"),
                body: rootBody,
            }),
        );
    }
    config.appendix.structure = structure;
}
function appendRelationsToZip(book, zip, entityFolder, opts) {
    opts = opts || {};
    const lang = opts.lang || "vi";
    const backHref = opts.backHref || "";
    const backTitle = opts.backTitle || "";
    const entityPaths = opts.entityPaths || {};
    const result = [];
    (book.characters || []).forEach((char, index) => {
        const charRelations = (book.relations || []).filter(
            (r) => r.fromId === char.id || r.toId === char.id,
        );
        if (charRelations.length === 0) return;
        const charName = String(char.name || `Character ${index + 1}`).trim();
        const relSections = charRelations
            .map((rel) => {
                const otherId = rel.fromId === char.id ? rel.toId : rel.fromId;
                const otherKind =
                    rel.fromId === char.id ? rel.toKind : rel.fromKind;
                const otherName = rel.fromId === char.id ? rel.to : rel.from;
                const otherEntity =
                    otherKind === "faction"
                        ? (book.factions || []).find((f) => f.id === otherId)
                        : (book.characters || []).find((c) => c.id === otherId);
                const otherTarget = otherEntity &&
                    entityPaths[`${otherKind === "faction" ? "faction" : "character"}:${otherEntity.id}`];
                const otherLabel = creatorHtmlText(
                    otherName && otherName !== otherId
                        ? otherName
                        : otherEntity?.name || tFn("creator.appendix.wiki.unknown", "Unknown"),
                );
                const otherLink = otherTarget
                    ? `<a href="${creatorHtmlText(creatorRelativeHref(`${entityFolder}/char-${index + 1}.xhtml`, otherTarget))}">${otherLabel}</a>`
                    : otherLabel;
                const snaps = relSnapshots(book, rel);
                return snaps
                    .map((snap) => {
                        const relType = creatorHtmlText(
                            snap.type || "relation",
                        );
                        const intensity = Number(snap.intensity || 0);
                        const intensityClass =
                            intensity > 0
                                ? "positive"
                                : intensity < 0
                                  ? "negative"
                                  : "neutral";
                        const scopeLabel = creatorHtmlText(
                            relSnapLabel(book, snap),
                        );
                        const desc = creatorHtmlText(snap.description || "");
                        const stateLabel = snap.state
                            ? creatorHtmlText(snap.state)
                            : "";
                        return `<section class="relation-item"><h2>${otherLink}</h2><dl><div><dt>${creatorHtmlText(tFn("creator.appendix.wiki.type", "Type"))}</dt><dd>${relType}</dd></div><div><dt>${creatorHtmlText(tFn("creator.appendix.wiki.intensity", "Intensity"))}</dt><dd class="${intensityClass}">${intensity > 0 ? "+" : ""}${intensity}</dd></div>${scopeLabel ? `<div><dt>${creatorHtmlText(tFn("creator.appendix.wiki.scope", "Scope"))}</dt><dd>${scopeLabel}</dd></div>` : ""}${stateLabel ? `<div><dt>${creatorHtmlText(tFn("creator.appendix.wiki.status", "Status"))}</dt><dd>${stateLabel}</dd></div>` : ""}</dl>${desc ? creatorWikiText(snap.description) : ""}</section>`;
                    })
                    .join("");
            })
            .join("");
        const href = `${entityFolder}/char-${index + 1}.xhtml`;
        zip.file(
            href,
            creatorAppendixPageHTML({
                lang: lang,
                title: charName,
                backHref: creatorRelativeHref(href, backHref),
                backTitle: backTitle,
                body: `<article class="wiki-page"><header class="wiki-header"><h1>${creatorHtmlText(charName)}</h1></header><section class="wiki-section" id="relations"><h2>${creatorHtmlText(tFn("creator.appendix.wiki.related", "Relations"))}</h2><div class="relations-list">${relSections}</div></section></article>`,
            }),
        );
        result.push({ title: charName, href: href });
    });
    return result;
}
function appendTimelineToZip(book, zip, entityFolder, opts) {
    opts = opts || {};
    const lang = opts.lang || "vi";
    const backHref = opts.backHref || "";
    const backTitle = opts.backTitle || "";
    const timelineEntries = book.timeline || [];
    const arcs = book.arcs || [];
    const chapters = book.chapters || [];
    const resolveRef = (kind, ref) => {
        if (kind === "arc") {
            const arc = arcs.find((a) => a.id === ref);
            return arc ? arc.title : "";
        }
        if (kind === "chapter") {
            const ch = chapters.find((c) => c.id === ref);
            return ch
                ? `${tFn("chapter", "Chương")} ${ch.number || ""}`.trim()
                : "";
        }
        return "";
    };
    const timelineSections = timelineEntries
        .sort((a, b) => {
            const timeA = a.time || "";
            const timeB = b.time || "";
            return timeA.localeCompare(timeB);
        })
        .map((entry) => {
            const time = creatorHtmlText(entry.time || "");
            const text = creatorHtmlText(entry.text || "");
            const refLabel = entry.ref
                ? creatorHtmlText(resolveRef(entry.kind, entry.ref))
                : "";
            const kindLabel =
                entry.kind === "arc"
                    ? tFn("creator.sub.arcs", "Arc")
                    : entry.kind === "chapter"
                      ? tFn("chapter", "Chương")
                      : "";
            return `<li class="timeline-entry"><span class="tl-time">${time}</span>${kindLabel ? `<span class="tl-kind">${kindLabel}</span>` : ""}${refLabel ? `<span class="tl-ref">${refLabel}</span>` : ""}${text ? `<p class="tl-text">${text}</p>` : ""}</li>`;
        })
        .join("");
    const href = `${entityFolder}/timeline.xhtml`;
    zip.file(
        href,
        creatorAppendixPageHTML({
            lang: lang,
            title: tFn("creator.sub.timeline", "Timeline"),
            backHref: creatorRelativeHref(href, backHref),
            backTitle: backTitle,
            body: `<article class="wiki-page"><header class="wiki-header"><h1>${creatorHtmlText(tFn("creator.sub.timeline", "Timeline"))}</h1></header><ol class="wiki-timeline">${timelineSections}</ol></article>`,
        }),
    );
    return { title: tFn("creator.sub.timeline", "Timeline"), href: href };
}
async function createCreatorParserZip(book, config, options = {}) {
    if (!window.JSZip) {
        throw new Error(
            tFn(
                "creator.exp.need_jszip_epub",
                "EPUB export cần JSZip. Hãy mở trang khi có Internet để tải thư viện.",
            ),
        );
    }

    if (book && book.id) {
        try {
            const fresh = await getBook(book.id);
            if (fresh) book = fresh;
        } catch (err) {}
    }

    const zip = new JSZip();
    const ordered = [...(book.chapters || [])].sort(
        (a, b) => (a.number || 0) - (b.number || 0),
    );
    const paths = new Map();
    const custom = config.custom_toc && config.custom_toc.enabled;

    if (custom) {
        Object.entries(config.custom_toc).forEach(([key, block]) => {
            if (
                key === "enabled" ||
                key === "comment" ||
                key === "override_appendix" ||
                key === "appendix" ||
                key === "locked" ||
                !block?.chapter_id
            ) {
                return;
            }
            Object.entries(block.chapter_id).forEach(
                ([chapterKey, location]) => {
                    const pathMatch = String(location || "").match(
                        /chapter-(\d+)\.(?:html|xhtml)$/i,
                    );
                    const chapter = ordered.find(
                        (item) =>
                            item.id === location ||
                            item.id === chapterKey ||
                            String(item.number) === String(chapterKey) ||
                            ordered.indexOf(item) ===
                                (pathMatch ? Number(pathMatch[1]) - 1 : -2),
                    );
                    if (!chapter) return;
                    const fallback = `${block.id || key}/chapter-${ordered.indexOf(chapter) + 1}.html`;
                    const href = String(location || fallback);
                    block.chapter_id[chapterKey] = href;
                    paths.set(chapter.id, href);
                },
            );
        });
    }

    ordered.forEach((chapter, index) => {
        const href = paths.get(chapter.id) || `chapter-${index + 1}.html`;
        const filePath = /\.(?:html|xhtml)$/i.test(href)
            ? href
            : `${href}.html`;
        const chapterNum = chapter.number || index + 1;
        const chapterTitle = String(chapter.title || "").trim();
        const chapterWord = typeof t === "function" ? t("chapter") : "Chương";
        const displayTitle = chapterTitle || `${chapterWord} ${chapterNum}`;
        const escapedTitle = creatorHtmlText(displayTitle);
        const rawContent = String(chapter.content || "").replace(
            /\r\n?/g,
            "\n",
        );
        const bodyContent = creatorHtmlText(rawContent).replace(/\n/g, "<br/>");
        zip.file(
            filePath,
            `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapedTitle}</title></head><body><h1>${escapedTitle}</h1><div class="chapter-content">${bodyContent}</div></body></html>`,
        );
    });

    const cover = creatorDataUrlToBinary(book.cover);
    if (cover) {
        const coverPath =
            config.cover_href ||
            `images/cover.${creatorImageExtension(cover.mime)}`;
        config.cover_href = coverPath;
        zip.file(coverPath, cover.data);
    }

    const incomingAppendix = config.appendix || {};
    const hidden = book.displaySettings || {};
    config.appendix = {
        is_from_creator: true,
        render: {
            item:
                typeof incomingAppendix.render?.item === "boolean"
                    ? incomingAppendix.render.item
                    : hidden.items !== "hidden",
            itemset:
                typeof incomingAppendix.render?.itemset === "boolean"
                    ? incomingAppendix.render.itemset
                    : hidden.itemsets !== "hidden",
            character:
                typeof incomingAppendix.render?.character === "boolean"
                    ? incomingAppendix.render.character
                    : hidden.characters !== "hidden",
            faction:
                typeof incomingAppendix.render?.faction === "boolean"
                    ? incomingAppendix.render.faction
                    : hidden.factions !== "hidden",
            realms:
                typeof incomingAppendix.render?.realms === "boolean"
                    ? incomingAppendix.render.realms
                    : hidden.realms !== "hidden",
            abilities:
                typeof incomingAppendix.render?.abilities === "boolean"
                    ? incomingAppendix.render.abilities
                    : hidden.abilities !== "hidden",
            skillset:
                typeof incomingAppendix.render?.skillset === "boolean"
                    ? incomingAppendix.render.skillset
                    : hidden.skillsets !== "hidden",
            definition:
                typeof incomingAppendix.render?.definition === "boolean"
                    ? incomingAppendix.render.definition
                    : hidden.definitions !== "hidden",
            relations:
                typeof incomingAppendix.render?.relations === "boolean"
                    ? incomingAppendix.render.relations
                    : hidden.relations !== "hidden",
            systems:
                typeof incomingAppendix.render?.systems === "boolean"
                    ? incomingAppendix.render.systems
                    : hidden.systems !== "hidden",
        },
        path: {
            item: incomingAppendix.path?.item || "appendix/item",
            itemset: incomingAppendix.path?.itemset || "appendix/itemset",
            character: incomingAppendix.path?.character || "appendix/character",
            faction: incomingAppendix.path?.faction || "appendix/faction",
            realms: incomingAppendix.path?.realms || "appendix/realms",
            abilities: incomingAppendix.path?.abilities || "appendix/abilities",
            skillset: incomingAppendix.path?.skillset || "appendix/skillset",
            definition:
                incomingAppendix.path?.definition || "appendix/definition",
            relations: incomingAppendix.path?.relations || "appendix/relations",
            systems: incomingAppendix.path?.systems || "appendix/systems",
        },
    };

    const appendixOn =
        config.render_appendix === true ||
        config.custom_toc?.override_appendix === true ||
        String(config.custom_toc?.override_appendix) === "true";

    if (appendixOn) {
        buildCreatorAppendixPackage(book, config, zip);

        const customMap = config.custom_toc?.appendix;
        (config.appendix.structure || []).forEach((sec) => {
            const rows = {};
            const groupRows = {};
            let n = 0;
            let gn = 0;
            const walk = (nodes) => {
                (nodes || []).forEach((ch) => {
                    n += 1;
                    rows[String(n)] = ch.href;
                    if (ch.kind === "group") {
                        gn += 1;
                        groupRows[String(gn)] = ch.href;
                    }
                    if (Array.isArray(ch.children)) walk(ch.children);
                });
            };
            walk(sec.children);
            if (n && customMap) customMap[`${sec.type}appendix`] = rows;
            if (sec.type === "item" && gn && customMap)
                customMap.itemsetappendix = groupRows;
            if (sec.type === "abilities" && gn && customMap)
                customMap.skillsetappendix = groupRows;
        });
    }

    zip.file("configuration.json", JSON.stringify(config, null, 2));
    if (options.verified && !zip.file(".verified")) {
        zip.file(".verified", "");
    }
    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}
function openCreationConfiguration(b) {
    const modal = $("#modal");
    modal.innerHTML = `<div class="modal-card" style="width:min(1100px,96vw);height:90vh;padding:0;overflow:hidden"><div class="modal-head"><strong>${tFn("creator.epub.config_title", "Cấu hình EPUB")}</strong><button class="icon-btn" id="creationConfigClose">×</button></div><iframe id="creationConfigFrame" title="EPUB configuration" style="width:100%;height:calc(100% - 55px);border:0"></iframe></div>`;
    modal.showModal();
    $("#creationConfigClose").onclick = () => modal.close();
    const frame = $("#creationConfigFrame");
    const onExportZip = async (event) => {
        if (event.source !== frame.contentWindow) return;
        if (event.data?.action !== "configuration_export_zip") return;
        try {
            const packageZip = await createCreatorParserZip(
                b,
                event.data.config || {},
                { verified: true },
            );
            if (event.data.toParser) {
                if (window.creatorParserZipUrl) {
                    URL.revokeObjectURL(window.creatorParserZipUrl);
                }
                window.creatorParserZipUrl = URL.createObjectURL(packageZip);
                frame.src =
                    "../mdt/library/creation_tools/parser/index.html?from=creator";
                return;
            }
            await download(packageZip, "ebook_package.zip");
        } catch (err) {
            alert(
                fmt(
                    tFn(
                        "creator.epub.zip_fail",
                        "Không thể xuất ZIP sách: {0}",
                    ),
                    err.message,
                ),
            );
        }
    };
    window.addEventListener("message", onExportZip);
    modal.addEventListener(
        "close",
        () => window.removeEventListener("message", onExportZip),
        { once: true },
    );
    frame.onload = () =>
        frame.contentWindow.postMessage(
            { action: "creator_config", config: creationConfigForBook(b) },
            "*",
        );
    frame.src =
        "../mdt/library/creation_tools/configuration/index.html?from=creator";
}
async function exportBook(format) {
    const b = await getBook(state.bookId);
    if (!b) return;
    const base = slug(b.title);
    if (format === "txt") {
        const content = "\uFEFF" + bookText(b);

        await download(
            new Blob([content], {
                type: "text/plain;charset=utf-8",
            }),
            base + ".txt",
        );

        return;
    }
    if (format === "json") {
        const out = JSON.parse(JSON.stringify(b));
        out.formulas = {};
        collectSystemFormulasInto(b, out.formulas);
        await download(
            new Blob([JSON.stringify(out, null, 2)], {
                type: "application/json",
            }),
            base + ".json",
        );
        return;
    }
    if (format === "epub" || format === "kindle") {
        openCreationConfiguration(b);
        return;
    }
    if (!window.JSZip) {
        alert(
            tFn(
                "creator.exp.need_jszip_epub",
                "EPUB export cần JSZip. Hãy mở trang khi có Internet để tải thư viện.",
            ),
        );
        return;
    }
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.folder("META-INF").file(
        "container.xml",
        `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    );
    let manifest = "",
        spine = "";
    const op = zip.folder("OEBPS");
    let coverProp = "";
    if (b.cover) {
        const [head, data] = b.cover.split(",");
        const ext = (head.match(/image\/([^;]+)/) || [])[1] || "jpeg";
        const file = "cover." + ext.replace("svg+xml", "svg");
        const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        op.file(file, bin);
        manifest += `<item id="cover-image" href="${file}" media-type="image/${ext}" properties="cover-image"/>`;
        coverProp = `<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
        op.file(
            "cover.xhtml",
            `<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="${file}" alt="Cover"/></body></html>`,
        );
    }
    for (const c of [...b.chapters].sort((a, z) => a.number - z.number)) {
        const fn = `chapter-${c.number}.xhtml`,
            id = "ch" + c.number;
        const body = esc(c.content || "").replace(/\n/g, "<br/>");
        const chapterHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"/>
    <title>${esc(c.title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
    <h1>${tFn("creator.ch.chapter_num", "Chương")} ${c.number}: ${esc(c.title)}</h1>
    <div class="chapter-content">
        ${esc(c.content || "").replace(/\n/g, "<br/>")}
    </div>
</body>
</html>`;

        op.file(fn, chapterHTML);
        manifest += `<item id="${id}" href="${fn}" media-type="application/xhtml+xml"/>`;
        spine += `<itemref idref="${id}"/>`;
    }
    op.file(
        "style.css",
        "body{font-family:serif;line-height:1.55}h1{text-align:center;margin:2em 0}p{text-align:justify}",
    );
    manifest += `<item id="css" href="style.css" media-type="text/css"/>`;
    if (coverProp) manifest += coverProp;
    op.file(
        "content.opf",
        `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${b.id}</dc:identifier><dc:title>${esc(b.title)}</dc:title><dc:language>vi</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`,
    );
    const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
    });
    await download(blob, base + ".epub");
}
async function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!data.id || !data.title)
            throw Error(tFn("creator.toast.bad_json", "JSON không hợp lệ"));
        await putBook(normalizeBook(data));
        toast(tFn("creator.toast.imported", "Đã import"));
        render();
    } catch (err) {
        alert(
            tFn("creator.toast.import_fail", "Import thất bại: ") + err.message,
        );
    }
    e.target.value = "";
}

$("#mainNav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    if (b.dataset.view === "create") state.returnTo = "dashboard";
    setView(b.dataset.view);
    saveState();
});
$("#quickExport").onclick = () => {
    state.tab = "export";
    saveState();
    render();
};
function creatorInitSidebar() {
    const dd = $("#libraryDropdown");
    const toggle = $("#libraryToggle");
    if (toggle && dd) {
        toggle.onclick = (e) => {
            e.stopPropagation();
            dd.classList.toggle("open");
        };
    }
    document.addEventListener("click", (e) => {
        if (dd && dd.classList.contains("open") && !dd.contains(e.target)) {
            dd.classList.remove("open");
        }
    });
}
creatorInitSidebar();

if (typeof onI18nChange === "function") {
    onI18nChange(() => render());
}
try {
    if (window.parent && window.parent !== window) {
        const lw = document.querySelector(".lang-wrapper");
        if (lw) lw.style.display = "none";
    }
} catch (e) {}
(async () => {
    await openDB();

    const restored = restoreState();
    if (restored && state.view === "manage" && state.bookId) {
        try {
            const b = await getBook(state.bookId);
            if (!b) {
                state.view = "dashboard";
                state.bookId = null;
                state.tab = "chapters";
                state.systemDslId = null;
            }
        } catch (e) {
            state.view = "dashboard";
            state.bookId = null;
        }
    }
    render();
})().catch((e) => {
    console.error(e);
    alert(
        fmt(
            tFn("creator.startup.idb_fail", "Không thể mở IndexedDB: {0}"),
            e.message,
        ),
    );
});
