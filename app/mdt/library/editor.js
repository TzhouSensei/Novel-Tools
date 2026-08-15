(function () {
    "use strict";

    let currentBook = null;
    let currentChapters = [];
    let editingChapterId = null;

    let fnrMatches = [];
    let fnrCurrentMatch = -1;
    let fnrPanelVisible = false;

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

    function switchTab(tabName) {
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tab === tabName);
        });
        document.querySelectorAll(".tab-panel").forEach((panel) => {
            panel.classList.toggle("active", panel.id === "tab-" + tabName);
        });
    }

    function loadMetadata() {
        document.getElementById("meta-title").value = currentBook.title || "";
        document.getElementById("meta-description").value =
            currentBook.description || "";
        document.getElementById("meta-characters").value = (
            currentBook.characters || []
        ).join("\n");
        document.getElementById("meta-enable-config").checked =
            currentBook.enableConfig || false;
    }

    async function saveMetadata() {
        const title = document.getElementById("meta-title").value.trim();
        if (!title) {
            toast(
                tFn("mdt.library.create.need_title", "Vui lòng nhập tiêu đề!"),
            );
            return;
        }

        currentBook.title = title;
        currentBook.description = document
            .getElementById("meta-description")
            .value.trim();
        currentBook.characters = document
            .getElementById("meta-characters")
            .value.split("\n")
            .map((c) => c.trim())
            .filter(Boolean);
        currentBook.enableConfig =
            document.getElementById("meta-enable-config").checked;
        currentBook.updatedAt = Date.now();

        await mdtSaveBook(currentBook);
        toast(tFn("mdt.editor.meta.saved", "Đã lưu thông tin truyện!"));
    }

    function renderChapterList() {
        const list = document.getElementById("chapter-list");
        list.innerHTML = "";

        if (currentChapters.length === 0) {
            list.innerHTML = `<p style="color:#999;text-align:center;padding:20px;grid-column:1/-1;">${tFn("mdt.reader.no_chapters", "Chưa có chương nào.")}</p>`;
            return;
        }

        currentChapters.forEach((ch) => {
            const row = document.createElement("div");
            row.className = "chapter-row";

            const readLabel = ch.read
                ? tFn("mdt.reader.read", "Đã đọc")
                : tFn("mdt.reader.unread", "Chưa đọc");

            row.innerHTML = `
                <span class="ch-index">${ch.index + 1}</span>
                <span class="ch-title-text">${escapeHtml(ch.title)}</span>
                <span class="ch-read">${readLabel}</span>
            `;

            row.addEventListener("click", () => openChapterEditor(ch));

            list.appendChild(row);
        });
    }

    function openChapterEditor(chapter) {
        editingChapterId = chapter.id;

        document.getElementById("modal-chapter-title").textContent =
            tFn("mdt.editor.modal.title", "Chỉnh sửa chương") +
            " #" +
            (chapter.index + 1);
        document.getElementById("modal-title-input").value = chapter.title;
        document.getElementById("modal-body-input").value = chapter.body;

        document.getElementById("editor-modal").classList.add("show");
        document.getElementById("modal-title-input").focus();

        fnrReset();
        hideFnrPanel();
        updateBodyOverlay();
    }

    function hideChapterEditor() {
        document.getElementById("editor-modal").classList.remove("show");
        editingChapterId = null;
        fnrReset();
        hideFnrPanel();
    }

    async function saveChapterEditor() {
        if (!editingChapterId) return;

        const title = document.getElementById("modal-title-input").value.trim();
        if (!title) {
            toast(
                tFn(
                    "mdt.editor.modal.need_title",
                    "Vui lòng nhập tiêu đề chương!",
                ),
            );
            return;
        }

        const body = document.getElementById("modal-body-input").value;

        const chapter = currentChapters.find((c) => c.id === editingChapterId);
        if (!chapter) return;

        if (chapter.title !== title) {
            await mdtRenameChapter(chapter.id, title);
            chapter.title = title;
        }
        await mdtUpdateChapterContent(chapter.id, body);
        chapter.body = body;

        currentBook.updatedAt = Date.now();
        await mdtSaveBook(currentBook);

        hideChapterEditor();
        renderChapterList();
        toast(tFn("mdt.editor.modal.saved", "Đã lưu chương!"));
    }

    async function addNewChapter() {
        const title = "Chương mới " + (currentChapters.length + 1);
        const body = "•\nNội dung chương ở đây\n•";
        const chapter = await mdtAddChapter(currentBook.id, title, body);

        currentChapters.push(chapter);
        currentBook.chapterCount = currentChapters.length;
        currentBook.updatedAt = Date.now();
        await mdtSaveBook(currentBook);

        renderChapterList();
        openChapterEditor(chapter);
    }

    function fnrTogglePanel() {
        if (fnrPanelVisible) {
            hideFnrPanel();
        } else {
            showFnrPanel();
        }
    }

    function showFnrPanel() {
        fnrPanelVisible = true;
        document.getElementById("fnr-panel").classList.add("show");
        document.getElementById("fnr-find-input").focus();
        fnrFind();
    }

    function hideFnrPanel() {
        fnrPanelVisible = false;
        const panel = document.getElementById("fnr-panel");
        if (panel) panel.classList.remove("show");
        fnrReset();
        updateBodyOverlay();
    }

    function fnrReset() {
        fnrMatches = [];
        fnrCurrentMatch = -1;
        const counter = document.getElementById("fnr-match-counter");
        if (counter) counter.textContent = "0/0";
    }

    function fnrGetRegex(text, mode) {
        if (!text) return null;
        try {
            if (mode === "regex") return new RegExp(text, "g");
            let escaped = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            if (mode === "all") return new RegExp("\\b" + escaped + "\\b", "g");
            if (mode === "around") return new RegExp(escaped, "gi");
        } catch (e) {
            return null;
        }
        return null;
    }

    function fnrFind() {
        fnrReset();
        const findValue = document.getElementById("fnr-find-input").value;
        if (!findValue) {
            updateBodyOverlay();
            return;
        }
        const mode = document.querySelector(
            'input[name="fnr-mode"]:checked',
        ).value;
        const regex = fnrGetRegex(findValue, mode);
        if (!regex) return;

        const text = document.getElementById("modal-body-input").value;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index === regex.lastIndex) regex.lastIndex++;
            fnrMatches.push({
                start: match.index,
                end: regex.lastIndex,
                matchedText: match[0],
            });
        }

        if (fnrMatches.length > 0) {
            fnrCurrentMatch = 0;
        }
        fnrUpdateCounter();
        fnrUpdateOverlay();
    }

    function fnrUpdateCounter() {
        const counter = document.getElementById("fnr-match-counter");
        if (!counter) return;
        if (fnrMatches.length === 0) {
            counter.textContent = "0/0";
        } else {
            counter.textContent = `${fnrCurrentMatch + 1}/${fnrMatches.length}`;
        }
    }

    function fnrNavigate(direction) {
        if (fnrMatches.length === 0) return;
        if (direction === "next") {
            fnrCurrentMatch = (fnrCurrentMatch + 1) % fnrMatches.length;
        } else {
            fnrCurrentMatch =
                (fnrCurrentMatch - 1 + fnrMatches.length) % fnrMatches.length;
        }
        fnrUpdateCounter();
        fnrUpdateOverlay();

        const textarea = document.getElementById("modal-body-input");
        const match = fnrMatches[fnrCurrentMatch];
        textarea.focus();
        textarea.setSelectionRange(match.start, match.end);
    }

    function fnrReplaceSingle() {
        if (fnrCurrentMatch === -1 || fnrMatches.length === 0) return;
        const textarea = document.getElementById("modal-body-input");
        const match = fnrMatches[fnrCurrentMatch];
        const replaceValue = document.getElementById("fnr-replace-input").value;

        textarea.value =
            textarea.value.substring(0, match.start) +
            replaceValue +
            textarea.value.substring(match.end);

        fnrFind();
        if (fnrMatches.length > 0) {
            fnrCurrentMatch = Math.min(fnrCurrentMatch, fnrMatches.length - 1);
            fnrUpdateCounter();
            fnrUpdateOverlay();
        }
    }

    function fnrReplaceAll() {
        const findValue = document.getElementById("fnr-find-input").value;
        if (!findValue) return;
        const mode = document.querySelector(
            'input[name="fnr-mode"]:checked',
        ).value;
        const regex = fnrGetRegex(findValue, mode);
        if (!regex) return;

        const textarea = document.getElementById("modal-body-input");
        textarea.value = textarea.value.replace(
            regex,
            document.getElementById("fnr-replace-input").value,
        );

        fnrFind();
    }

    function safeEscapeText(text) {
        const A = () => String.fromCharCode(38);
        return String(text)
            .split("&")
            .join(A() + "amp;")
            .split("<")
            .join(A() + "lt;")
            .split(">")
            .join(A() + "gt;");
    }

    function fnrUpdateOverlay() {
        const textarea = document.getElementById("modal-body-input");
        const overlay = document.getElementById("body-overlay");
        if (!textarea || !overlay) return;
        const findValue = document.getElementById("fnr-find-input").value;
        if (!findValue || fnrMatches.length === 0) {
            overlay.innerHTML = safeEscapeText(textarea.value).replace(
                /\n/g,
                "<br>",
            );
            return;
        }
        const text = textarea.value;
        let html = "";
        let lastIndex = 0;
        fnrMatches.forEach((m, i) => {
            html += safeEscapeText(text.substring(lastIndex, m.start));
            const cls = i === fnrCurrentMatch ? "fnr-active-mark" : "";
            html += `<mark class="${cls}">${safeEscapeText(m.matchedText)}</mark>`;
            lastIndex = m.end;
        });
        html += safeEscapeText(text.substring(lastIndex));
        overlay.innerHTML = html;
    }

    function updateBodyOverlay() {
        const textarea = document.getElementById("modal-body-input");
        const overlay = document.getElementById("body-overlay");
        if (!textarea || !overlay) return;
        overlay.innerHTML = safeEscapeText(textarea.value).replace(
            /\n/g,
            "<br>",
        );
    }

    function downloadFullTxt() {
        const story = {
            title: currentBook.title,
            description: currentBook.description,
            characters: currentBook.characters || [],
            chapters: currentChapters.map((c) => ({
                title: c.title,
                body: c.body,
            })),
        };
        const text = buildMDTText(story);
        const blob = new Blob([text], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const safeName = String(story.title)
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
            .replace(/\s+/g, "_");
        a.download = safeName + "_full.txt";
        a.click();
        URL.revokeObjectURL(a.href);
        toast(tFn("mdt.editor.other.downloaded", "Đã tải file TXT!"));
    }

    function escapeHTML(str) {
        const A = () => String.fromCharCode(38);
        return String(str)
            .replace(/&/g, () => A() + "amp;")
            .replace(/</g, () => A() + "lt;")
            .replace(/>/g, () => A() + "gt;")
            .replace(/"/g, () => A() + "quot;")
            .replace(/'/g, () => A() + "#039;");
    }

    function cleanChapterBody(text) {
        let t = String(text).trim();

        if (t.startsWith("•")) {
            t = t.slice(1);
        }

        if (t.endsWith("•")) {
            t = t.slice(0, -1);
        }

        return t.trim();
    }

    function escapeText(text) {
        const A = () => String.fromCharCode(38);
        return String(text)
            .replace(/&/g, () => A() + "amp;")
            .replace(/</g, () => A() + "lt;")
            .replace(/>/g, () => A() + "gt;")
            .replace(/"/g, () => A() + "quot;");
    }

    function extractPlainLines(text) {
        return String(text)
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    function groupSentencesForBr(lines, parsingType) {
        const grouped = [];
        const isBrSingle = parsingType === "br-single";

        if (isBrSingle) {
            lines.forEach((line) => {
                const sentences = line.match(/[^.!?。！？]+[.!?。！？]*/g) || [
                    line,
                ];
                let buffer = [];

                sentences.forEach((sentence) => {
                    sentence = sentence.trim();
                    if (!sentence) return;

                    if (sentence.length > 30) {
                        if (buffer.length > 0) {
                            const joined = buffer.join(" ");
                            if (joined.trim()) grouped.push(joined.trim());
                            buffer = [];
                        }
                        grouped.push(sentence);
                    } else {
                        buffer.push(sentence);
                        if (buffer.length >= 2) {
                            const joined = buffer.join(" ");
                            const total = buffer
                                .map((s) => s.length)
                                .reduce((a, b) => a + b, 0);
                            if (total <= 20 || buffer.length === 2) {
                                grouped.push(joined.trim());
                                buffer = [];
                            }
                        }
                    }
                });

                if (buffer.length > 0) {
                    const joined = buffer.join(" ");
                    if (joined.trim()) grouped.push(joined.trim());
                }
            });
        } else {
            lines.forEach((line) => {
                grouped.push(line.trim());
            });
        }

        return grouped;
    }

    function hasNoLineBreaks(text) {
        if (!text) return false;
        const normalized = String(text)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/\r\n/g, "\n")
            .replace(/\n{2,}/g, "\n");
        return !normalized.includes("\n");
    }

    function applyParsingToBody(body, parseConfig = {}) {
        const parsingType = parseConfig.parsing_type || "single";
        let parentTag = "";
        if (
            parseConfig.parent_tag !== undefined &&
            parseConfig.parent_tag !== null
        ) {
            parentTag = String(parseConfig.parent_tag).trim().toLowerCase();
        } else {
            parentTag = "p";
        }
        const childTag = String(parseConfig.child_tag || "p")
            .trim()
            .toLowerCase();

        const rawLines = String(body).split("\n");
        let titleText = "";
        let bodyText = body;
        if (rawLines.length > 0 && rawLines[0].trim()) {
            const firstLine = rawLines[0].trim();
            const rest = rawLines.slice(1).join("\n");
            if (rest.trim()) {
                titleText = firstLine;
                bodyText = rest;
            }
        }

        const lines = extractPlainLines(bodyText);
        const noLineBreaks = hasNoLineBreaks(bodyText);
        let finalBody = "";

        if (parsingType === "single") {
            const text = lines.join("\n");
            if (parentTag) {
                finalBody = `<${parentTag} style="text-indent: 2em; line-height: 1.6;">${escapeText(text)}</${parentTag}>`;
            } else {
                finalBody = `<pre style="text-indent: 2em; line-height: 1.6;">${escapeText(text)}</pre>`;
            }
        } else if (parsingType === "br-single") {
            if (noLineBreaks) {
                const groups = groupSentencesForBr(lines, "br-single");
                if (parentTag) {
                    finalBody = groups
                        .map(
                            (g) =>
                                `<${parentTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(g)}</${parentTag}>`,
                        )
                        .join("<br/>");
                } else {
                    finalBody = groups
                        .map(
                            (g) =>
                                `<pre style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(g)}</pre>`,
                        )
                        .join("<br/>");
                }
            } else {
                if (parentTag) {
                    finalBody = lines
                        .map(
                            (line) =>
                                `<${parentTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(line)}</${parentTag}>`,
                        )
                        .join("<br/>");
                } else {
                    finalBody = lines
                        .map(
                            (line) =>
                                `<pre style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(line)}</pre>`,
                        )
                        .join("<br/>");
                }
            }
        } else if (parsingType === "multiple") {
            const children = lines
                .map(
                    (line) =>
                        `<${childTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(line)}</${childTag}>`,
                )
                .join("");

            if (parentTag) {
                finalBody = `<${parentTag}>${children}</${parentTag}>`;
            } else {
                finalBody = children;
            }
        } else if (parsingType === "br-multiple") {
            const groups = groupSentencesForBr(lines, "br-multiple");
            const children = groups
                .map(
                    (g) =>
                        `<${childTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(g)}</${childTag}>`,
                )
                .join("<br/>");

            if (parentTag) {
                finalBody = `<${parentTag}>${children}</${parentTag}>`;
            } else {
                finalBody = children;
            }
        }

        if (titleText) {
            finalBody =
                `<h2 style="text-align: center;">${escapeText(titleText)}</h2>\n` +
                finalBody;
        }

        return finalBody;
    }

    async function downloadFullZip() {
        if (typeof JSZip === "undefined") {
            toast(
                tFn(
                    "mdt.editor.other.zip_no_lib",
                    "Thư viện JSZip chưa được tải!",
                ),
            );
            return;
        }

        const zip = new JSZip();

        const folderName =
            String(currentBook.title || "story")
                .replace(/[<>:"/\\|?*]/g, "")
                .trim() || "story";

        const parseConfig = {
            parsing_type: "br-multiple",
            parent_tag: "p",
            child_tag: "p",
        };

        currentChapters.forEach((ch, i) => {
            const cleanBody = cleanChapterBody(ch.body);
            const parsedBody = applyParsingToBody(cleanBody, parseConfig);

            zip.file(
                `${i}.xhtml`,
                `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${escapeHTML(ch.title)}</title>
</head>
<body>

<h1>${escapeHTML(ch.title)}</h1>

${parsedBody}

</body>
</html>`,
            );
        });

        if (currentBook.enableConfig) {
            zip.file(".verified", "");
        }

        const blob = await zip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = folderName + ".zip";
        a.click();
        URL.revokeObjectURL(a.href);

        toast(tFn("mdt.editor.other.zip_downloaded", "Đã tải file ZIP!"));
    }

    async function resetStory() {
        if (
            !confirm(
                tFn(
                    "mdt.editor.other.reset_confirm",
                    "Reset toàn bộ truyện này?",
                ),
            )
        )
            return;
        await mdtDeleteBook(currentBook.id);
        localStorage.removeItem("mdt_active_book_id");
        window.location.href = "index.html";
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

        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        });

        loadMetadata();
        document
            .getElementById("meta-save")
            .addEventListener("click", saveMetadata);

        renderChapterList();
        document
            .getElementById("add-chapter-btn")
            .addEventListener("click", addNewChapter);

        document
            .getElementById("modal-close")
            .addEventListener("click", hideChapterEditor);
        document
            .getElementById("modal-cancel")
            .addEventListener("click", hideChapterEditor);
        document
            .getElementById("modal-save")
            .addEventListener("click", saveChapterEditor);

        document
            .getElementById("fnr-toggle-btn")
            .addEventListener("click", fnrTogglePanel);
        document
            .getElementById("fnr-close-btn")
            .addEventListener("click", hideFnrPanel);
        document
            .getElementById("fnr-find-input")
            .addEventListener("input", fnrFind);
        document.querySelectorAll('input[name="fnr-mode"]').forEach((radio) => {
            radio.addEventListener("change", fnrFind);
        });
        document
            .getElementById("fnr-prev-btn")
            .addEventListener("click", () => fnrNavigate("prev"));
        document
            .getElementById("fnr-next-btn")
            .addEventListener("click", () => fnrNavigate("next"));
        document
            .getElementById("fnr-replace-btn")
            .addEventListener("click", fnrReplaceSingle);
        document
            .getElementById("fnr-replace-all-btn")
            .addEventListener("click", fnrReplaceAll);

        document
            .getElementById("modal-body-input")
            .addEventListener("input", () => {
                if (fnrPanelVisible) {
                    fnrFind();
                } else {
                    updateBodyOverlay();
                }
            });

        const downloadBtn = document.getElementById("download-full");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", downloadFullTxt);
        }
        const downloadZipBtn = document.getElementById("download-zip");
        if (downloadZipBtn) {
            downloadZipBtn.addEventListener("click", downloadFullZip);
        }
        const resetBtn = document.getElementById("reset-story");
        if (resetBtn) {
            resetBtn.addEventListener("click", resetStory);
        }
        const newChapterBtn = document.getElementById("new-chapter-btn");
        if (newChapterBtn) {
            newChapterBtn.addEventListener("click", () => {
                window.location.href = "index.html";
            });
        }
    }

    document.addEventListener("DOMContentLoaded", init);

    if (typeof onI18nChange === "function") {
        onI18nChange(() => {
            applyEditorI18n();
            renderChapterList();
        });
    }

    function applyEditorI18n() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (!key) return;
            el.textContent = t(key);
        });
    }
})();
