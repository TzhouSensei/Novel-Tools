(function () {
    "use strict";

    let searchQuery = "";
    let sortMode = "recent";

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

    async function renderStories() {
        const list = document.getElementById("stories-list");
        list.innerHTML = "";

        let books = await mdtGetAllBooks();

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            books = books.filter(
                (b) =>
                    (b.title || "").toLowerCase().includes(q) ||
                    (b.description || "").toLowerCase().includes(q),
            );
        }

        books.sort((a, b) => {
            switch (sortMode) {
                case "title":
                    return (a.title || "").localeCompare(b.title || "");
                case "created":
                    return (b.createdAt || 0) - (a.createdAt || 0);
                case "recent":
                default:
                    return (b.lastReadAt || 0) - (a.lastReadAt || 0);
            }
        });

        if (books.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="big-icon">📖</div>
                    <p>${tFn("mdt.library.empty", "Thư viện trống. Hãy import file TXT hoặc tạo truyện mới!")}</p>
                    <button class="btn btn-primary" onclick="document.getElementById('library-file-input').click()">
                        ${tFn("mdt.library.import", "➕ Import truyện")}
                    </button>
                </div>
            `;
            return;
        }

        books.forEach((book) => {
            const card = document.createElement("div");
            card.className = "story-card";

            const coverHtml = `
                <img class="story-cover" src="data:image/svg+xml;utf8,${encodeURIComponent(
                    `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='78' viewBox='0 0 56 78'><rect width='56' height='78' fill='%23ccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%23666'>${tFn("library.no_cover", "No Cover")}</text></svg>`,
                )}" alt="Cover" />`;

            const readLabel = tFn("mdt.library.read", "Đọc");
            const editLabel = tFn("mdt.library.edit", "Sửa");

            card.innerHTML = `
                ${coverHtml}
                <div class="story-info">
                    <div class="story-title">${escapeHtml(book.title || "")}</div>
                    <div class="story-meta">
                        ${tFn("mdt.library.chapters", "Chương")}: ${book.chapterCount || 0}
                        ${book.lastReadChapterIndex ? ` · ${tFn("mdt.library.last_read", "Đọc tới")} #${book.lastReadChapterIndex + 1}` : ""}
                    </div>
                </div>
                <div class="story-actions">
                    <button class="btn-read">📖 ${readLabel}</button>
                    <button class="btn-edit">✏️ ${editLabel}</button>
                    <button class="btn-delete-story" title="Xóa">🗑</button>
                </div>
            `;

            card.querySelector(".btn-read").addEventListener("click", (e) => {
                e.stopPropagation();
                openReader(book.id);
            });

            card.querySelector(".btn-edit").addEventListener("click", (e) => {
                e.stopPropagation();
                openEditor(book.id);
            });

            card.querySelector(".btn-delete-story").addEventListener(
                "click",
                async (e) => {
                    e.stopPropagation();
                    if (
                        !confirm(
                            tFn("library.confirm_delete", "Xóa truyện này?"),
                        )
                    )
                        return;
                    await mdtDeleteBook(book.id);
                    toast(tFn("mdt.library.deleted", "Đã xóa truyện!"));
                    renderStories();
                },
            );

            list.appendChild(card);
        });
    }

    function openReader(bookId) {
        localStorage.setItem("mdt_active_book_id", bookId);
        window.location.href = "reader.html";
    }

    function openEditor(bookId) {
        localStorage.setItem("mdt_active_book_id", bookId);
        window.location.href = "editor.html";
    }

    function escapeHtml(str) {
        const A = () => String.fromCharCode(38);
        return String(str)
            .replace(/&/g, () => A() + "amp;")
            .replace(/</g, () => A() + "lt;")
            .replace(/>/g, () => A() + "gt;")
            .replace(/"/g, () => A() + "quot;");
    }

    async function handleImportFiles(files) {
        const fileArray = Array.from(files).filter((f) =>
            f.name.endsWith(".txt"),
        );
        if (fileArray.length === 0) return;

        for (const file of fileArray) {
            toast(tFn("mdt.library.importing", "Đang nhập: ") + file.name);
            try {
                const text = await file.text();
                const parsed = parseMDTText(
                    text,
                    file.name.replace(/\.txt$/i, ""),
                );
                await mdtCreateBook(parsed, file.name);
                toast(tFn("mdt.library.imported", "Đã nhập: ") + parsed.title);
            } catch (err) {
                console.error(err);
                toast(
                    tFn("mdt.library.import_error", "Lỗi khi nhập: ") +
                        file.name,
                );
            }
        }

        document.getElementById("library-file-input").value = "";
        renderStories();
    }

    function showCreateModal() {
        document.getElementById("create-modal").classList.add("show");
        document.getElementById("create-title").value = "";
        document.getElementById("create-desc").value = "";
        document.getElementById("create-chars").value = "";
        document.getElementById("create-title").focus();
    }

    function hideCreateModal() {
        document.getElementById("create-modal").classList.remove("show");
    }

    async function handleCreateStory() {
        const title = document.getElementById("create-title").value.trim();
        if (!title) {
            toast(
                tFn("mdt.library.create.need_title", "Vui lòng nhập tiêu đề!"),
            );
            return;
        }

        const desc = document.getElementById("create-desc").value.trim();
        const chars = document
            .getElementById("create-chars")
            .value.split("\n")
            .map((c) => c.trim())
            .filter(Boolean);

        const book = await mdtCreateBook(
            {
                title: title,
                description: desc || "Chưa cập nhật",
                characters: chars,
                chapters: [
                    {
                        title: "1.Chương mở đầu",
                        body: "•\nNội dung chương ở đây\n•",
                    },
                ],
            },
            "",
        );

        hideCreateModal();
        renderStories();
        openEditor(book.id);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document
            .getElementById("library-file-input")
            .addEventListener("change", (e) => {
                handleImportFiles(e.target.files);
            });

        document
            .getElementById("createStoryBtn")
            .addEventListener("click", showCreateModal);
        document
            .getElementById("create-cancel")
            .addEventListener("click", hideCreateModal);
        document
            .getElementById("create-ok")
            .addEventListener("click", handleCreateStory);

        document
            .getElementById("search-input")
            .addEventListener("input", (e) => {
                searchQuery = e.target.value.toLowerCase();
                renderStories();
            });

        document
            .getElementById("sort-select")
            .addEventListener("change", (e) => {
                sortMode = e.target.value;
                renderStories();
            });

        renderStories();
    });

    if (typeof onI18nChange === "function") {
        onI18nChange(() => {
            applyLibraryI18n();
            renderStories();
        });
    }

    function applyLibraryI18n() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (!key) return;
            el.textContent = t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (!key) return;
            el.placeholder = t(key);
        });
    }
})();
