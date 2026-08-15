(function () {
    "use strict";

    let currentBook = null;
    let currentChapters = [];
    let currentChapterId = null;

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

    async function init() {
        const bookId = localStorage.getItem("mdt_active_book_id");
        const chapterId = localStorage.getItem("mdt_active_chapter_id");

        if (!bookId || !chapterId) {
            window.location.href = "reader.html";
            return;
        }

        currentBook = await mdtGetBook(bookId);
        if (!currentBook) {
            toast(tFn("mdt.reader.book_not_found", "Không tìm thấy truyện!"));
            setTimeout(() => (window.location.href = "reader.html"), 1500);
            return;
        }

        currentChapters = await mdtGetChapters(bookId);
        currentChapterId = chapterId;

        const chapter = currentChapters.find((c) => c.id === chapterId);
        if (!chapter) {
            toast(
                tFn("mdt.reader.chapter_not_found", "Không tìm thấy chương!"),
            );
            setTimeout(() => (window.location.href = "reader.html"), 1500);
            return;
        }

        renderChapter(chapter);
    }

    async function renderChapter(chapter) {
        currentChapterId = chapter.id;

        if (!chapter.read) {
            await mdtMarkChapterRead(chapter.id);
            chapter.read = true;
        }

        await mdtUpdateBookLastRead(currentBook.id, chapter.id, chapter.index);

        localStorage.setItem("mdt_active_chapter_id", chapter.id);

        const titleEl = document.getElementById("content-title");
        titleEl.textContent = chapter.title;
        titleEl.onclick = () => {
            window.location.href = "reader.html";
        };

        document.getElementById("chapter-content").innerHTML =
            renderChapterHTML(chapter.body, tFn);

        const idx = chapter.index;
        const isFirst = idx <= 0;
        const isLast = idx >= currentChapters.length - 1;

        const prevTop = document.getElementById("prev-btn-top");
        const nextTop = document.getElementById("next-btn-top");
        const prevBottom = document.getElementById("prev-btn-bottom");
        const nextBottom = document.getElementById("next-btn-bottom");

        [prevTop, prevBottom].forEach((btn) => {
            btn.disabled = isFirst;
            btn.onclick = () => {
                if (idx > 0) renderChapter(currentChapters[idx - 1]);
            };
        });

        [nextTop, nextBottom].forEach((btn) => {
            btn.disabled = isLast;
            btn.onclick = () => {
                if (idx < currentChapters.length - 1)
                    renderChapter(currentChapters[idx + 1]);
            };
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.addEventListener("DOMContentLoaded", init);

    if (typeof onI18nChange === "function") {
        onI18nChange(() => {
            applyChapterI18n();
        });
    }

    function applyChapterI18n() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (!key) return;
            el.textContent = t(key);
        });
    }
})();
