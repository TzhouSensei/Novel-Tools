document.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.querySelector(".lang-wrapper");

    if (!wrapper) return;

    wrapper.innerHTML = `
        <label
            class="lang-label"
            data-i18n="lang.option"
            for="lang-select"
        ></label>

        <select
            id="lang-select"
            class="lang-select"
            onchange="setLang(this.value)"
        >
            <option value="vi-vn">🇻🇳 Tiếng Việt</option>
            <option value="en-us">🇺🇸 English</option>
            <option value="ja-jp">🇯🇵 日本語</option>
            <option value="ko-kr">🇰🇷 한국어</option>
            <option value="zh-cn">🇨🇳 简体中文</option>
            <option value="zh-tw">🇹🇼 繁體中文</option>
            <option value="th-th">🇹🇭 ไทย</option>
            <option value="id-id">🇮🇩 Indonesia</option>
            <option value="de-de">🇩🇪 Deutsch</option>
            <option value="fr-fr">🇫🇷 Français</option>
            <option value="es-es">🇪🇸 Español</option>
            <option value="la">🏛️ Latina</option>
            <option value="ru-ru">🇷🇺 Русский</option>
            <option value="nl-nl">🇳🇱 Nederlands</option>
            <option value="tr-tr">🇹🇷 Türkçe</option>
            <option value="hi-in">🇮🇳 हिन्दी</option>
        </select>
    `;

    const select = wrapper.querySelector("#lang-select");

    const currentLang =
        localStorage.getItem("lang") ||
        localStorage.getItem("language") ||
        "vi-vn";

    select.value = currentLang;
});
