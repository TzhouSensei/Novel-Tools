(function () {
    "use strict";

    let currentBook = null;
    let currentChapters = [];

    function tFn(key, fallback) {
        return typeof t === "function" ? t(key, fallback) : fallback;
    }

    function toast(msg) {
        const el = document.getElementById("toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => el.classList.remove("show"), 2500);
    }

    function escapeHtml(str) {
        const A = () => String.fromCharCode(38);
        return String(str)
            .replace(/&/g, () => A() + "amp;")
            .replace(/</g, () => A() + "lt;")
            .replace(/>/g, () => A() + "gt;")
            .replace(/"/g, () => A() + "quot;");
    }

    async function init() {
        const bookId = localStorage.getItem("mdt_active_book_id");
        if (!bookId) {
            window.location.href = "index.html";
            return;
        }

        currentBook = await mdtGetBook(bookId);
        if (!currentBook) {
            toast(tFn("mdt.reader.book_not_found", "Không tìm thấy truyện!"));
            setTimeout(() => (window.location.href = "index.html"), 1500);
            return;
        }

        currentChapters = await mdtGetChapters(bookId);

        document.getElementById("story-title").textContent =
            currentBook.title || "";
        document.getElementById("story-desc").textContent =
            currentBook.description || "";

        renderChapterList();
    }

    function renderChapterList() {
        const list = document.getElementById("chapter-list");
        list.innerHTML = "";

        if (currentChapters.length === 0) {
            list.innerHTML = `<p style="color:#999;text-align:center;padding:20px;grid-column:1/-1;">${tFn("mdt.reader.no_chapters", "Chưa có chương nào.")}</p>`;
            return;
        }

        currentChapters.forEach((ch) => {
            const item = document.createElement("div");
            item.className = "chapter-item" + (ch.read ? " read" : "");
            item.dataset.chapterId = ch.id;

            const readLabel = ch.read
                ? tFn("mdt.reader.read", "Đã đọc")
                : tFn("mdt.reader.unread", "Chưa đọc");

            item.innerHTML = `
                <span class="chapter-title">${escapeHtml(ch.title)}</span>
                <span class="chapter-status">${readLabel}</span>
            `;

            item.addEventListener("click", () => {
                localStorage.setItem("mdt_active_chapter_id", ch.id);
                window.location.href = "chapter.html";
            });

            list.appendChild(item);
        });
    }

    document.addEventListener("DOMContentLoaded", init);

    if (typeof onI18nChange === "function") {
        onI18nChange(() => {
            applyReaderI18n();
            renderChapterList();
        });
    }

    function applyReaderI18n() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (!key) return;
            el.textContent = t(key);
        });
    }
})();
