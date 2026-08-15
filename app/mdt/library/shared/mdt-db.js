const MDT_DB_NAME = "MDT_Library";
const MDT_DB_VERSION = 1;
const MDT_STORE_BOOKS = "books";
const MDT_STORE_CHAPTERS = "chapters";

function mdtOpenDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(MDT_DB_NAME, MDT_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(MDT_STORE_BOOKS)) {
                const store = db.createObjectStore(MDT_STORE_BOOKS, {
                    keyPath: "id",
                });
                store.createIndex("idx_title", "title", { unique: false });
                store.createIndex("idx_lastReadAt", "lastReadAt", {
                    unique: false,
                });
                store.createIndex("idx_updatedAt", "updatedAt", {
                    unique: false,
                });
            }
            if (!db.objectStoreNames.contains(MDT_STORE_CHAPTERS)) {
                const store = db.createObjectStore(MDT_STORE_CHAPTERS, {
                    keyPath: "id",
                });
                store.createIndex("idx_bookId", "bookId", { unique: false });
                store.createIndex("idx_bookId_index", ["bookId", "index"], {
                    unique: false,
                });
            }
        };
    });
}

function mdtGenId(prefix) {
    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 10)
    );
}

async function mdtGetAllBooks() {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_BOOKS, "readonly");
        const store = tx.objectStore(MDT_STORE_BOOKS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function mdtGetBook(id) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_BOOKS, "readonly");
        const store = tx.objectStore(MDT_STORE_BOOKS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function mdtSaveBook(book) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_BOOKS, "readwrite");
        const store = tx.objectStore(MDT_STORE_BOOKS);
        const req = store.put(book);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function mdtDeleteBook(id) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            [MDT_STORE_BOOKS, MDT_STORE_CHAPTERS],
            "readwrite",
        );
        const bookStore = tx.objectStore(MDT_STORE_BOOKS);
        const chapterStore = tx.objectStore(MDT_STORE_CHAPTERS);

        bookStore.delete(id);

        const index = chapterStore.index("idx_bookId");
        const cursorReq = index.openCursor(IDBKeyRange.only(id));
        cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                chapterStore.delete(cursor.primaryKey);
                cursor.continue();
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function mdtUpdateBookLastRead(bookId, chapterId, chapterIndex) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_BOOKS, "readwrite");
        const store = tx.objectStore(MDT_STORE_BOOKS);
        const req = store.get(bookId);
        req.onsuccess = () => {
            const book = req.result;
            if (!book) return resolve();
            book.lastReadAt = Date.now();
            book.lastReadChapterId = chapterId;
            book.lastReadChapterIndex = chapterIndex;
            store.put(book);
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}
async function mdtGetChapters(bookId) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readonly");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const index = store.index("idx_bookId");
        const req = index.getAll(IDBKeyRange.only(bookId));
        req.onsuccess = () => {
            const result = req.result || [];
            result.sort((a, b) => (a.index || 0) - (b.index || 0));
            resolve(result);
        };
        req.onerror = () => reject(req.error);
    });
}

async function mdtGetChapter(chapterId) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readonly");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function mdtSaveChapter(chapter) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.put(chapter);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function mdtUpdateChapterContent(chapterId, body) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => {
            const ch = req.result;
            if (!ch) return resolve();
            ch.body = body;
            ch.updatedAt = Date.now();
            store.put(ch);
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

async function mdtRenameChapter(chapterId, title) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => {
            const ch = req.result;
            if (!ch) return resolve();
            ch.title = title;
            ch.updatedAt = Date.now();
            store.put(ch);
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

async function mdtMarkChapterRead(chapterId) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.get(chapterId);
        req.onsuccess = () => {
            const ch = req.result;
            if (!ch) return resolve();
            ch.read = true;
            ch.readAt = Date.now();
            store.put(ch);
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

async function mdtDeleteChapter(chapterId) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);
        const req = store.delete(chapterId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function mdtAddChapter(bookId, title, body) {
    const chapters = await mdtGetChapters(bookId);
    const newIndex = chapters.length;
    const chapter = {
        id: `chap_${bookId}_${newIndex}`,
        bookId: bookId,
        index: newIndex,
        title: title,
        body: body || "",
        read: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    await mdtSaveChapter(chapter);
    return chapter;
}

function countWords(text) {
    if (!text) return 0;
    const cjk = (
        text.match(
            /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g,
        ) || []
    ).length;
    const latin = (
        text
            .replace(
                /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g,
                " ",
            )
            .match(/\S+/g) || []
    ).length;
    return cjk + latin;
}

async function mdtCreateBook(parsed, sourceFileName) {
    const bookId =
        "book_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
    const now = Date.now();

    const book = {
        id: bookId,
        title: parsed.title || sourceFileName || "Truyện không có tiêu đề",
        description: parsed.description || "Chưa cập nhật",
        characters: parsed.characters || [],
        sourceFileName: sourceFileName || "",
        createdAt: now,
        updatedAt: now,
        lastReadAt: 0,
        lastReadChapterId: null,
        lastReadChapterIndex: 0,
        chapterCount: parsed.chapters.length,
    };

    await mdtSaveBook(book);
    await mdtSaveChaptersBatch(bookId, parsed.chapters);
    return book;
}

async function mdtSaveChaptersBatch(bookId, chapters) {
    const db = await mdtOpenDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MDT_STORE_CHAPTERS, "readwrite");
        const store = tx.objectStore(MDT_STORE_CHAPTERS);

        chapters.forEach((ch, i) => {
            store.put({
                id: `chap_${bookId}_${i}`,
                bookId: bookId,
                index: i,
                title: ch.title,
                body: ch.body,
                read: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
