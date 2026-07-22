const DB_NAME = "EpubReaderLocalDB";
const DB_VERSION = 2;
const STORE_NAME = "bookshelf";
const ASSET_STORE_NAME = "assets";
let searchQuery = "";
let sortMode = "name";
let activeContextBookId = null;
let longTouchTimer = null;

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (typeof t === "function") {
            el.innerText = t(key);
        }
    });
}
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
                db.createObjectStore(ASSET_STORE_NAME, {
                    keyPath: "path",
                });
            }
        };
    });
}
async function renderRecentBooks() {
    const grid = document.getElementById("recent-grid");

    let books = await getAllBooksFromStorage();

    books = books
        .filter((b) => b.lastReadAt)
        .sort((a, b) => b.lastReadAt - a.lastReadAt)
        .slice(0, 10);

    grid.innerHTML = "";

    if (books.length === 0) {
        grid.innerHTML = "<p>Chưa có sách nào được đọc.</p>";
        return;
    }

    books.forEach((book) => {
        const card = document.createElement("div");
        card.className = "book-card";
        let coverSrc = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='140' viewBox='0 0 100 140'><rect width='100' height='140' fill='%23ccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23666'>${t("library.no_cover")}</text></svg>`;
        if (book.coverBlob) {
            coverSrc = URL.createObjectURL(book.coverBlob);
        }
        card.innerHTML = `                        <button class="btn-delete" onclick="event.stopPropagation(); removeRecentBook('${book.id}')">✕</button>                        <img class="book-cover" src="${coverSrc}" alt="Cover">                        <div class="book-title">${book.title}</div>                        <div class="book-author">${book.author}</div>                    `;
        card.onclick = () => openBookInReader(book.id);

        attachContextMenuEvents(card, book.id);

        grid.appendChild(card);
    });
}
async function saveBookToStorage(bookData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(bookData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
async function updateLastRead(bookId) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const req = store.get(bookId);

        req.onsuccess = () => {
            const book = req.result;
            if (!book) return resolve();

            book.lastReadAt = Date.now();

            store.put(book);
            resolve();
        };

        req.onerror = () => reject(req.error);
    });
}
async function removeFromRecent(bookId) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const req = store.get(bookId);

        req.onsuccess = () => {
            const book = req.result;

            if (!book) {
                resolve();
                return;
            }

            delete book.lastReadAt;

            store.put(book);

            resolve();
        };

        req.onerror = () => reject(req.error);
    });
}
async function saveAssetToStorage(assetData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
        const store = transaction.objectStore(ASSET_STORE_NAME);
        const request = store.put(assetData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
function normalizeAssetPath(path) {
    return (path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");
}
function isImagePath(path) {
    return /\.(jpe?g|png|gif|svg|webp|bmp|avif|ico)$/i.test(path);
}
async function saveAssetsToStorage(zip, opfPath) {
    const basePath = opfPath.includes("/")
        ? opfPath.substring(0, opfPath.lastIndexOf("/")) + "/"
        : "";

    const entries = Object.keys(zip.files).filter(
        (filePath) => !zip.files[filePath].dir && isImagePath(filePath),
    );

    for (const entryPath of entries) {
        const file = zip.file(entryPath);
        if (!file) continue;
        const blob = await file.async("blob");
        const normalizedPath = normalizeAssetPath(entryPath);
        await saveAssetToStorage({
            path: normalizedPath,
            fileName: normalizedPath.split("/").pop(),
            fullPath: normalizedPath,
            mimeType: blob.type || "image/octet-stream",
            blob,
        });
    }
}
async function getAllBooksFromStorage() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function deleteBookFromStorage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
document
    .getElementById("library-file-input")
    .addEventListener("change", handleImportEpub);
async function handleImportEpub(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const importPromises = fileArray.map(async (file) => {
        if (!file.name.endsWith(".epub")) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            const containerXmlStr = await zip
                .file("META-INF/container.xml")
                .async("string");
            const parser = new DOMParser();
            const containerDoc = parser.parseFromString(
                containerXmlStr,
                "text/xml",
            );
            const opfPath = containerDoc
                .querySelector("rootfile")
                .getAttribute("full-path");
            const opfStr = await zip.file(opfPath).async("string");
            const opfDoc = parser.parseFromString(opfStr, "text/xml");

            const metadata = opfDoc.querySelector("metadata");

            const title =
                metadata?.querySelector("dc\\:title")?.textContent ||
                metadata?.querySelector("title")?.textContent ||
                file.name.replace(".epub", "");

            const author =
                metadata?.querySelector("dc\\:creator")?.textContent ||
                metadata?.querySelector("creator")?.textContent ||
                t("library.unknown_author");

            const bookId =
                crypto.randomUUID?.() || title + Date.now() + Math.random();

            let coverHref = null;

            const coverMeta = opfDoc.querySelector('meta[name="cover"]');

            if (coverMeta) {
                const coverId = coverMeta.getAttribute("content");

                coverHref = opfDoc
                    .querySelector(`manifest > item[id="${coverId}"]`)
                    ?.[`getAttribute`]("href");
            }

            if (!coverHref) {
                coverHref = opfDoc
                    .querySelector('manifest > item[properties~="cover-image"]')
                    ?.getAttribute("href");
            }

            let coverBlob = null;
            if (coverHref) {
                let basePath = opfPath.includes("/")
                    ? opfPath.substring(0, opfPath.lastIndexOf("/")) + "/"
                    : "";
                let fullCoverPath = basePath + coverHref;
                const coverFile =
                    zip.file(fullCoverPath) || zip.file(coverHref);
                if (coverFile) coverBlob = await coverFile.async("blob");
            }

            await saveAssetsToStorage(zip, opfPath);

            const bookRecord = {
                id: bookId,
                title: title,
                author: author,
                fileBlob: file,
                coverBlob: coverBlob,
                addedAt: Date.now(),
                size: file.size || 0,
                genre: extractGenre(opfDoc),
            };

            await saveBookToStorage(bookRecord);
        } catch (err) {
            console.error(`Lỗi khi import file ${file.name}: `, err);
        }
    });

    await Promise.all(importPromises);

    renderLibraryGrid();

    e.target.value = "";
}
function extractGenre(opfDoc) {
    const meta = opfDoc.querySelector("subject, dc\\:subject");
    return meta?.textContent?.trim() || "Unknown";
}
document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderLibraryGrid();
});

document.getElementById("sort-select").addEventListener("change", (e) => {
    sortMode = e.target.value;
    renderLibraryGrid();
});
function renderEmptyState() {
    const grid = document.getElementById("library-grid");
    grid.innerHTML = `                    <p style="grid-column: 1/-1; text-align:center; color:#999; padding: 40px 0;">                        ${t("library.empty_state")}                    </p>                `;
}
let renderToken = 0;
async function removeRecentBook(id) {
    await removeFromRecent(id);

    renderRecentBooks();
    renderLibraryGrid();
}
async function renderLibraryGrid() {
    const token = ++renderToken;
    const grid = document.getElementById("library-grid");
    grid.innerHTML = "";
    let books = await getAllBooksFromStorage();
    if (searchQuery) {
        books = books.filter((b) => {
            return (
                b.title?.toLowerCase().includes(searchQuery) ||
                b.author?.toLowerCase().includes(searchQuery) ||
                b.genre?.toLowerCase().includes(searchQuery)
            );
        });
    }
    if (token !== renderToken) return;
    if (books.length === 0) {
        renderEmptyState();
        return;
    }

    books.sort((a, b) => {
        switch (sortMode) {
            case "name":
                return (a.title || "").localeCompare(b.title || "");

            case "date":
                return (b.addedAt || 0) - (a.addedAt || 0);

            case "size":
                return (b.size || 0) - (a.size || 0);

            case "author":
                return (a.author || "").localeCompare(b.author || "");
            case "recent":
                return (b.lastReadAt || 0) - (a.lastReadAt || 0);
            case "genre":
                return (a.genre || "").localeCompare(b.genre || "");

            default:
                return 0;
        }
    });
    if (books.length === 0) {
        renderEmptyState();
        return;
    }
    books.forEach((book) => {
        const card = document.createElement("div");
        card.className = "book-card";
        let coverSrc = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='140' viewBox='0 0 100 140'><rect width='100' height='140' fill='%23ccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23666'>${t("library.no_cover")}</text></svg>`;
        if (book.coverBlob) {
            coverSrc = URL.createObjectURL(book.coverBlob);
        }
        card.innerHTML = `                        <button class="btn-delete" onclick="event.stopPropagation(); askDeleteBook('${book.id}')">✕</button>                        <img class="book-cover" src="${coverSrc}" alt="Cover">                        <div class="book-title">${book.title}</div>                        <div class="book-author">${book.author}</div>                    `;
        card.onclick = () => openBookInReader(book.id);

        attachContextMenuEvents(card, book.id);

        grid.appendChild(card);
    });
}
async function askDeleteBook(id) {
    if (!confirm(t("library.confirm_delete"))) return;

    await deleteBookFromStorage(id);

    renderRecentBooks();
    renderLibraryGrid();
}
function openBookInReader(bookId) {
    updateLastRead(bookId);
    localStorage.setItem("selected_local_book_id", bookId);
    window.location.href = "ereader.html";
}
onI18nChange(() => {
    applyI18n();
    renderRecentBooks();
    renderLibraryGrid();
});

document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

function initCustomContextMenu() {
    if (document.getElementById("custom-context-menu")) return;

    const menu = document.createElement("div");
    menu.id = "custom-context-menu";

    Object.assign(menu.style, {
        position: "fixed",
        display: "none",
        zIndex: "99999",
        backgroundColor: "#ffffff",
        border: "1px solid #ddd",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        borderRadius: "4px",
        padding: "4px 0",
        minWidth: "140px",
    });

    menu.innerHTML = `
        <button id="ctx-btn-edit" style="display:block; width:100%; padding:10px 15px; text-align:left; border:none; background:none; cursor:pointer; font-size:14px;">Edit Metadata</button>
        <button id="ctx-btn-remove" style="display:block; width:100%; padding:10px 15px; text-align:left; border:none; background:none; cursor:pointer; font-size:14px; color:red;">Remove Book</button>
    `;

    menu.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener(
            "pointerenter",
            () => (btn.style.backgroundColor = "#f5f5f5"),
        );
        btn.addEventListener(
            "pointerleave",
            () => (btn.style.backgroundColor = "transparent"),
        );
    });

    document.body.appendChild(menu);

    document.getElementById("ctx-btn-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display = "none";

        if (activeContextBookId) {
            askDeleteBook(activeContextBookId);
        }
    });

    document.getElementById("ctx-btn-edit").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display = "none";

        if (!activeContextBookId) return;

        const modal = document.createElement("div");
        modal.id = "epub-editor-modal";
        Object.assign(modal.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: "100000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
        });

        const iframe = document.createElement("iframe");
        iframe.src = `../infoeditor/index.html?mode=iframe&bookId=${activeContextBookId}`;
        Object.assign(iframe.style, {
            width: "90vw",
            height: "90vh",
            border: "none",
            borderRadius: "8px",
            backgroundColor: "#ffffff",
        });

        modal.appendChild(iframe);
        document.body.appendChild(modal);
    });

    window.addEventListener("message", (e) => {
        if (e.data && e.data.action === "close_editor_iframe") {
            const modal = document.getElementById("epub-editor-modal");
            if (modal) modal.remove();

            if (typeof renderRecentBooks === "function") renderRecentBooks();
            if (typeof renderLibraryGrid === "function") renderLibraryGrid();
        }
    });

    document.addEventListener("click", () => {
        menu.style.display = "none";
    });
}

function showContextMenu(x, y, bookId) {
    const menu = document.getElementById("custom-context-menu");
    if (!menu) return;

    activeContextBookId = bookId;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = "block";

    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 5}px`;
    }
    if (y + rect.height > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 5}px`;
    }
}

function attachContextMenuEvents(cardElement, bookId) {
    // Xử lý PC: Click Chuột Phải
    cardElement.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, bookId);
    });

    cardElement.addEventListener("pointerdown", (e) => {
        // Chỉ xử lý cảm ứng khi giữ
        if (e.pointerType !== "touch") return;

        longTouchTimer = setTimeout(() => {
            showContextMenu(e.clientX, e.clientY, bookId);
            if (navigator.vibrate) navigator.vibrate(40);
        }, 700);
    });

    const cancelLongPress = () => {
        if (longTouchTimer) {
            clearTimeout(longTouchTimer);
            longTouchTimer = null;
        }
    };

    cardElement.addEventListener("pointerup", cancelLongPress);
    cardElement.addEventListener("pointermove", cancelLongPress);
    cardElement.addEventListener("pointercancel", cancelLongPress);
}

window.addEventListener("DOMContentLoaded", () => {
    initCustomContextMenu();
    applyI18n();
    renderRecentBooks();
    renderLibraryGrid();
});
