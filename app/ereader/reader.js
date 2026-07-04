const DB_NAME = "EpubReaderLocalDB";
const ASSET_STORE_NAME = "assets";

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
    bookmarks: [],
    highlights: [],
    bookmarkLines: [],
    search: {
        keyword: "",
        results: [],
        lastIndex: -1,
        activeMarks: [],
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

    state.toc = [];
    state.tocFile = null;

    const tocItem = Array.from(items).find((i) => {
        const mediaType = i.getAttribute("media-type") || "";
        const properties = i.getAttribute("properties") || "";
        const id = i.getAttribute("id") || "";

        return (
            properties.includes("nav") ||
            mediaType === "application/x-dtbncx+xml" ||
            id.toLowerCase().includes("toc") ||
            id.toLowerCase().includes("ncx")
        );
    });

    if (tocItem) {
        state.tocFile = tocItem.getAttribute("href");
    }
}

async function parseNCX(href) {
    const path = resolveRelativePath(state.basePath, href);

    const file = state.zip.file(path);

    if (!file) return [];

    const xml = await file.async("string");

    const doc = new DOMParser().parseFromString(xml, "text/xml");

    return [...doc.querySelectorAll("navPoint")].map((p) => {
        return {
            title: p.querySelector("text")?.textContent || "Untitled",

            href: p.querySelector("content")?.getAttribute("src") || "",
        };
    });
}

async function parseNavXhtml(href) {
    const path = resolveRelativePath(state.basePath, href);

    const file = state.zip.file(path);

    if (!file) return [];

    const html = await file.async("string");

    const doc = new DOMParser().parseFromString(html, "text/html");

    return [...doc.querySelectorAll("nav a")]
        .map((a) => ({
            title: a.textContent.trim(),
            href: a.getAttribute("href"),
        }))
        .filter((x) => x.href);
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

    setTimeout(() => {
        hydrateImages(contentEl, fullPath);
    }, 0);

    state.currentPageIndex = preservePage
        ? state.currentPageIndex
        : initialPage === Infinity
          ? state.maxPagesInChapter - 1
          : initialPage;

    requestAnimationFrame(() => {
        recalculatePagination();
        renderCurrentPagePosition();
        updateStatusBar();
    });
}

async function resolveEmbeddedAssets(htmlContent, currentChapterFullPath) {
    const currentDir =
        currentChapterFullPath.substring(
            0,
            currentChapterFullPath.lastIndexOf("/"),
        ) + "/";

    console.log("\n[ASSET] ===============================");
    console.log("[ASSET] chapter full path:", currentChapterFullPath);
    console.log("[ASSET] currentDir:", currentDir);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const images = doc.querySelectorAll("img, image");

    console.log("[ASSET] found images:", images.length);

    for (let img of images) {
        let tag = img.tagName.toLowerCase();
        let srcAttr = tag === "image" ? "xlink:href" : "src";
        let rawSrc = img.getAttribute(srcAttr);

        console.log("\n-----------------------------");
        console.log("[IMG] raw src:", rawSrc);

        if (!rawSrc) {
            console.warn("[IMG] ❌ empty src");
            continue;
        }

        if (rawSrc.startsWith("data:") || rawSrc.startsWith("http")) {
            console.log("[IMG] ⏭ skip external/data image");
            continue;
        }

        let resolvedPath = resolveRelativePath(currentDir, rawSrc);
        console.log("[IMG] resolved relative path:", resolvedPath);

        let absoluteImgPath = normalizeAssetPath(resolvedPath);
        console.log("[IMG] normalized path:", absoluteImgPath);

        let blobUrl = await getAssetBlobUrl(absoluteImgPath);
        console.log("[IMG] IndexedDB result:", blobUrl ? "HIT ✅" : "MISS ❌");

        if (!blobUrl) {
            console.log("[IMG] fallback -> zip lookup:", absoluteImgPath);

            let imgFile = state.zip.file(absoluteImgPath);

            if (!imgFile) {
                console.error("[IMG] ❌ NOT FOUND IN ZIP:", absoluteImgPath);
                continue;
            }

            let blob = await imgFile.async("blob");
            blobUrl = URL.createObjectURL(blob);

            console.log("[IMG] created blob URL from zip");
            state.blobUrls.push(blobUrl);
        }

        if (blobUrl) {
            console.log("[IMG] ✅ inject image");

            if (tag === "image") {
                let newImg = document.createElement("img");
                newImg.src = blobUrl;
                img.parentNode.replaceChild(newImg, img);
            } else {
                img.setAttribute("src", blobUrl);
            }
        }
    }

    console.log("[ASSET] ===============================\n");

    return doc.documentElement.innerHTML;
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

function setupGlobalInteractions() {
    const viewEl = document.getElementById("reader-center");

    let swipe = {
        active: false,
        startX: 0,
        startY: 0,
        isTouch: false,
        threshold: 60,
        locked: false,
    };

    function handleSwipeEnd(dx, dy) {
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

            toggleBookmark();
        }

        if (e.altKey && e.key.toLowerCase() == "a") {
            e.preventDefault();

            createHighlight("yellow");
        }

        if (e.altKey && e.key.toLowerCase() == "h") {
            e.preventDefault();

            openSearchDialog();
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
    });

    viewEl.addEventListener("mousedown", (e) => {
        if (e.button !== 0 && e.button !== 2) return;

        swipe.active = true;
        swipe.isTouch = false;
        swipe.startX = e.clientX;
        swipe.startY = e.clientY;
        swipe.button = e.button;
    });

    window.addEventListener("mousemove", (e) => {
        if (!swipe.active) return;

        const dx = e.clientX - swipe.startX;
        const dy = e.clientY - swipe.startY;
    });

    window.addEventListener("mouseup", (e) => {
        if (!swipe.active) return;

        const dx = e.clientX - swipe.startX;
        const dy = e.clientY - swipe.startY;

        swipe.active = false;
        handleSwipeEnd(dx, dy);
    });

    viewEl.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length !== 1) return;

            swipe.active = true;
            swipe.isTouch = true;
            swipe.startX = e.touches[0].clientX;
            swipe.startY = e.touches[0].clientY;
        },
        { passive: true },
    );

    viewEl.addEventListener(
        "touchmove",
        (e) => {
            if (!swipe.active || e.touches.length !== 1) return;

            const dx = e.touches[0].clientX - swipe.startX;

            if (Math.abs(dx) > 10) {
                e.preventDefault();
            }
        },
        { passive: false },
    );

    viewEl.addEventListener("touchend", (e) => {
        if (!swipe.active) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - swipe.startX;
        const dy = touch.clientY - swipe.startY;

        swipe.active = false;
        handleSwipeEnd(dx, dy);
    });

    document.addEventListener(
        "contextmenu",
        (e) => {
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
    document.getElementById(id).style.display = show ? "block" : "none";
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

function buildTocDOM() {
    const listEl = document.getElementById("toc-panel");

    if (!listEl) return;

    listEl.innerHTML = state.toc
        .map((item) => {
            const chapterIndex = state.spine.findIndex(
                (s) => s.split("#")[0] === item.href.split("#")[0],
            );

            return `
                <li onclick="
                    loadChapter(${chapterIndex});
                    toggleOverlay('toc-overlay', false);
                ">
                    ${item.title}
                </li>
            `;
        })
        .join("");
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

    const loadVoices = () => {
        state.tts.voices = window.speechSynthesis.getVoices();

        const selector = document.getElementById("tts-voice");
        selector.innerHTML = state.tts.voices
            .map(
                (v) =>
                    `<option value="${v.name}">
                        ${v.name} (${v.lang})
                    </option>`,
            )
            .join("");

        state.tts.voice = state.tts.voices[0] || null;
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
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

function createHighlight(color = "yellow", hasNote = false) {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    let note = "";

    if (hasNote) {
        note = prompt("Ghi chú:", "") || "";
    }

    state.highlights.push({
        id: Date.now(),
        chapterIndex: state.currentChapterIndex,
        pageIndex: state.currentPageIndex,
        text,
        color,
        note,
        createdAt: Date.now(),
    });

    saveUserData();

    selection.removeAllRanges();

    pushReaderDown();

    activateCompactUI(); // 👈 NEW
}

function toggleBookmark() {
    if (!state.bookId) return;

    const idx = state.bookmarks.findIndex(
        (b) =>
            b.chapterIndex === state.currentChapterIndex &&
            b.pageIndex === state.currentPageIndex,
    );

    if (idx >= 0) {
        state.bookmarks.splice(idx, 1);
    } else {
        state.bookmarks.push({
            id: Date.now(),
            chapterIndex: state.currentChapterIndex,
            pageIndex: state.currentPageIndex,
            createdAt: Date.now(),
        });
    }

    saveUserData();
    renderBookmarksList();
    pushReaderDown();

    activateCompactUI(); // 👈 NEW
}

async function searchFullTextInBook(keyword) {
    keyword = keyword.trim().toLowerCase();

    if (keyword.length < 2) return [];

    const results = [];

    for (let i = state.currentChapterIndex; i < state.spine.length; i++) {
        const href = state.spine[i];

        const path = resolveRelativePath(state.basePath, href);

        const file = state.zip.file(path);

        if (!file) continue;

        const html = await file.async("string");

        const doc = new DOMParser().parseFromString(html, "text/html");

        const text =
            doc.body?.textContent || doc.documentElement.textContent || "";

        let pos = text.toLowerCase().indexOf(keyword);

        while (pos !== -1) {
            results.push({
                chapterIndex: i,
                chapterTitle: state.toc[i]?.title || `Chương ${i + 1}`,
                charOffset: pos,
                keyword,
                snippet:
                    "..." +
                    text.substring(
                        Math.max(0, pos - 40),
                        Math.min(text.length, pos + keyword.length + 40),
                    ) +
                    "...",
            });

            pos = text.toLowerCase().indexOf(keyword, pos + keyword.length);
        }
    }

    state.search.keyword = keyword;
    state.search.results = results;
    state.search.lastIndex = results.length ? 0 : -1;

    return results;
}

function openSearchDialog() {
    if (document.getElementById("search-bar")) return;

    const bar = document.createElement("div");
    bar.id = "search-bar";
    bar.innerHTML = `
        <input id="search-input" placeholder="Search..." />
        <button onclick="searchPrev()">▲</button>
        <button onclick="searchNext()">▼</button>
        <span id="search-count">0/0</span>
        <button onclick="closeSearch()">✕</button>
    `;

    document.body.appendChild(bar);

    document.getElementById("search-input").addEventListener("input", (e) => {
        runSearch(e.target.value);
    });
}

function runSearch(keyword) {
    clearSearchMarks();

    keyword = keyword.trim();
    if (!keyword) return;

    state.searchUI.keyword = keyword;
    state.searchUI.currentIndex = 0;

    const root = document.getElementById("chapter-content");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    const matches = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue;

        const lower = text.toLowerCase();
        const kw = keyword.toLowerCase();

        let idx = lower.indexOf(kw);

        if (idx !== -1) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + keyword.length);

            const mark = document.createElement("mark");
            mark.className = "search-hit";

            range.surroundContents(mark);

            matches.push(mark);
        }
    }

    state.searchUI.results = matches;

    updateSearchUI();

    focusMatch(0);
}

function focusMatch(index) {
    const hits = state.searchUI.results;
    if (!hits.length) return;

    index = (index + hits.length) % hits.length;
    state.searchUI.currentIndex = index;

    hits.forEach((h, i) => {
        h.classList.toggle("active-hit", i === index);
    });

    hits[index].scrollIntoView({
        behavior: "smooth",
        block: "center",
    });

    updateSearchUI();
}

function searchNext() {
    focusMatch(state.searchUI.currentIndex + 1);
}

function searchPrev() {
    focusMatch(state.searchUI.currentIndex - 1);
}

function clearSearchMarks() {
    document.querySelectorAll("mark.search-hit").forEach((m) => {
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
    });

    state.searchUI.results = [];
}

function closeSearch() {
    clearSearchMarks();
    document.getElementById("search-bar")?.remove();
}

function updateSearchUI() {
    const el = document.getElementById("search-count");
    if (!el) return;

    const total = state.searchUI.results.length;
    const current = state.searchUI.currentIndex + 1;

    el.textContent = total ? `${current}/${total}` : "0/0";
}

function activateCompactUI() {
    const center = document.getElementById("reader-center");

    center.classList.add("reader-compact");

    clearTimeout(state._compactTimer);

    state._compactTimer = setTimeout(() => {
        center.classList.remove("reader-compact");
    }, 4000);
}
function exportUserDataBackup() {
    const allProgress = JSON.parse(
        localStorage.getItem("epub_reader_progress") || "{}",
    );

    const backupData = {
        progress: allProgress[state.bookId] || null,
        bookmarks: state.bookmarks,
        highlights: state.highlights,
        ux: state.ux,
        exportedAt: Date.now(),
    };

    const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
        "download",
        `epub_backup_${state.bookId || "data"}.json`,
    );
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
            if (data.ux) state.ux = data.ux;
            if (data.bookmarks) state.bookmarks = data.bookmarks;
            if (data.highlights) state.highlights = data.highlights;

            if (data.progress && state.bookId) {
                const allProgress = JSON.parse(
                    localStorage.getItem("epub_reader_progress") || "{}",
                );
                allProgress[state.bookId] = data.progress;
                localStorage.setItem(
                    "epub_reader_progress",
                    JSON.stringify(allProgress),
                );
                state.currentChapterIndex = data.progress.chapterIndex;
                state.currentPageIndex = data.progress.pageIndex;
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

    const DRAG_THRESHOLD = 8; // px

    handle.style.cursor = "grab";
    handle.style.touchAction = "none"; // Quan trọng trên mobile

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

        // Không cho kéo ra ngoài màn hình
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
    [
        "zone-left",
        "zone-right",
        "zone-center",
        "btn-tl",
        "btn-tr",
        "btn-bl",
        "btn-br",
    ].forEach((id) => {
        const el = document.getElementById(id);

        if (el) {
            el.style.transition = ".25s";

            el.style.transform = "translateY(70px)";
        }
    });

    setTimeout(() => {
        [
            "zone-left",
            "zone-right",
            "zone-center",
            "btn-tl",
            "btn-tr",
            "btn-bl",
            "btn-br",
        ].forEach((id) => {
            const el = document.getElementById(id);

            if (el) el.style.transform = "";
        });
    }, 2500);
}

async function openSearchDialog() {
    const kw = prompt("Search");
    if (!kw) return;

    const results = await searchFullTextInBook(kw);

    if (!results.length) {
        alert("Không tìm thấy.");
        return;
    }

    state.searchUI.results = results;
    state.searchUI.currentIndex = 0;

    await goToSearchResult(0);
}

async function goToSearchResult(index) {
    const results = state.searchUI.results;
    if (!results.length) return;

    index = (index + results.length) % results.length;
    state.searchUI.currentIndex = index;

    const r = results[index];

    await loadChapter(r.chapterIndex);

    // đợi render ổn định (an toàn hơn setTimeout)
    requestAnimationFrame(() => {
        highlightSearchResult(r.keyword);
        scrollToKeyword(r.keyword);
    });
}

function scrollToKeyword(keyword) {
    const el = document.getElementById("chapter-content");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);

    const kw = keyword.toLowerCase();

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const idx = node.nodeValue.toLowerCase().indexOf(kw);

        if (idx !== -1) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + keyword.length);

            const rect = range.getBoundingClientRect();

            window.scrollBy({
                top: rect.top - window.innerHeight / 2,
                behavior: "smooth",
            });

            break;
        }
    }
}
