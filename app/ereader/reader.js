const DB_NAME = "EpubReaderLocalDB";
const ASSET_STORE_NAME = "assets";
let box = null;
let isDragging = false;
let dragStartX, dragStartY, boxStartX, boxStartY;
let matches = [];
let currentMatchIndex = -1;
const SEARCH_WINDOW = 5;
let globalMouseMoveHandler = null;
let globalMouseUpHandler = null;
let globalClickHandler = null;
let isInteractionPaused = false;
let isHighlightModeActive = false;
let isBookmarkModeActive = false;
let bookmarkLineEventsInitialized = false;
let bookmarkLineHandlers = {};
const state = {
    zip: null,
    opfPath: "",
    basePath: "",
    spine: [],
    manifest: {},
    toc: [],
    currentChapterIndex: 0,
    currentPageIndex: 0,
    maxPagesInChapter: 1,
    theme: "light",
    pageMode: "single",
    fontSize: 25,
    fontPercent: 100,
    autoScrollInterval: null,
    tiltFlip: false,
    overrideVol: true,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    pinchStartDist: 0,
    currentUtterance: null,
    bookId: null,
    tts: {
        voices: [],
        voice: null,
        rate: 1,
        volume: 1,
        enabled: false,
        paused: false,
    },
    blobUrls: [],
    orientationHandler: null,
    ux: {
        lineSpacing: 1.5,
        margin: 40,
        paraSpacing: 1,
        hyphenation: false,
        justification: "left",
        brightness: 100,
        texture: "none",
    },
    highlights: [],
    bookmarkLines: [],
    search: {
        keyword: "",
        results: [],
        lastIndex: -1,
        activeMarks: [],
        chapterPool: [],
        currentIndex: -1,
        mode: "all",
    },
};

function getBookProgress(bookId) {
    const all = JSON.parse(
        localStorage.getItem("epub_reader_progress") || "{}",
    );
    return all[bookId] || null;
}

function saveBookProgress() {
    if (!state.bookId) return;
    const all = JSON.parse(
        localStorage.getItem("epub_reader_progress") || "{}",
    );
    all[state.bookId] = {
        chapterIndex: state.currentChapterIndex,
        pageIndex: state.currentPageIndex,
        updatedAt: Date.now(),
    };
    localStorage.setItem("epub_reader_progress", JSON.stringify(all));
}

function clearBookProgress(bookId) {
    const all = JSON.parse(
        localStorage.getItem("epub_reader_progress") || "{}",
    );
    delete all[bookId];
    localStorage.setItem("epub_reader_progress", JSON.stringify(all));
}

document
    .getElementById("file-input")
    .addEventListener("change", handleFileSelect);
window.addEventListener("resize", handleResize);
setupGlobalInteractions();
updateFontScale(100);
window.addEventListener("DOMContentLoaded", async () => {
    const localBookId = localStorage.getItem("selected_local_book_id");
    if (!localBookId) {
        window.location.href = "index.html";
        return;
    }
    if (localBookId) {
        localStorage.removeItem("selected_local_book_id");
        document.getElementById("book-title").innerText =
            "Đang lấy sách từ thư viện cục bộ...";
        clearI18n(document.getElementById("book-title"));
        try {
            const DB_NAME = "EpubReaderLocalDB";
            const request = indexedDB.open(DB_NAME, 2);
            request.onsuccess = function (e) {
                const db = e.target.result;
                const transaction = db.transaction("bookshelf", "readonly");
                const store = transaction.objectStore("bookshelf");
                const getReq = store.get(localBookId);
                getReq.onsuccess = async function () {
                    const bookRecord = getReq.result;
                    if (bookRecord && bookRecord.fileBlob) {
                        console.log(
                            "Tìm thấy sách cục bộ, đang nạp vào pipeline giải nén cũ...",
                        );
                        const mockEvent = {
                            target: {
                                files: [bookRecord.fileBlob],
                            },
                        };
                        await handleFileSelect(mockEvent);
                    }
                };
            };
        } catch (err) {
            console.error("Không thể tự động tải sách từ Library:", err);
        }
    }
});

function cleanupListeners() {
    if (state.orientationHandler) {
        window.removeEventListener(
            "deviceorientation",
            state.orientationHandler,
        );
        state.orientationHandler = null;
    }
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("book-title").innerText = t(
        "ereader.processing_epub",
    );
    cleanupListeners();
    try {
        const arrayBuffer = await file.arrayBuffer();
        state.zip = await JSZip.loadAsync(arrayBuffer);
        const containerXmlStr = await state.zip
            .file("META-INF/container.xml")
            .async("string");
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(
            containerXmlStr,
            "text/xml",
        );
        state.opfPath = containerDoc
            .querySelector("rootfile")
            .getAttribute("full-path");
        if (state.opfPath.includes("/")) {
            state.basePath =
                state.opfPath.substring(0, state.opfPath.lastIndexOf("/")) +
                "/";
        } else {
            state.basePath = "";
        }
        const opfStr = await state.zip.file(state.opfPath).async("string");
        const opfDoc = parser.parseFromString(opfStr, "text/xml");
        parseMetadata(opfDoc);
        await loadCoverImage(opfDoc);
        parseManifestAndSpine(opfDoc);
        if (state.tocFile) {
            if (state.tocFile.endsWith(".ncx")) {
                state.toc = await parseNCX(state.tocFile);
            } else {
                state.toc = await parseNavXhtml(state.tocFile);
            }
        }
        if (!state.toc.length) {
            state.toc = await buildTOCFromContent();
        }
        const saved = getBookProgress(state.bookId);
        if (saved) {
            state.currentChapterIndex = saved.chapterIndex || 0;
            state.currentPageIndex = saved.pageIndex || 0;
        } else {
            state.currentChapterIndex = 0;
            state.currentPageIndex = 0;
        }
        await loadChapter(state.currentChapterIndex, true);
        buildTocDOM();
        state.bookmarks = JSON.parse(
            localStorage.getItem(`epub_bookmarks_${state.bookId}`) || "[]",
        );
        state.highlights = JSON.parse(
            localStorage.getItem(`epub_highlights_${state.bookId}`) || "[]",
        );
        state.bookmarkLines = JSON.parse(
            localStorage.getItem(`epub_bookmarkLines_${state.bookId}`) || "[]",
        );
        const savedUX = localStorage.getItem(`epub_ux_${state.bookId}`);
        if (savedUX) {
            state.ux = JSON.parse(savedUX);
            Object.keys(state.ux).forEach((key) =>
                changeUXSetting(key, state.ux[key]),
            );
        }
    } catch (err) {
        alert(t("ereader.epub_parse_error") + err.message);
        document.getElementById("book-title").innerText = t(
            "ereader.file_processing_error",
        );
        console.error(err);
    }
}

function parseMetadata(xml) {
    const title =
        xml.querySelector("title")?.textContent || t("ereader.unknown_title");
    state.bookId = title.trim().replace(/\s+/g, " ").toLowerCase();
    const author =
        xml.querySelector("creator")?.textContent ||
        t("ereader.unknown_author");
    const subjects = [...xml.querySelectorAll("subject, dc\\:subject")]
        .map((el) => el.textContent?.trim())
        .filter(Boolean);
    const subject = subjects.length
        ? subjects.join(", ")
        : t("ereader.general_subject");
    const description =
        xml.querySelector("description")?.textContent ||
        t("ereader.no_description");
    document.getElementById("book-title").innerText = title;
    clearI18n(document.getElementById("book-title"));
    document.getElementById("meta-author").innerText = author;
    document.getElementById("meta-subject").innerText = subject;
    document.getElementById("meta-description").innerText = description;
}

async function loadCoverImage(opfDoc) {
    try {
        let coverHref = null;
        const coverMeta = opfDoc.querySelector('meta[name="cover"]');
        if (coverMeta) {
            const coverId = coverMeta.getAttribute("content");
            const coverItem = opfDoc.querySelector(
                `manifest > item[id="${coverId}"]`,
            );
            if (coverItem) {
                coverHref = coverItem.getAttribute("href");
            }
        }
        if (!coverHref) {
            const manifestItems = [
                ...opfDoc.querySelectorAll("manifest > item"),
            ];
            const possibleCover = manifestItems.find((item) => {
                const href = (item.getAttribute("href") || "").toLowerCase();
                return href.includes("cover");
            });
            if (possibleCover) {
                coverHref = possibleCover.getAttribute("href");
            }
        }
        if (!coverHref) return;
        const fullCoverPath = resolveRelativePath(state.basePath, coverHref);
        const normalizedFullCoverPath = normalizeAssetPath(fullCoverPath);
        let coverUrl = await getAssetBlobUrl(normalizedFullCoverPath);
        if (!coverUrl) {
            const coverFile = state.zip.file(normalizedFullCoverPath);
            if (!coverFile) return;
            const blob = await coverFile.async("blob");
            coverUrl = URL.createObjectURL(blob);
            state.blobUrls.push(coverUrl);
        }
        document.getElementById("meta-cover").innerHTML = `
            <img
                src="${coverUrl}"
                alt="Cover"
                style="
                    width: 160px;
                    height: 224px;
                    object-fit: cover;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0,0,0,.2);
                "
            />
        `;
    } catch (err) {
        console.warn("Không thể tải ảnh bìa:", err);
    }
}

function parseManifestAndSpine(xml) {
    state.manifest = {};
    const items = xml.querySelectorAll("manifest > item");
    items.forEach((item) => {
        state.manifest[item.getAttribute("id")] = item.getAttribute("href");
    });
    const itemrefs = xml.querySelectorAll("spine > itemref");
    state.spine = [];
    itemrefs.forEach((ref) => {
        const idref = ref.getAttribute("idref");
        if (state.manifest[idref]) {
            state.spine.push(state.manifest[idref]);
        }
    });
    const navItem = [...items].find((item) => {
        const props = item.getAttribute("properties") || "";
        return props.includes("nav");
    });
    const ncxItem = [...items].find((item) => {
        const media = item.getAttribute("media-type") || "";
        return media === "application/x-dtbncx+xml";
    });
    if (navItem) {
        state.tocFile = navItem.getAttribute("href");
    } else if (ncxItem) {
        state.tocFile = ncxItem.getAttribute("href");
    }
}

async function parseNCX(href) {
    const path = resolveRelativePath(state.basePath, href);
    const file = state.zip.file(path);
    if (!file) return [];
    const xml = await file.async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const navMap = doc.querySelector("navMap");
    return parseNCXNode(navMap);
}

function parseNCXNode(parent) {
    return [...parent.children]
        .filter((n) => n.tagName === "navPoint")
        .map((navPoint) => ({
            title:
                navPoint.querySelector(":scope > navLabel > text")
                    ?.textContent || "",
            href:
                navPoint
                    .querySelector(":scope > content")
                    ?.getAttribute("src") || "",
            children: parseNCXNode(navPoint),
        }));
}

async function parseNavXhtml(href) {
    const path = resolveRelativePath(state.basePath, href);
    const file = state.zip.file(path);
    if (!file) return [];
    const html = await file.async("string");
    const doc = new DOMParser().parseFromString(html, "text/html");
    let nav =
        doc.querySelector('nav[epub\\:type="toc"][role="doc-toc"]') ||
        doc.querySelector('nav[epub\\:type="toc"]') ||
        doc.querySelector('nav[role="doc-toc"]') ||
        doc.querySelector("nav#toc") ||
        doc.querySelector("nav");
    if (!nav) return [];
    const root = nav.querySelector(":scope > ol");
    if (!root) return [];
    return parseTocList(root);
}

function parseTocList(ol) {
    return [...ol.children]
        .filter((li) => li.tagName.toLowerCase() === "li")
        .map((li) => {
            const a = li.querySelector(":scope > a");
            const childOL = li.querySelector(":scope > ol");
            return {
                title: a?.textContent.trim() || "",
                href: a?.getAttribute("href") || "",
                children: childOL ? parseTocList(childOL) : [],
            };
        });
}

async function buildTOCFromContent() {
    const result = [];
    let idx = 0;
    for (const href of state.spine) {
        const path = resolveRelativePath(state.basePath, href);
        const file = state.zip.file(path);
        if (!file) continue;
        const html = await file.async("string");
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title =
            doc.querySelector("h1")?.textContent ||
            doc.querySelector("h2")?.textContent ||
            doc.querySelector("title")?.textContent ||
            `${t("ereader.chapter")} ${idx + 1}`;
        result.push({
            title: title.trim(),
            href,
            index: idx++,
        });
    }
    return result;
}

function normalizeAssetPath(path) {
    return (path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");
}

function openAssetDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
                db.createObjectStore(ASSET_STORE_NAME, { keyPath: "path" });
            }
        };
    });
}

function isImageBlob(blob, path) {
    const type = blob.type || "";
    if (type.startsWith("image/")) return true;
    const ext = (path.split(".").pop() || "").toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
}

async function getAssetByPath(assetPath) {
    console.log("[DB] lookup:", assetPath);
    try {
        const db = await openAssetDB();
        const result = await new Promise((resolve, reject) => {
            const tx = db.transaction(ASSET_STORE_NAME, "readonly");
            const store = tx.objectStore(ASSET_STORE_NAME);
            const req = store.get(assetPath);
            req.onsuccess = () => {
                console.log(
                    "[DB] result:",
                    req.result ? "FOUND ✅" : "NULL ❌",
                );
                resolve(req.result || null);
            };
            req.onerror = () => {
                console.error("[DB] error:", req.error);
                reject(req.error);
            };
        });
        return result;
    } catch (err) {
        console.warn("[DB] ❌ read fail:", err);
        return null;
    }
}

async function getAssetBlobUrl(assetPath) {
    const normalizedPath = normalizeAssetPath(assetPath);
    const asset = await getAssetByPath(normalizedPath);
    if (!asset || !asset.blob) return null;
    const blobUrl = URL.createObjectURL(asset.blob);
    state.blobUrls.push(blobUrl);
    return blobUrl;
}

function clearBlobUrls() {
    if (!state.blobUrls) return;
    state.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    state.blobUrls = [];
}

async function loadChapter(index, preservePage = false, initialPage = 0) {
    if (index < 0 || index >= state.spine.length) return;
    console.log("[CHAPTER] 👉 loadChapter index:", index);
    state.currentChapterIndex = index;
    const chapterHref = state.spine[index];
    const fullPath = resolveRelativePath(state.basePath, chapterHref);
    console.log("[CHAPTER] spine href:", chapterHref);
    console.log("[CHAPTER] basePath:", state.basePath);
    console.log("[CHAPTER] resolved fullPath:", fullPath);
    clearBlobUrls();
    const fileEntry = state.zip.file(fullPath);
    if (!fileEntry) {
        console.error("[CHAPTER] ❌ file not found in zip:", fullPath);
        document.getElementById("chapter-content").innerHTML =
            "<p>Chapter not found</p>";
        return;
    }
    let htmlStr = await fileEntry.async("string");
    const parser = new DOMParser();
    let doc = parser.parseFromString(htmlStr, "text/html");
    const hasImages = !!doc.querySelector("img, image");
    console.log("[CHAPTER] 🖼 hasImages:", hasImages);
    const bodyContent = doc.body ? doc.body.innerHTML : htmlStr;
    const contentEl = document.getElementById("chapter-content");
    contentEl.innerHTML = DOMPurify.sanitize(bodyContent);
    await hydrateImages(contentEl, fullPath);
    bindInternalLinks(contentEl, fullPath);
    state.currentPageIndex = preservePage
        ? state.currentPageIndex
        : initialPage === Infinity
          ? state.maxPagesInChapter - 1
          : initialPage;
    requestAnimationFrame(() => {
        recalculatePagination();
        renderCurrentPagePosition();
        updateStatusBar();
        refreshReaderOverlaysAndMarks();
        if (box) {
            setTimeout(findMatches, 50);
        }
    });
}

function bindInternalLinks(contentEl, chapterFullPath) {
    const links = contentEl.querySelectorAll("a[href]");
    links.forEach((a) => {
        const href = a.getAttribute("href");
        if (!href) return;
        if (
            href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.startsWith("mailto:") ||
            href.startsWith("javascript:")
        ) {
            return;
        }
        a.addEventListener("click", async (e) => {
            e.preventDefault();
            await navigateEpubHref(href, chapterFullPath);
        });
    });
}

async function navigateEpubHref(href, currentChapterPath) {
    let [filePart, anchor] = href.split("#");
    if (!filePart) {
        filePart = currentChapterPath;
    } else {
        filePart = resolveRelativePath(currentChapterPath, filePart);
    }
    filePart = normalizeAssetPath(filePart);
    const chapterIndex = state.spine.findIndex((item) => {
        const full = normalizeAssetPath(
            resolveRelativePath(state.basePath, item),
        );
        return full === filePart;
    });
    if (chapterIndex === -1) return;
    await loadChapter(chapterIndex);
    if (anchor) {
        requestAnimationFrame(() => {
            jumpToAnchor(anchor);
        });
    }
}

function jumpToAnchor(anchor) {
    const root = document.getElementById("chapter-content");
    const target =
        root.querySelector(`#${CSS.escape(anchor)}`) ||
        root.querySelector(`[name="${anchor}"]`);
    if (!target) return;
    const view = document.getElementById("reader-view");
    const pageWidth = view.clientWidth - 40;
    const x = target.offsetLeft;
    state.currentPageIndex = Math.floor(x / pageWidth);
    renderCurrentPagePosition();
}

function resolveRelativePath(base, relative) {
    let stack = base.split("/"),
        parts = relative.split("/");
    stack.pop();
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] == ".") continue;
        if (parts[i] == "..") stack.pop();
        else stack.push(parts[i]);
    }
    return stack.filter((p) => p !== "").join("/");
}

function recalculatePagination() {
    const contentEl = document.getElementById("chapter-content");
    const viewEl = document.getElementById("reader-view");
    const totalWidth = contentEl.scrollWidth;
    const viewWidth = viewEl.clientWidth - 80;
    state.maxPagesInChapter = Math.ceil(totalWidth / (viewWidth + 40));
    if (state.maxPagesInChapter < 1) state.maxPagesInChapter = 1;
}

function navigatePage(direction) {
    const contentEl = document.getElementById("chapter-content");
    const viewEl = document.getElementById("reader-view");
    const stepWidth = viewEl.clientWidth - 40;
    let targetPage = state.currentPageIndex + direction;
    if (targetPage < 0) {
        if (state.currentChapterIndex > 0) {
            const prevChapter = state.currentChapterIndex - 1;
            clearBlobUrls();
            loadChapter(prevChapter, true, Infinity).then(() => {
                state.currentChapterIndex = prevChapter;
                requestAnimationFrame(() => {
                    state.currentPageIndex = state.maxPagesInChapter - 1;
                    renderCurrentPagePosition();
                    saveBookProgress();
                });
            });
        }
        return;
    } else if (targetPage >= state.maxPagesInChapter) {
        if (state.currentChapterIndex < state.spine.length - 1) {
            clearBlobUrls();
            navigateChapter(1);
        }
        return;
    }
    state.currentPageIndex = targetPage;
    renderCurrentPagePosition();
    saveBookProgress();
}

function renderCurrentPagePosition() {
    const contentEl = document.getElementById("chapter-content");
    const viewEl = document.getElementById("reader-view");
    const multiplier = state.pageMode === "double" ? 2 : 1;
    const stepWidth = viewEl.clientWidth - 40;
    const offset = -(state.currentPageIndex * stepWidth);
    contentEl.style.transform = `translateX(${offset}px)`;
    updateStatusBar();
}

function navigateChapter(direction) {
    let targetChapter = state.currentChapterIndex + direction;
    if (targetChapter >= 0 && targetChapter < state.spine.length) {
        state.currentPageIndex = 0;
        clearBlobUrls();
        loadChapter(targetChapter);
    }
}

function jumpToProgress(e) {
    const rect = document
        .getElementById("progress-container")
        .getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    const targetChapterIndex = Math.floor(clickRatio * state.spine.length);
    loadChapter(targetChapterIndex);
}

function updateStatusBar() {
    document.getElementById("chapter-mark-indicator").innerText =
        `${t("ereader.chapter")} ${state.currentChapterIndex + 1} / ${state.spine.length} (${t("ereader.page")} ${state.currentPageIndex + 1}/${state.maxPagesInChapter})`;
    const globalProgress =
        (state.currentChapterIndex / state.spine.length) * 100;
    document.getElementById("progress-bar").style.width = `${globalProgress}%`;
    document.getElementById("progress-percent").innerText =
        `${Math.round(globalProgress)}%`;
}

function handleResize() {
    recalculatePagination();
    renderCurrentPagePosition();
}

function handleReaderTap(e) {
    if (isInteractionPaused) return;
    if (
        e.target.closest(
            ".corner-btn,.dropdown-menu,.btn,input,select,label,#settings-panel,#viewer-toolbar",
        )
    ) {
        return;
    }
    const reader = document.getElementById("reader-center");
    const rect = reader.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const corner = 120;
    if (x < corner && y < corner) return;
    if (x > w - corner && y < corner) return;
    if (x < corner && y > h - corner) return;
    if (x > w - corner && y > h - corner) return;
    if (x < w * 0.25) {
        navigatePage(-1);
        return;
    }
    if (x > w * 0.75) {
        navigatePage(1);
        return;
    }
    toggleSettingsMenu();
}

function setupGlobalInteractions() {
    const viewEl = document.getElementById("reader-center");
    const tap = {
        downX: 0,
        downY: 0,
        moved: false,
        threshold: 8,
    };
    let swipe = {
        active: false,
        startX: 0,
        startY: 0,
        isTouch: false,
        threshold: 60,
        locked: false,
    };
    document.addEventListener("selectstart", (e) => {
        if (!state.isHighlightMode) {
            e.preventDefault();
        }
    });
    function handleSwipeEnd(dx, dy) {
        if (isInteractionPaused) return;
        if (swipe.locked) return;
        if (Math.abs(dx) < swipe.threshold || Math.abs(dx) < Math.abs(dy)) {
            return;
        }
        swipe.locked = true;
        if (dx > 0) {
            navigatePage(-1);
        } else {
            navigatePage(1);
        }
        setTimeout(() => {
            swipe.locked = false;
        }, 250);
    }
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
            e.preventDefault();
            adjustFontSize(2);
        }
        if (e.ctrlKey && e.key === "-") {
            e.preventDefault();
            adjustFontSize(-2);
        }
        if (state.overrideVol) {
            if (e.key === "VolumeUp") navigatePage(-1);
            if (e.key === "VolumeDown") navigatePage(1);
        }
        if (e.altKey && e.key.toLowerCase() == "m") {
            e.preventDefault();
            toggleBookmarkLineSelection();
        }
        if (e.altKey && e.key.toLowerCase() == "a") {
            e.preventDefault();
            toggleHighlightSelection();
        }
        if (e.altKey && e.key.toLowerCase() == "h") {
            e.preventDefault();
            if (box) {
                closeBox();
            } else {
                createBox();
            }
        }
        switch (e.key) {
            case "ArrowLeft":
                e.preventDefault();
                navigatePage(-1);
                break;
            case "ArrowRight":
                e.preventDefault();
                navigatePage(1);
                break;
            case "ArrowUp":
                e.preventDefault();
                navigateChapter(-1);
                break;
            case "ArrowDown":
                e.preventDefault();
                navigateChapter(1);
                break;
        }
        if (e.key === "Escape" && box) {
            closeBox();
        }
    });
    viewEl.addEventListener("mousedown", (e) => {
        if (isInteractionPaused) return;
        if (e.button !== 0) return;
        tap.downX = e.clientX;
        tap.downY = e.clientY;
        tap.moved = false;
        swipe.active = true;
        swipe.isTouch = false;
        swipe.startX = e.clientX;
        swipe.startY = e.clientY;
    });
    window.addEventListener("mousemove", (e) => {
        if (isInteractionPaused) return;
        if (!swipe.active) return;
        const dx = e.clientX - tap.downX;
        const dy = e.clientY - tap.downY;
        if (Math.hypot(dx, dy) > tap.threshold) {
            tap.moved = true;
        }
    });
    window.addEventListener("mouseup", (e) => {
        if (isInteractionPaused) return;
        if (!swipe.active) return;
        const dx = e.clientX - swipe.startX;
        const dy = e.clientY - swipe.startY;
        swipe.active = false;
        if (Math.abs(dx) > swipe.threshold && Math.abs(dx) > Math.abs(dy)) {
            handleSwipeEnd(dx, dy);
            return;
        }
        if (!tap.moved) {
            handleReaderTap(e);
        }
    });
    viewEl.addEventListener(
        "touchstart",
        (e) => {
            if (isInteractionPaused) return;
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            tap.downX = t.clientX;
            tap.downY = t.clientY;
            tap.moved = false;
            swipe.active = true;
            swipe.isTouch = true;
            swipe.startX = t.clientX;
            swipe.startY = t.clientY;
        },
        { passive: true },
    );
    viewEl.addEventListener(
        "touchmove",
        (e) => {
            if (isInteractionPaused) return;
            if (!swipe.active || e.touches.length !== 1) return;
            if (window.getSelection().toString().length > 0) {
                return;
            }
            const t = e.touches[0];
            const dx = t.clientX - tap.downX;
            const dy = t.clientY - tap.downY;
            if (Math.hypot(dx, dy) > tap.threshold) {
                tap.moved = true;
            }
            if (Math.abs(dx) > 10) {
                e.preventDefault();
            }
        },
        { passive: false },
    );
    viewEl.addEventListener("touchend", (e) => {
        if (!swipe.active) return;
        if (isInteractionPaused) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - swipe.startX;
        const dy = touch.clientY - swipe.startY;
        swipe.active = false;
        if (e.cancelable) {
            e.preventDefault();
        }
        if (Math.abs(dx) > swipe.threshold && Math.abs(dx) > Math.abs(dy)) {
            handleSwipeEnd(dx, dy);
            return;
        }
        if (!tap.moved) {
            handleReaderTap({
                clientX: touch.clientX,
                clientY: touch.clientY,
                target: e.target,
            });
        }
    });
    document.addEventListener(
        "contextmenu",
        (e) => {
            if (isInteractionPaused) return;
            e.preventDefault();
        },
        true,
    );
    state.orientationHandler = (e) => {
        if (!state.tiltFlip) return;
        if (e.gamma > 25) {
            debounceTilt(() => navigatePage(1));
        } else if (e.gamma < -25) {
            debounceTilt(() => navigatePage(-1));
        }
    };
    window.addEventListener("deviceorientation", state.orientationHandler);
    setTimeout(() => {
        if ("speechSynthesis" in window) {
            const voices = window.speechSynthesis.getVoices();
            const selector = document.getElementById("tts-voice");
            selector.innerHTML = voices
                .map(
                    (v) =>
                        `<option value="${v.name}">${v.name} (${v.lang})</option>`,
                )
                .join("");
        }
    }, 500);
    initTTS();
}

let tiltCooldown = false;
function debounceTilt(callback) {
    if (tiltCooldown) return;
    tiltCooldown = true;
    callback();
    setTimeout(() => (tiltCooldown = false), 1000);
}

function toggleSettingsMenu() {
    const overlay = document.getElementById("settings-overlay");
    const isHidden = overlay.style.display !== "block";
    overlay.style.display = isHidden ? "block" : "none";
    if (isHidden) {
        document.body.classList.add("settings-active");
    } else {
        document.body.classList.remove("settings-active");
        closeAllCornerDropdowns();
    }
}

function toggleOverlay(id, show) {
    const overlay = document.getElementById(id);
    const panel = document.getElementById("toc-panel");
    if (show) {
        overlay.style.display = "block";
        setTimeout(() => {
            panel.classList.add("active");
        }, 10);
    } else {
        panel.classList.remove("active");
        setTimeout(() => {
            overlay.style.display = "none";
        }, 300);
    }
}

function toggleDropdown(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === "flex" ? "none" : "flex";
}

function closeAllCornerDropdowns() {
    document
        .querySelectorAll(".dropdown-menu")
        .forEach((el) => (el.style.display = "none"));
}

function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", state.theme);
}

function togglePageMode() {
    state.pageMode = state.pageMode === "single" ? "double" : "single";
    document.body.className =
        state.pageMode === "single" ? "mode-single" : "mode-double";
    recalculatePagination();
    renderCurrentPagePosition();
}

function adjustFontSize(delta) {
    state.fontSize = Math.max(12, Math.min(36, state.fontSize + delta));
    document.getElementById("chapter-content").style.fontSize =
        `${state.fontSize}px`;
    document.getElementById("font-size-display").textContent =
        `${state.fontSize}px`;
    setTimeout(() => {
        recalculatePagination();
        renderCurrentPagePosition();
    }, 100);
}

function updateFontScale(percent) {
    state.fontPercent = parseInt(percent);
    const fontPx = Math.round(25 * (state.fontPercent / 100));
    state.fontSize = fontPx;
    document.getElementById("chapter-content").style.fontSize = `${fontPx}px`;
    document.getElementById("font-size-display").textContent =
        `${state.fontPercent}%`;
    setTimeout(() => {
        recalculatePagination();
        renderCurrentPagePosition();
    }, 100);
}

function changeCustomStyle(type, value) {
    const content = document.getElementById("chapter-content");
    if (type === "bg")
        document.getElementById("reader-view").style.backgroundColor = value;
    if (type === "text") content.style.color = value;
    if (type === "font") content.style.fontFamily = value;
}

function toggleTextDecoration(style) {
    const content = document.getElementById("chapter-content");
    content.classList.toggle(`text-${style}`);
}

function toggleAutoScroll(secondsPerPage) {
    if (state.autoScrollInterval) {
        clearInterval(state.autoScrollInterval);
        state.autoScrollInterval = null;
    }
    let sec = parseInt(secondsPerPage);
    if (sec > 0) {
        state.autoScrollInterval = setInterval(() => {
            navigatePage(1);
        }, sec * 1000);
    }
}

function speakText(text) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (state.currentUtterance) {
        state.currentUtterance.onend = null;
        state.currentUtterance.onerror = null;
        state.currentUtterance = null;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = state.tts.voice;
    u.rate = state.tts.rate;
    u.volume = state.tts.volume;
    u.onend = () => {
        state.tts.enabled = false;
        state.currentUtterance = null;
    };
    state.currentUtterance = u;
    window.speechSynthesis.speak(u);
    state.tts.enabled = true;
}

function initTTS() {
    if (!("speechSynthesis" in window)) return;
    const selector = document.getElementById("tts-voice");
    const loadVoices = () => {
        state.tts.voices = window.speechSynthesis.getVoices();
        if (state.tts.voices.length === 0) return false;
        if (selector) {
            selector.innerHTML = state.tts.voices
                .map(
                    (v) =>
                        `<option value="${v.name}">${v.name} (${v.lang})</option>`,
                )
                .join("");
        }
        state.tts.voice =
            state.tts.voices.find((v) => v.default) ||
            state.tts.voices[0] ||
            null;
        return true;
    };
    const loaded = loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        loadVoices();
    };
    if (!loaded) {
        const voicesTimer = setInterval(() => {
            const success = loadVoices();
            if (success) {
                clearInterval(voicesTimer);
            }
        }, 200);
        setTimeout(() => clearInterval(voicesTimer), 5000);
    }
}

document.getElementById("tts-voice").addEventListener("change", (e) => {
    const name = e.target.value;
    state.tts.voice = state.tts.voices.find((v) => v.name === name);
});

function toggleTTS() {
    const text = document.getElementById("chapter-content").innerText;
    if (!state.tts.enabled) {
        speakText(text);
    } else {
        window.speechSynthesis.cancel();
        state.tts.enabled = false;
    }
}

document.getElementById("tts-volume").addEventListener("input", (e) => {
    state.tts.volume = parseFloat(e.target.value);
});

document.getElementById("tts-speed").addEventListener("input", (e) => {
    state.tts.rate = parseFloat(e.target.value);
});

function changeUXSetting(key, value) {
    state.ux[key] = value;
    const contentEl = document.getElementById("chapter-content");
    const viewEl = document.getElementById("reader-view");
    switch (key) {
        case "lineSpacing":
            contentEl.style.lineHeight = value;
            break;
        case "margin":
            viewEl.style.paddingLeft = `${value}px`;
            viewEl.style.paddingRight = `${value}px`;
            break;
        case "paraSpacing":
            contentEl
                .querySelectorAll("p")
                .forEach((p) => (p.style.marginBottom = `${value}em`));
            break;
        case "hyphenation":
            contentEl.style.hyphens = value ? "auto" : "none";
            contentEl.style.webkitHyphens = value ? "auto" : "none";
            break;
        case "justification":
            contentEl.style.textAlign = value;
            break;
        case "brightness":
            updateBrightnessOverlay(value);
            break;
        case "texture":
            applyTextureTheme(value);
            break;
    }
    setTimeout(() => {
        recalculatePagination();
        renderCurrentPagePosition();
    }, 100);
    localStorage.setItem(`epub_ux_${state.bookId}`, JSON.stringify(state.ux));
}

function updateBrightnessOverlay(value) {
    let overlay = document.getElementById("app-brightness-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "app-brightness-overlay";
        overlay.style =
            "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;mix-blend-mode:multiply;";
        document.body.appendChild(overlay);
    }
    const opacity = (100 - value) / 100;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity * 0.8})`;
}

function applyTextureTheme(textureType) {
    const viewEl = document.getElementById("reader-view");
    viewEl.classList.remove("texture-sepia", "texture-paper");
    if (textureType !== "none") {
        viewEl.classList.add(`texture-${textureType}`);
    }
}

function exportUserDataBackup() {
    const backupData = {
        progress: JSON.parse(
            localStorage.getItem("epub_reader_progress") || "{}",
        ),
        bookmarks: {},
        highlights: {},
        bookmarkLines: {},
        ux: {},
        exportedAt: Date.now(),
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith("epub_bookmarks_")) {
            const id = key.replace("epub_bookmarks_", "");
            backupData.bookmarks[id] = JSON.parse(
                localStorage.getItem(key) || "[]",
            );
        } else if (key.startsWith("epub_highlights_")) {
            const id = key.replace("epub_highlights_", "");
            backupData.highlights[id] = JSON.parse(
                localStorage.getItem(key) || "[]",
            );
        } else if (key.startsWith("epub_bookmarkLines_")) {
            const id = key.replace("epub_bookmarkLines_", "");
            backupData.bookmarkLines[id] = JSON.parse(
                localStorage.getItem(key) || "[]",
            );
        } else if (key.startsWith("epub_ux_")) {
            const id = key.replace("epub_ux_", "");
            backupData.ux[id] = JSON.parse(localStorage.getItem(key) || "{}");
        }
    }

    const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "epub_reader_all_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importUserDataBackup(fileEvent) {
    const file = fileEvent.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.progress) {
                localStorage.setItem(
                    "epub_reader_progress",
                    JSON.stringify(data.progress),
                );
                if (state.bookId && data.progress[state.bookId]) {
                    state.currentChapterIndex =
                        data.progress[state.bookId].chapterIndex || 0;
                    state.currentPageIndex =
                        data.progress[state.bookId].pageIndex || 0;
                }
            }

            if (data.bookmarks) {
                Object.keys(data.bookmarks).forEach((id) => {
                    localStorage.setItem(
                        `epub_bookmarks_${id}`,
                        JSON.stringify(data.bookmarks[id]),
                    );
                });
                if (state.bookId && data.bookmarks[state.bookId]) {
                    state.bookmarks = data.bookmarks[state.bookId];
                }
            }

            if (data.highlights) {
                Object.keys(data.highlights).forEach((id) => {
                    localStorage.setItem(
                        `epub_highlights_${id}`,
                        JSON.stringify(data.highlights[id]),
                    );
                });
                if (state.bookId && data.highlights[state.bookId]) {
                    state.highlights = data.highlights[state.bookId];
                }
            }

            if (data.bookmarkLines) {
                Object.keys(data.bookmarkLines).forEach((id) => {
                    localStorage.setItem(
                        `epub_bookmarkLines_${id}`,
                        JSON.stringify(data.bookmarkLines[id]),
                    );
                });
                if (state.bookId && data.bookmarkLines[state.bookId]) {
                    state.bookmarkLines = data.bookmarkLines[state.bookId];
                }
            }

            if (data.ux) {
                Object.keys(data.ux).forEach((id) => {
                    localStorage.setItem(
                        `epub_ux_${id}`,
                        JSON.stringify(data.ux[id]),
                    );
                });
                if (state.bookId && data.ux[state.bookId]) {
                    state.ux = data.ux[state.bookId];
                    Object.keys(state.ux).forEach((key) =>
                        changeUXSetting(key, state.ux[key]),
                    );
                }
            }

            saveUserData();
            loadChapter(state.currentChapterIndex, true);
            alert("Đồng bộ dữ liệu thành công!");
        } catch (err) {
            alert("Lỗi cấu trúc tệp backup: " + err.message);
        }
    };
    reader.readAsText(file);
}

function saveUserData() {
    if (!state.bookId) return;
    localStorage.setItem(
        `epub_bookmarks_${state.bookId}`,
        JSON.stringify(state.bookmarks),
    );
    localStorage.setItem(
        `epub_highlights_${state.bookId}`,
        JSON.stringify(state.highlights),
    );
    localStorage.setItem(
        `epub_bookmarkLines_${state.bookId}`,
        JSON.stringify(state.bookmarkLines),
    );
}

function clearI18n(el) {
    if (!el) return;
    el.removeAttribute("data-i18n");
}

function enableTilt() {
    if (state.orientationHandler) return;
    state.orientationHandler = (e) => {
        if (!state.tiltFlip) return;
        const gamma = e.gamma || 0;
        if (gamma > 18) {
            debounceTilt(() => navigatePage(-1));
        } else if (gamma < -18) {
            debounceTilt(() => navigatePage(1));
        }
    };
    window.addEventListener("deviceorientation", state.orientationHandler);
}

async function toggleTiltFlip(value) {
    state.tiltFlip = value;
    if (value) {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res !== "granted") return;
        }
        enableTilt();
    } else {
        cleanupListeners();
    }
}

const savedTilt = localStorage.getItem("epub_tilt_flip");
if (savedTilt !== null) {
    state.tiltFlip = JSON.parse(savedTilt);
}

document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("cfg-tilt");
    if (el) el.checked = state.tiltFlip;
});

async function hydrateImages(contentEl, chapterFullPath) {
    const images = contentEl.querySelectorAll("img, image");
    const maxH = contentEl.getBoundingClientRect().height;
    const currentDir =
        chapterFullPath.substring(0, chapterFullPath.lastIndexOf("/")) + "/";
    for (const img of images) {
        let tag = img.tagName.toLowerCase();
        let srcAttr = tag === "image" ? "xlink:href" : "src";
        let rawSrc = img.getAttribute(srcAttr);
        img.style.display = "block";
        img.style.margin = "12px auto";
        img.style.borderRadius = "8px";
        img.style.maxHeight = `${maxH}px`;
        img.style.width = "auto";
        img.style.height = "auto";
        img.style.objectFit = "contain";
        if (!rawSrc) continue;
        if (rawSrc.startsWith("data:") || rawSrc.startsWith("http")) continue;
        let resolvedPath = normalizeAssetPath(
            resolveRelativePath(currentDir, rawSrc),
        );
        let blobUrl = await getAssetBlobUrl(resolvedPath);
        if (!blobUrl) {
            const file = state.zip.file(resolvedPath);
            if (!file) continue;
            const blob = await file.async("blob");
            blobUrl = URL.createObjectURL(blob);
            state.blobUrls.push(blobUrl);
        }
        if (tag === "image") {
            img.src = blobUrl;
        } else {
            img.setAttribute("src", blobUrl);
        }
    }
    const svgImages = contentEl.querySelectorAll("svg image");
    for (const svgImg of svgImages) {
        const rawSrc =
            svgImg.getAttribute("xlink:href") || svgImg.getAttribute("href");
        if (!rawSrc) continue;
        let resolvedPath = normalizeAssetPath(
            resolveRelativePath(currentDir, rawSrc),
        );
        let blobUrl = await getAssetBlobUrl(resolvedPath);
        if (!blobUrl) {
            const file = state.zip.file(resolvedPath);
            if (!file) continue;
            const blob = await file.async("blob");
            blobUrl = URL.createObjectURL(blob);
            state.blobUrls.push(blobUrl);
        }
        const img = document.createElement("img");
        img.src = blobUrl;
        img.style.display = "block";
        img.style.margin = "12px auto";
        img.style.borderRadius = "8px";
        img.style.maxHeight = `${maxH}px`;
        img.style.width = "auto";
        img.style.height = "auto";
        img.style.objectFit = "contain";
        svgImg.closest("svg")?.replaceWith(img);
    }
}

function toggleToolMenu() {
    console.log("click");
    const menu = document.getElementById("tool-menu");
    console.log(menu);
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

window.addEventListener("DOMContentLoaded", () => {
    const box = document.getElementById("floating-tools");
    const handle = document.getElementById("tool-toggle");
    if (!box || !handle) return;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    const DRAG_THRESHOLD = 8;
    handle.style.cursor = "grab";
    handle.style.touchAction = "none";
    handle.addEventListener("pointerdown", (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        offsetX = e.clientX - box.offsetLeft;
        offsetY = e.clientY - box.offsetTop;
        handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (distance > DRAG_THRESHOLD) {
            moved = true;
        }
        if (!moved) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, left));
        top = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, top));
        box.style.position = "fixed";
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.right = "unset";
        box.style.bottom = "unset";
    });
    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try {
            handle.releasePointerCapture(e.pointerId);
        } catch {}
        if (moved) {
            box.dataset.suppressClick = "1";
            setTimeout(() => {
                delete box.dataset.suppressClick;
            }, 100);
        }
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
});

window.addEventListener(
    "click",
    (e) => {
        const box = document.getElementById("floating-tools");
        if (box?.dataset.suppressClick) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    },
    true,
);

function pushReaderDown() {
    ["btn-tl", "btn-tr", "btn-bl", "btn-br"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.transition = ".25s";
            el.style.transform = "translateY(70px)";
        }
    });
    setTimeout(() => {
        ["btn-tl", "btn-tr", "btn-bl", "btn-br"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.transform = "";
        });
    }, 2500);
}

function renderTocTree(items) {
    return `
        <ul class="toc-tree">
            ${items.map(renderTocItem).join("")}
        </ul>
    `;
}

function renderTocItem(item) {
    const chapterIndex = state.spine.findIndex(
        (s) => s.split("#")[0] === item.href.split("#")[0],
    );
    const click = `
        loadChapter(${chapterIndex});
    `;
    const chapterKey = item.title || `Chương ${chapterIndex + 1}`;
    let bookmarkHTML = "";
    if (!item.children?.length) {
        return `
            <li>
                <a onclick="${click}">
                    ${item.title}
                </a>
                ${bookmarkHTML}
            </li>
        `;
    }
    return `
        <li>
            <details>
                <summary>
                    <span>
                        <a onclick="${click}">
                            ${item.title}
                        </a>
                    </span>
                </summary>
                ${bookmarkHTML}
                ${renderTocTree(item.children)}
            </details>
        </li>
    `;
}

function buildTocDOM() {
    const listEl = document.getElementById("toc-panel");
    if (!listEl) return;
    listEl.innerHTML = renderTocTree(state.toc);
}

function injectStyles() {
    if (document.getElementById("fnr-styles")) return;
    const style = document.createElement("style");
    style.id = "fnr-styles";
    style.innerHTML = `
            .fnr-box { position: fixed; top: 20px; right: 20px; width: 380px; background: #1e1e1e; color: #cccccc; border: 1px solid #454545; font-family: Segoe UI, sans-serif; font-size: 13px; z-index: 99999; box-shadow: 0 4px 10px rgba(0,0,0,0.5); user-select: none; border-radius: 4px; touch-action: none; }
            .fnr-header { background: #2d2d2d; padding: 6px 10px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #454545; font-weight: bold; }
            .fnr-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
            .fnr-row { display: flex; gap: 6px; align-items: center; position: relative; }
            .fnr-input-wrapper { flex: 1; position: relative; display: flex; align-items: center; }
            .fnr-input { width: 100%; background: #3c3c3c; color: #cccccc; border: 1px solid #3c3c3c; padding: 4px 24px 4px 6px; font-size: 13px; box-sizing: border-box; }
            .fnr-input:focus { border-color: #007acc; outline: none; }
            .fnr-dropdown-btn { position: absolute; right: 4px; background: transparent; border: none; color: #858585; cursor: pointer; padding: 2px; font-size: 10px; }
            .fnr-dropdown-btn:hover { color: #cccccc; }
            .fnr-select-list { position: absolute; top: 100%; left: 0; right: 0; background: #2d2d2d; border: 1px solid #454545; max-height: 150px; overflow-y: auto; z-index: 100000; display: none; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
            .fnr-select-item { padding: 4px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .fnr-select-item:hover { background: #007acc; color: #fff; }
            .fnr-radio-group { display: flex; gap: 10px; padding: 2px 0; }
            .fnr-radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
            .fnr-radio-label input { margin: 0; cursor: pointer; }
            .fnr-btn-group { display: flex; gap: 4px; justify-content: flex-end; }
            .fnr-btn { background: #0e639c; color: #ffffff; border: none; padding: 4px 10px; cursor: pointer; font-size: 12px; border-radius: 2px; min-width: 60px; text-align: center; }
            .fnr-btn:hover { background: #1177bb; }
            .fnr-btn-secondary { background: #3a3a3a; color: #cccccc; }
            .fnr-btn-secondary:hover { background: #4a4a4a; }
            .fnr-counter { font-size: 11px; color: #858585; min-width: 40px; text-align: right; margin-right: 4px; }
            mark.fnr-highlight{ background:#ffe45c; color:#000; padding:0; }
            mark.fnr-highlight.active{ background:#ff7b00; color:#fff; }
            @media (max-width: 480px) { .fnr-box { width: calc(100% - 40px); right: 20px; left: 20px; } }
        `;
    document.head.appendChild(style);
}

function createBox() {
    if (box) return;
    injectStyles();
    box = document.createElement("div");
    box.className = "fnr-box";
    box.innerHTML = `
            <div class="fnr-header">
                <span data-i18n="edit.title">Find & Replace</span>
                <span style="cursor:pointer;" id="fnr-close-x">×</span>
            </div>
            <div class="fnr-body">
                <div class="fnr-row">
                    <div class="fnr-input-wrapper">
                        <input type="text" id="fnr-find-input" class="fnr-input" placeholder="Find">
                    </div>
                    <div class="fnr-counter" id="fnr-match-counter">0/0</div>
                    <button class="fnr-btn fnr-btn-secondary" style="min-width:30px;padding:4px;" id="fnr-prev-btn" data-i18n="edit.opt.prev">◀</button>
                    <button class="fnr-btn fnr-btn-secondary" style="min-width:30px;padding:4px;" id="fnr-next-btn" data-i18n="edit.opt.next">▶</button>
                </div>
                <div class="fnr-radio-group">
                    <label class="fnr-radio-label">
                        <input type="radio" name="fnr-mode" value="all" checked>
                        <span data-i18n="edit.opt.match.all">Match Whole</span>
                    </label>
                    <label class="fnr-radio-label">
                        <input type="radio" name="fnr-mode" value="around">
                        <span data-i18n="edit.opt.match.around">Match Partial</span>
                    </label>
                </div>
                <div class="fnr-btn-group">
                    <button class="fnr-btn fnr-btn-secondary" id="fnr-cancel-btn" data-i18n="edit.opt.cancel">Cancel</button>
                </div>
            </div>
        `;
    document.body.appendChild(box);
    initEvents();
    if (typeof applyI18n === "function") applyI18n(box);
    document.getElementById("fnr-find-input").focus();
}

function closeBox() {
    if (!box) return;
    if (globalMouseMoveHandler)
        document.removeEventListener("mousemove", globalMouseMoveHandler);
    if (globalMouseUpHandler)
        document.removeEventListener("mouseup", globalMouseUpHandler);
    if (globalClickHandler)
        document.removeEventListener("click", globalClickHandler);
    document.removeEventListener("touchmove", globalMouseMoveHandler);
    document.removeEventListener("touchend", globalMouseUpHandler);
    box.remove();
    box = null;
    matches = [];
    currentMatchIndex = -1;
    clearFindMarks();
}

function initEvents() {
    const header = box.querySelector(".fnr-header");
    function getCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }
    function onDragStart(e) {
        if (e.target.id === "fnr-close-x") return;
        isDragging = true;
        const coords = getCoords(e);
        dragStartX = coords.x;
        dragStartY = coords.y;
        boxStartX = box.offsetLeft;
        boxStartY = box.offsetTop;
        if (e.cancelable && e.type === "touchstart") {
            e.preventDefault();
        }
    }
    header.addEventListener("mousedown", onDragStart);
    header.addEventListener("touchstart", onDragStart, { passive: false });
    globalMouseMoveHandler = (e) => {
        if (!isDragging) return;
        const coords = getCoords(e);
        box.style.left = `${boxStartX + (coords.x - dragStartX)}px`;
        box.style.top = `${boxStartY + (coords.y - dragStartY)}px`;
        box.style.right = "auto";
        box.style.bottom = "auto";
    };
    globalMouseUpHandler = () => {
        isDragging = false;
    };
    document.addEventListener("mousemove", globalMouseMoveHandler);
    document.addEventListener("touchmove", globalMouseMoveHandler, {
        passive: true,
    });
    document.addEventListener("mouseup", globalMouseUpHandler);
    document.addEventListener("touchend", globalMouseUpHandler);
    document.addEventListener("click", globalClickHandler);
    document.getElementById("fnr-close-x").addEventListener("click", closeBox);
    document
        .getElementById("fnr-cancel-btn")
        .addEventListener("click", closeBox);
    const findInput = document.getElementById("fnr-find-input");
    findInput.addEventListener("input", findMatches);
    box.querySelectorAll('input[name="fnr-mode"]').forEach((radio) => {
        radio.addEventListener("change", findMatches);
    });
    document
        .getElementById("fnr-next-btn")
        .addEventListener("click", () => navigateMatch("next"));
    document
        .getElementById("fnr-prev-btn")
        .addEventListener("click", () => navigateMatch("prev"));
}

function clearFindMarks() {
    const root = document.getElementById("chapter-content");
    root.querySelectorAll("mark.fnr-highlight").forEach((mark) => {
        mark.replaceWith(document.createTextNode(mark.textContent));
    });
    root.normalize();
    matches = [];
    currentMatchIndex = -1;
    updateMatchCounter();
}

function updateMatchCounter() {
    const counter = document.getElementById("fnr-match-counter");
    if (!counter) return;
    if (!matches.length) {
        counter.textContent = "0/0";
    } else {
        counter.textContent = `${currentMatchIndex + 1}/${matches.length}`;
    }
}

function findMatches() {
    if (!box) return;
    clearFindMarks();
    const keyword = document.getElementById("fnr-find-input").value;
    if (!keyword.trim()) return;
    const mode = document.querySelector('input[name="fnr-mode"]:checked').value;
    const root = document.getElementById("chapter-content");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.nodeValue.trim()) continue;
        textNodes.push(node);
    }
    const flags = mode === "around" ? "gi" : "g";
    const pattern =
        mode === "all"
            ? new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
            : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    for (const node of textNodes) {
        const text = node.nodeValue;
        if (!pattern.test(text)) continue;
        pattern.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0;
        text.replace(pattern, (match, offset) => {
            frag.appendChild(document.createTextNode(text.slice(last, offset)));
            const mark = document.createElement("mark");
            mark.className = "fnr-highlight";
            mark.textContent = match;
            frag.appendChild(mark);
            matches.push(mark);
            last = offset + match.length;
        });
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
    }
    if (matches.length) {
        currentMatchIndex = 0;
        focusMatch();
    }
    updateMatchCounter();
}

function focusMatch() {
    matches.forEach((m) => m.classList.remove("active"));
    if (!matches.length) return;
    const active = matches[currentMatchIndex];
    active.classList.add("active");
    const viewEl = document.getElementById("reader-view");
    const stepWidth = viewEl.clientWidth - 40;
    const x = active.offsetLeft;
    const targetPage = Math.floor(x / stepWidth);
    if (targetPage !== state.currentPageIndex) {
        state.currentPageIndex = Math.max(
            0,
            Math.min(targetPage, state.maxPagesInChapter - 1),
        );
        renderCurrentPagePosition();
    }
    updateMatchCounter();
}

function navigateMatch(dir) {
    if (!matches.length) return;
    if (dir === "next") {
        currentMatchIndex++;
        if (currentMatchIndex >= matches.length) currentMatchIndex = 0;
    } else {
        currentMatchIndex--;
        if (currentMatchIndex < 0) currentMatchIndex = matches.length - 1;
    }
    focusMatch();
}

function updateInteractionState() {
    isInteractionPaused =
        (typeof isHighlightModeActive !== "undefined" &&
            isHighlightModeActive) ||
        (typeof isBookmarkLineModeActive !== "undefined" &&
            isBookmarkLineModeActive) ||
        (typeof isBookmarkModeActive !== "undefined" && isBookmarkModeActive);
}

function toggleBookmarkLineSelection() {
    isBookmarkLineModeActive = !(
        typeof isBookmarkLineModeActive !== "undefined" &&
        isBookmarkLineModeActive
    );
    updateInteractionState();
    if (!isBookmarkLineModeActive) {
        removeBookmarkLineMenu();
    } else {
        console.log(
            "Đã bật chế độ đánh dấu Bookmark và tạm dừng thao tác chương.",
        );
    }
}

function findTextNodeAndRange(
    rootNode,
    targetText,
    nearbyText,
    targetStartOffset,
) {
    if (!rootNode || !targetText) return null;
    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        null,
    );
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeValue.trim()) {
            nodes.push({
                node,
                text: node.nodeValue,
            });
        }
    }
    const fullText = nodes.map((n) => n.text).join("");
    const cleanTarget = targetText.replace(/\s+/g, "");
    const cleanFull = fullText.replace(/\s+/g, "");
    const index = cleanFull.indexOf(cleanTarget);
    if (index === -1) {
        console.warn("Bookmark text not found:", targetText);
        return null;
    }
    let current = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    for (const item of nodes) {
        const len = item.text.length;
        if (startNode === null && index >= current && index <= current + len) {
            startNode = item.node;
            startOffset = index - current;
        }
        const endIndex = index + targetText.length;
        if (endIndex >= current && endIndex <= current + len) {
            endNode = item.node;
            endOffset = endIndex - current;
            break;
        }
        current += len;
    }
    if (!startNode || !endNode) {
        console.warn("Cannot map range", {
            startNode,
            endNode,
        });
        return null;
    }
    try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
    } catch (e) {
        console.error("Range error:", e);
        return null;
    }
}

function refreshReaderOverlaysAndMarks() {
    renderHighlightsForCurrentChapter();
    preprocessContinuousBlocks();
    restoreBookmarkLines();
}

if (typeof isBookmarkLineModeActive === "undefined") {
    var isBookmarkLineModeActive = false;
}

if (typeof updateInteractionState !== "function") {
    function updateInteractionState() {
        isInteractionPaused =
            (typeof isHighlightModeActive !== "undefined" &&
                isHighlightModeActive) ||
            isBookmarkLineModeActive ||
            (typeof isBookmarkModeActive !== "undefined" &&
                isBookmarkModeActive);
    }
}

function initBookmarkLineMenuEvents() {
    if (bookmarkLineEventsInitialized) return;
    const contentEl = document.getElementById("chapter-content");
    if (!contentEl) return;
    let touchTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    const HOLD_DELAY = 600;
    const MOVE_THRESHOLD = 10;
    function getValidLineEl(target) {
        return target.closest("p, span, div");
    }
    bookmarkLineHandlers.contextmenu = function (e) {
        const lineEl = getValidLineEl(e.target);
        if (!lineEl) return;
        e.preventDefault();
        e.stopPropagation();
        showBookmarkLineMenu(e.clientX, e.clientY, lineEl);
    };
    bookmarkLineHandlers.dblclick = function (e) {
        const lineEl = getValidLineEl(e.target);
        if (!lineEl) return;
        e.preventDefault();
        e.stopPropagation();
        showBookmarkLineMenu(e.clientX, e.clientY, lineEl);
    };
    bookmarkLineHandlers.touchstart = function (e) {
        if (e.touches.length !== 1) return;
        const lineEl = getValidLineEl(e.target);
        if (!lineEl) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
            showBookmarkLineMenu(touch.clientX, touch.clientY, lineEl);
            touchTimer = null;
        }, HOLD_DELAY);
    };
    bookmarkLineHandlers.touchmove = function (e) {
        if (!touchTimer) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    };
    bookmarkLineHandlers.touchend = function () {
        clearTimeout(touchTimer);
        touchTimer = null;
    };
    bookmarkLineHandlers.touchcancel = bookmarkLineHandlers.touchend;
    contentEl.addEventListener("contextmenu", bookmarkLineHandlers.contextmenu);
    contentEl.addEventListener("dblclick", bookmarkLineHandlers.dblclick);
    contentEl.addEventListener("touchstart", bookmarkLineHandlers.touchstart, {
        passive: true,
    });
    contentEl.addEventListener("touchmove", bookmarkLineHandlers.touchmove, {
        passive: true,
    });
    contentEl.addEventListener("touchend", bookmarkLineHandlers.touchend);
    contentEl.addEventListener("touchcancel", bookmarkLineHandlers.touchcancel);
    bookmarkLineEventsInitialized = true;
}

function destroyBookmarkLineMenuEvents() {
    if (!bookmarkLineEventsInitialized) return;
    const contentEl = document.getElementById("chapter-content");
    if (!contentEl) return;
    contentEl.removeEventListener(
        "contextmenu",
        bookmarkLineHandlers.contextmenu,
    );
    contentEl.removeEventListener("dblclick", bookmarkLineHandlers.dblclick);
    contentEl.removeEventListener(
        "touchstart",
        bookmarkLineHandlers.touchstart,
    );
    contentEl.removeEventListener("touchmove", bookmarkLineHandlers.touchmove);
    contentEl.removeEventListener("touchend", bookmarkLineHandlers.touchend);
    contentEl.removeEventListener(
        "touchcancel",
        bookmarkLineHandlers.touchcancel,
    );
    bookmarkLineHandlers = {};
    bookmarkLineEventsInitialized = false;
}

function preprocessContinuousBlocks() {
    const chapterContentEl = document.getElementById("chapter-content");
    if (!chapterContentEl) return;
    const blocks = chapterContentEl.querySelectorAll("pre, div, p");
    blocks.forEach((el) => {
        if (el.dataset.processedLines === "true") return;
        const hasChildBlocks = el.querySelector(
            "p, div, li, h1, h2, h3, h4, h5, h6",
        );
        if (
            el.tagName === "PRE" ||
            (!hasChildBlocks && el.innerHTML.includes("\n"))
        ) {
            const rawHtml = el.innerHTML;
            const lines = rawHtml.split(/\r?\n/);
            if (lines.length > 1) {
                const wrappedHtml = lines
                    .map((line) => {
                        const cleanLine = line.trim();
                        if (!cleanLine) return "<br>";
                        return `<span class="epub-virtual-line" style="display: block; margin: 2px 0;">${line}</span>`;
                    })
                    .join("");
                el.innerHTML = wrappedHtml;
                el.dataset.processedLines = "true";
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const readerView = document.getElementById("reader-view");
    if (!readerView) return;
    readerView.addEventListener("click", (e) => {
        if (
            typeof isBookmarkLineModeActive === "undefined" ||
            !isBookmarkLineModeActive
        )
            return;
        const chapterContent = document.getElementById("chapter-content");
        if (!chapterContent || !chapterContent.contains(e.target)) return;
        let targetLineEl = e.target.closest(
            ".epub-virtual-line, p, div, li, h1, h2, h3, h4, h5, h6, pre",
        );
        if (!targetLineEl) return;
        const innerLine = e.target.closest(".epub-virtual-line");
        if (innerLine) {
            targetLineEl = innerLine;
        }
        e.preventDefault();
        showBookmarkLineMenu(e.clientX, e.clientY, targetLineEl);
    });
});

function showBookmarkLineMenu(x, y, lineEl) {
    removeBookmarkLineMenu();
    const menu = document.createElement("div");
    menu.id = "bookmark-line-action-menu";
    menu.style = `position: fixed; left: ${x}px; top: ${y}px; background: #2d2d2d; color: #fff; border: 1px solid #454545; z-index: 100000; padding: 4px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);`;
    const btnBookmark = document.createElement("button");
    btnBookmark.textContent = "Add Bookmark (HR)";
    btnBookmark.style =
        "display: block; width: 100%; padding: 6px 12px; border: none; background: transparent; color: #fff; cursor: pointer; text-align: left;";
    const btnRemove = document.createElement("button");
    btnRemove.textContent = "Delete Bookmark";
    btnRemove.style =
        "display: block; width: 100%; padding: 6px 12px; border: none; background: transparent; color: #ff6b6b; cursor: pointer; text-align: left;";
    const lineText = lineEl.textContent.trim().slice(0, 50);
    btnBookmark.addEventListener("click", () => {
        applyBookmarkLine(lineEl, lineText, "add");
        menu.remove();
    });
    btnRemove.addEventListener("click", () => {
        applyBookmarkLine(lineEl, lineText, "remove");
        menu.remove();
    });
    menu.appendChild(btnBookmark);
    menu.appendChild(btnRemove);
    document.body.appendChild(menu);
    const closeMenu = (evt) => {
        if (!menu.contains(evt.target)) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
        }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

function removeBookmarkLineMenu() {
    const existing = document.getElementById("bookmark-line-action-menu");
    if (existing) existing.remove();
}

function applyBookmarkLine(lineEl, lineText, action) {
    if (!state.bookmarkLines) state.bookmarkLines = [];
    const fileName = state.spine[state.currentChapterIndex] || "";
    if (action === "add") {
        if (
            !lineEl.previousElementSibling ||
            !lineEl.previousElementSibling.classList.contains(
                "epub-bookmark-hr",
            )
        ) {
            const hr = document.createElement("hr");
            hr.className = "epub-bookmark-hr";
            hr.style =
                "border: none; height: 3px; background-color: #ff4081; margin: 8px 0; display: block; width: 100%;";
            lineEl.parentNode.insertBefore(hr, lineEl);
        }
        const exists = state.bookmarkLines.some(
            (item) => item[0] === fileName && item[1] === lineText,
        );
        if (!exists) {
            state.bookmarkLines.push([fileName, lineText]);
            saveUserData();
        }
    } else if (action === "remove") {
        if (
            lineEl.previousElementSibling &&
            lineEl.previousElementSibling.classList.contains("epub-bookmark-hr")
        ) {
            lineEl.previousElementSibling.remove();
        }
        state.bookmarkLines = state.bookmarkLines.filter(
            (item) => !(item[0] === fileName && item[1] === lineText),
        );
        saveUserData();
    }
}

function restoreBookmarkLines() {
    if (!state.bookmarkLines || !state.bookmarkLines.length) return;
    const fileName = state.spine[state.currentChapterIndex] || "";
    const chapterContentEl = document.getElementById("chapter-content");
    if (!chapterContentEl) return;
    const savedBookmarksForChapter = state.bookmarkLines.filter(
        (item) => item[0] === fileName,
    );
    if (savedBookmarksForChapter.length === 0) return;
    const textElements = chapterContentEl.querySelectorAll(
        ".epub-virtual-line, p, div, li, h1, h2, h3, h4, h5, h6, pre",
    );
    textElements.forEach((el) => {
        const hasChildBlocks = el.querySelector(
            "p, div, li, h1, h2, h3, h4, h5, h6",
        );
        if (
            hasChildBlocks &&
            !el.classList.contains("epub-virtual-line") &&
            el.tagName !== "PRE"
        )
            return;
        const elText = el.textContent.trim().slice(0, 50);
        const matched = savedBookmarksForChapter.some((b) => b[1] === elText);
        if (matched) {
            if (
                !el.previousElementSibling ||
                !el.previousElementSibling.classList.contains(
                    "epub-bookmark-hr",
                )
            ) {
                const hr = document.createElement("hr");
                hr.className = "epub-bookmark-hr";
                hr.style =
                    "border: none; height: 3px; background-color: #ff4081; margin: 8px 0; display: block; width: 100%;";
                el.parentNode.insertBefore(hr, el);
            }
        }
    });
}

function triggerFindBox() {
    const fnrBox = document.querySelector(".fnr-box");
    if (!fnrBox) {
        createBox();
    } else {
        closeBox();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const menuBtn = document.getElementById("floating-menu-btn");
    const menuBox = document.getElementById("floating-menu-box");
    const menuHeader = document.getElementById("floating-menu-header");
    const menuClose = document.getElementById("floating-menu-close");
    const readerView = document.getElementById("reader-center");
    if (!menuBtn || !menuBox) return;
    let isDraggingMenu = false;
    let menuStartX = 0,
        menuStartY = 0;
    let menuBtnLeft = 0,
        menuBtnTop = 0;
    let hasMoved = false;
    const DRAG_THRESHOLD = 5;
    const GAP = 10;
    let currentQuadrant = { x: null, y: null };
    let transitionTimeout = null;
    menuBox.style.transition = "none";
    function getClientCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }
    function updateBoxPosition(btnLeft, btnTop) {
        if (menuBox.style.display === "none") return;
        const btnRect = menuBtn.getBoundingClientRect();
        const boxRect = menuBox.getBoundingClientRect();
        let containerRect = {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        };
        if (readerView) {
            containerRect = readerView.getBoundingClientRect();
        }
        const btnCenterX = btnLeft + btnRect.width / 2;
        const btnCenterY = btnTop + btnRect.height / 2;
        const distToLeft = btnCenterX - containerRect.left;
        const distToRight =
            containerRect.left + containerRect.width - btnCenterX;
        const distToTop = btnCenterY - containerRect.top;
        const distToBottom =
            containerRect.top + containerRect.height - btnCenterY;
        let newQuadX =
            btnCenterX < containerRect.left + containerRect.width / 2
                ? "left"
                : "right";
        let newQuadY =
            btnCenterY < containerRect.top + containerRect.height / 2
                ? "top"
                : "bottom";
        if (currentQuadrant.x !== null) {
            if (newQuadX === "left" && distToLeft > boxRect.width + GAP) {
                newQuadX = currentQuadrant.x;
            }
            if (newQuadX === "right" && distToRight > boxRect.width + GAP) {
                newQuadX = currentQuadrant.x;
            }
            if (newQuadY === "top" && distToTop > boxRect.height + GAP) {
                newQuadY = currentQuadrant.y;
            }
            if (newQuadY === "bottom" && distToBottom > boxRect.height + GAP) {
                newQuadY = currentQuadrant.y;
            }
        }
        if (
            currentQuadrant.x !== null &&
            (currentQuadrant.x !== newQuadX || currentQuadrant.y !== newQuadY)
        ) {
            menuBox.style.transition = "left 0.2s ease-out, top 0.2s ease-out";
            if (transitionTimeout) clearTimeout(transitionTimeout);
            transitionTimeout = setTimeout(() => {
                menuBox.style.transition = "none";
            }, 200);
        } else if (!transitionTimeout) {
            menuBox.style.transition = "none";
        }
        currentQuadrant.x = newQuadX;
        currentQuadrant.y = newQuadY;
        let targetLeft = 0;
        let targetTop = 0;
        if (newQuadX === "left") {
            targetLeft = btnLeft + btnRect.width + GAP;
        } else {
            targetLeft = btnLeft - boxRect.width - GAP;
        }
        if (newQuadY === "top") {
            targetTop = btnTop + btnRect.height + GAP;
        } else {
            targetTop = btnTop - boxRect.height - GAP;
        }
        if (targetLeft < containerRect.left + GAP) {
            targetLeft = containerRect.left + GAP;
        }
        if (
            targetLeft + boxRect.width >
            containerRect.left + containerRect.width - GAP
        ) {
            targetLeft =
                containerRect.left + containerRect.width - boxRect.width - GAP;
        }
        if (targetTop < containerRect.top + GAP) {
            targetTop = containerRect.top + GAP;
        }
        if (
            targetTop + boxRect.height >
            containerRect.top + containerRect.height - GAP
        ) {
            targetTop =
                containerRect.top + containerRect.height - boxRect.height - GAP;
        }
        menuBox.style.bottom = "auto";
        menuBox.style.right = "auto";
        menuBox.style.left = `${targetLeft}px`;
        menuBox.style.top = `${targetTop}px`;
    }
    function onMenuStart(e) {
        isDraggingMenu = true;
        hasMoved = false;
        if (transitionTimeout) clearTimeout(transitionTimeout);
        menuBox.style.transition = "none";
        currentQuadrant = { x: null, y: null };
        const coords = getClientCoords(e);
        menuStartX = coords.x;
        menuStartY = coords.y;
        const rect = menuBtn.getBoundingClientRect();
        menuBtnLeft = rect.left;
        menuBtnTop = rect.top;
        menuBtn.style.bottom = "auto";
        menuBtn.style.right = "auto";
        menuBtn.style.left = `${menuBtnLeft}px`;
        menuBtn.style.top = `${menuBtnTop}px`;
        if (e.cancelable && e.type === "mousedown") {
            e.preventDefault();
        }
    }
    menuBtn.addEventListener("mousedown", onMenuStart);
    menuBtn.addEventListener("touchstart", onMenuStart, { passive: true });
    function onMove(e) {
        if (!isDraggingMenu) return;
        const coords = getClientCoords(e);
        const diffX = coords.x - menuStartX;
        const diffY = coords.y - menuStartY;
        if (
            Math.abs(diffX) > DRAG_THRESHOLD ||
            Math.abs(diffY) > DRAG_THRESHOLD
        ) {
            hasMoved = true;
        }
        let newBtnLeft = menuBtnLeft + diffX;
        let newBtnTop = menuBtnTop + diffY;
        let containerRect = {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        };
        if (readerView) {
            containerRect = readerView.getBoundingClientRect();
        }
        const btnRect = menuBtn.getBoundingClientRect();
        if (newBtnLeft < containerRect.left) newBtnLeft = containerRect.left;
        if (
            newBtnLeft + btnRect.width >
            containerRect.left + containerRect.width
        ) {
            newBtnLeft =
                containerRect.left + containerRect.width - btnRect.width;
        }
        if (newBtnTop < containerRect.top) newBtnTop = containerRect.top;
        if (
            newBtnTop + btnRect.height >
            containerRect.top + containerRect.height
        ) {
            newBtnTop =
                containerRect.top + containerRect.height - btnRect.height;
        }
        menuBtn.style.left = `${newBtnLeft}px`;
        menuBtn.style.top = `${newBtnTop}px`;
        updateBoxPosition(newBtnLeft, newBtnTop);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    function onEnd() {
        isDraggingMenu = false;
    }
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
    menuBtn.addEventListener("click", (e) => {
        if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (menuBox.style.display === "none" || menuBox.style.display === "") {
            menuBox.style.display = "block";
            menuBox.style.transition = "none";
            currentQuadrant = { x: null, y: null };
            const rect = menuBtn.getBoundingClientRect();
            updateBoxPosition(rect.left, rect.top);
        } else {
            menuBox.style.display = "none";
        }
    });
    menuClose.addEventListener("click", () => {
        menuBox.style.display = "none";
    });
});

(function injectHighlightStyles() {
    if (document.getElementById("epub-highlight-styles")) return;
    const style = document.createElement("style");
    style.id = "epub-highlight-styles";
    style.innerHTML = `
        .epub-highlight {
            background-color: #ffeb3b !important;
            color: inherit !important;
            cursor: pointer;
        }
        .epub-highlight-menu {
            position: fixed;
            background: #2d2d2d;
            color: #fff;
            border: 1px solid #454545;
            z-index: 100005;
            padding: 4px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            gap: 4px;
            font-family: sans-serif;
            font-size: 13px;
        }
        .epub-highlight-menu button {
            background: transparent;
            border: none;
            color: #fff;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-weight: bold;
        }
        .epub-highlight-menu button:hover {
            background: #444;
        }
        .epub-highlight-menu .btn-remove {
            color: #ff6b6b;
        }
    `;
    document.head.appendChild(style);
})();

function toggleHighlightSelection() {
    isHighlightModeActive = !isHighlightModeActive;
    updateInteractionState();
    const contentEl = document.getElementById("chapter-content");
    if (!contentEl) return;
    if (isHighlightModeActive) {
        console.log(
            "Chế độ Highlight kích hoạt: Tắt swipe, cấu hình sự kiện Menu tùy chỉnh.",
        );
        contentEl.style.userSelect = "text";
        contentEl.style.webkitUserSelect = "text";
        document.addEventListener("contextmenu", handleContextMenuBlock);
        document.addEventListener("mouseup", handlePCSelectionMenu);
        document.addEventListener("touchend", handleMobileSelectionMenu);
    } else {
        console.log("Chế độ Highlight hủy kích hoạt: Bật lại swipe.");
        removeHighlightMenu();
        document.removeEventListener("contextmenu", handleContextMenuBlock);
        document.removeEventListener("mouseup", handlePCSelectionMenu);
        document.removeEventListener("touchend", handleMobileSelectionMenu);
        window.getSelection()?.removeAllRanges();
    }
}

function handleContextMenuBlock(e) {
    if (isHighlightModeActive) {
        e.preventDefault();
    }
}

function handlePCSelectionMenu(e) {
    if (!isHighlightModeActive) return;
    if (e.button !== 2) return;
    setTimeout(() => {
        const selection = window.getSelection();
        if (
            !selection ||
            selection.isCollapsed ||
            selection.toString().trim() === ""
        ) {
            return;
        }
        const range = selection.getRangeAt(0);
        const contentEl = document.getElementById("chapter-content");
        if (!contentEl.contains(range.commonAncestorContainer)) return;
        e.preventDefault();
        showHighlightMenu(e.clientX, e.clientY, range);
    }, 20);
}

function handleMobileSelectionMenu(e) {
    if (!isHighlightModeActive) return;
    setTimeout(() => {
        const selection = window.getSelection();
        if (
            !selection ||
            selection.isCollapsed ||
            selection.toString().trim() === ""
        ) {
            return;
        }
        const range = selection.getRangeAt(0);
        const contentEl = document.getElementById("chapter-content");
        if (!contentEl.contains(range.commonAncestorContainer)) return;
        let clientX = 0;
        let clientY = 0;
        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            const rects = range.getClientRects();
            if (rects.length > 0) {
                clientX = rects[rects.length - 1].right;
                clientY = rects[rects.length - 1].bottom;
            }
        }
        showHighlightMenu(clientX, clientY, range);
    }, 150);
}

function showHighlightMenu(x, y, range) {
    removeHighlightMenu();
    const menu = document.createElement("div");
    menu.id = "epub-highlight-action-menu";
    menu.className = "epub-highlight-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y + 10}px`;
    const btnHighlight = document.createElement("button");
    btnHighlight.textContent = "Highlight";
    btnHighlight.addEventListener("click", () => {
        executeHighlightRange(range);
        menu.remove();
        window.getSelection()?.removeAllRanges();
    });
    const btnRemove = document.createElement("button");
    btnRemove.className = "btn-remove";
    btnRemove.textContent = "Remove";
    btnRemove.addEventListener("click", () => {
        executeRemoveHighlightRange(range);
        menu.remove();
        window.getSelection()?.removeAllRanges();
    });
    menu.appendChild(btnHighlight);
    menu.appendChild(btnRemove);
    document.body.appendChild(menu);
    const closeMenu = (evt) => {
        if (!menu.contains(evt.target)) {
            menu.remove();
            document.removeEventListener("mousedown", closeMenu);
            document.removeEventListener("touchstart", closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener("mousedown", closeMenu);
        document.addEventListener("touchstart", closeMenu);
    }, 0);
}

function removeHighlightMenu() {
    const existing = document.getElementById("epub-highlight-action-menu");
    if (existing) existing.remove();
}

function generateCFIFromRange(range) {
    const spineHref = state.spine[state.currentChapterIndex] || "";
    const getCFIPath = (node, offset) => {
        let path = [];
        let current = node;
        while (
            current &&
            current !== document.getElementById("chapter-content")
        ) {
            let index = 0;
            let sibling = current;
            while (sibling) {
                index += sibling.nodeType === Node.ELEMENT_NODE ? 2 : 1;
                sibling = sibling.previousSibling;
            }
            let segment =
                current.nodeType === Node.ELEMENT_NODE ? index : index;
            if (current.id) {
                segment += `[${current.id}]`;
            }
            path.unshift(segment);
            current = current.parentNode;
        }
        return `/${path.join("/")}:${offset}`;
    };
    const startCFI = getCFIPath(range.startContainer, range.startOffset);
    const endCFI = getCFIPath(range.endContainer, range.endOffset);
    return `epubcfi(/6/${state.currentChapterIndex + 1}!${startCFI},${endCFI})`;
}

function decodeRangeFromCFI(cfiStr) {
    try {
        const contentEl = document.getElementById("chapter-content");
        if (!contentEl || !cfiStr) return null;
        const partsMatch = cfiStr.match(/!\((.*?)\)/) || cfiStr.match(/!(.*)/);
        if (!partsMatch) return null;
        const cfiBody = partsMatch[1].replace(/^\(/, "").replace(/\)$/, "");
        const subParts = cfiBody.split(",");
        if (subParts.length < 3) return null;
        const basePath = subParts[0];
        const startTerminal = subParts[1];
        const endTerminal = subParts[2];
        const resolveNode = (pathStr) => {
            const segments = pathStr.split("/").filter(Boolean);
            let current = contentEl;
            for (let seg of segments) {
                let cleanSeg = parseInt(seg.split("[")[0]);
                let targetIdx = Math.floor((cleanSeg - 1) / 2);
                let elChildren = Array.from(current.childNodes);
                if (elChildren[targetIdx]) {
                    current = elChildren[targetIdx];
                } else {
                    return null;
                }
            }
            return current;
        };
        const startNodePath = basePath + startTerminal.split(":")[0];
        const endNodePath = basePath + endTerminal.split(":")[0];
        const startNode = resolveNode(startNodePath);
        const endNode = resolveNode(endNodePath);
        const startOffset = parseInt(startTerminal.split(":")[1]);
        const endOffset = parseInt(endTerminal.split(":")[1]);
        if (!startNode || !endNode) return null;
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
    } catch (e) {
        console.error("Lỗi parse EPUB CFI:", e);
        return null;
    }
}

function executeHighlightRange(range) {
    const cfi = generateCFIFromRange(range);
    const textContent = range.toString();
    const fileName = state.spine[state.currentChapterIndex] || "";
    if (!state.highlights.some((h) => h.cfi === cfi)) {
        state.highlights.push({
            cfi: cfi,
            chapterHref: fileName,
            text: textContent,
            createdAt: Date.now(),
        });
        saveUserData();
    }
    highlightRangeDOM(range);
}

function highlightRangeDOM(range) {
    const mark = document.createElement("mark");
    mark.className = "epub-highlight";
    try {
        range.surroundContents(mark);
        mark.addEventListener("click", (e) => {
            if (!isHighlightModeActive) return;
            e.stopPropagation();
            const newRange = document.createRange();
            newRange.selectNodeContents(mark);
            showHighlightMenu(e.clientX, e.clientY, newRange);
        });
    } catch (err) {
        console.warn(
            "surroundContents thất bại do dính node biên phức tạp, chuyển sang chế độ fallback text.",
            err,
        );
    }
}

function executeRemoveHighlightRange(range) {
    const cfiToRemove = generateCFIFromRange(range);
    const fileName = state.spine[state.currentChapterIndex] || "";
    let originalLength = state.highlights.length;
    state.highlights = state.highlights.filter((h) => h.cfi !== cfiToRemove);
    if (state.highlights.length === originalLength) {
        const textToCompare = range.toString().trim();
        state.highlights = state.highlights.filter(
            (h) =>
                !(
                    h.chapterHref === fileName &&
                    textToCompare.includes(h.text.trim())
                ),
        );
    }
    saveUserData();
    const currentProgressPage = state.currentPageIndex;
    loadChapter(state.currentChapterIndex, true, currentProgressPage);
}

function renderHighlightsForCurrentChapter() {
    if (!state.highlights || !state.highlights.length) return;
    const fileName = state.spine[state.currentChapterIndex] || "";
    const currentChapterHighlights = state.highlights.filter(
        (h) => h.chapterHref === fileName,
    );
    currentChapterHighlights.forEach((highlight) => {
        const recoveredRange = decodeRangeFromCFI(highlight.cfi);
        if (recoveredRange) {
            highlightRangeDOM(recoveredRange);
        }
    });
}
