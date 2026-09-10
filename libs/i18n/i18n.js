let translations = {};

let langReady = false;

let currentLang = "vi-vn";

async function loadLang(lang) {
    let path = `libs/i18n/locale/${lang}.json`;

    for (let i = 0; i < 7; i++) {
        try {
            const res = await fetch(path);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            translations = await res.json();

            currentLang = lang;
            document.documentElement.lang = lang;

            langReady = true;

            applyI18n();

            syncLangSelect(lang);

            i18nListeners.forEach((fn) => fn(lang, translations));

            return;
        } catch (err) {
            path = "../" + path;
        }
    }

    console.error(`Không thể tải file ngôn ngữ: ${lang}.json sau 7 lần thử.`);
}
function t(key, fallback = key) {
    if (translations[key] !== undefined) {
        return translations[key];
    }

    const parts = key.split(".");

    let value = parts.reduce((obj, part) => {
        return obj && obj[part] !== undefined ? obj[part] : undefined;
    }, translations);

    if (value !== undefined && typeof value !== "object") {
        return value;
    }

    let obj = translations;
    for (let i = 0; i < parts.length - 1; i++) {
        obj = obj && obj[parts[i]] !== undefined ? obj[parts[i]] : undefined;
        if (!obj || typeof obj !== "object") break;

        const rest = parts.slice(i + 1).join(".");
        if (obj[rest] !== undefined && typeof obj[rest] !== "object") {
            return obj[rest];
        }
    }

    return typeof value === "object" ? fallback : (value ?? fallback);
}

function applyI18n() {
    if (!translations || Object.keys(translations).length === 0) return;
    const put = (el, val) => {
        if (
            val === undefined ||
            val === null ||
            val === el.getAttribute("data-i18n")
        )
            return;
        el.innerText = val;
    };
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        put(el, t(key));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const key = el.getAttribute("data-i18n-title");
        const val = t(key);
        if (val !== key) el.title = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        const val = t(key);
        if (val !== key) el.placeholder = val;
    });
}

function setLang(lang) {
    localStorage.setItem("lang", lang);
    loadLang(lang);
}

const i18nListeners = [];
loadLang(localStorage.getItem("lang") || "vi-vn");

function onI18nChange(fn) {
    i18nListeners.push(fn);
}
function syncLangSelect(lang) {
    const select = document.querySelector("#lang-select, .lang-select");
    if (select) {
        select.value = lang;
    }
}
