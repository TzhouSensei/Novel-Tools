import {
    parseEpubMobileV2,
    makeTitleBox,
    makeInfoBox,
} from "../../parser/epubParserMobile.js";

let Filesystem = null;
try {
    Filesystem = Capacitor.Plugins.Filesystem;
} catch {
    console.log("Không có Capacitor");
}
let title = "";
const fileInput = document.getElementById("file");
const output = document.getElementById("output");
const btn = document.getElementById("download");

const DB_NAME = "EpubParserDB";
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("metadata")) {
                db.createObjectStore("metadata");
            }
            if (!db.objectStoreNames.contains("chapters")) {
                db.createObjectStore("chapters", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const clearDB = async () => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(["metadata", "chapters"], "readwrite");
            tx.objectStore("metadata").clear();
            tx.objectStore("chapters").clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Lỗi khi xóa IndexedDB:", err);
    }
};

clearDB();

const saveMetadata = async (metaData) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("metadata", "readwrite");
        tx.objectStore("metadata").put(metaData, "current_book");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const saveChapter = async (id, title, text) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("chapters", "readwrite");
        tx.objectStore("chapters").put({ id, title, text });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const getMetadata = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("metadata", "readonly");
        const req = tx.objectStore("metadata").get("current_book");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(tx.error);
    });
};

const getChaptersCount = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("chapters", "readonly");
        const req = tx.objectStore("chapters").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(tx.error);
    });
};

const splitterBox = document.createElement("div");
splitterBox.style.margin = "10px 0";

const splitterLength = document.createElement("input");
splitterLength.type = "number";
splitterLength.min = "1";
splitterLength.value = "11";
splitterLength.style.marginLeft = "15px";
splitterLength.style.width = "80px";

const splitterLengthLabel = document.createElement("label");
splitterLengthLabel.textContent = " Width: ";
splitterLengthLabel.appendChild(splitterLength);

const splitterOptions = [
    { label: "Dash (-----)", value: "dash" },
    { label: "Equal (=====)", value: "equal" },
    { label: "Star (***** )", value: "star" },
    { label: "Wave (~~~~~)", value: "wave" },
    { label: "Box (*====*)", value: "box" },
];

splitterOptions.forEach((opt) => {
    const label = document.createElement("label");
    label.style.marginRight = "10px";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "splitter";
    radio.value = opt.value;
    label.appendChild(radio);
    label.appendChild(document.createTextNode(" " + opt.label));
    splitterBox.appendChild(label);
});
splitterBox.appendChild(splitterLengthLabel);
fileInput.parentNode.insertBefore(splitterBox, btn);

const getSplitter = () => {
    const selected = document.querySelector("input[name='splitter']:checked");
    let width = parseInt(splitterLength.value, 10);
    if (isNaN(width)) width = 11;

    switch (selected?.value) {
        case "dash":
            width = Math.max(3, width);
            return "\n\n" + "-".repeat(width) + "\n\n";
        case "equal":
            width = Math.max(3, width);
            return "\n\n" + "=".repeat(width) + "\n\n";
        case "star":
            width = Math.max(3, width);
            return "\n\n" + "*".repeat(width) + "\n\n";
        case "wave":
            width = Math.max(3, width);
            return "\n\n" + "~".repeat(width) + "\n\n";
        case "box":
            width = Math.max(1, width);
            return "\n\n*" + "=".repeat(width - 2) + "*\n\n";
        default:
            return "\n\n\n\n";
    }
};

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await clearDB();
    output.value = "Đang xử lý dữ liệu sách...";

    try {
        const data = await parseEpubMobileV2(file, t);

        title = data.title;

        await saveMetadata({
            title: data.title,
            creator: data.creator,
            genre: data.genre,
            spineLength: data.spineLength,
            finalDescription: [
                data.description,
                data.comment,
                data.extraDescription,
            ]
                .filter(Boolean)
                .join("\n\n"),
        });

        const chapterBlocks = data.chaptersTxt
            .split("{{SPLITTER}}")
            .map((block) => block.trim())
            .filter(Boolean);

        for (let i = 0; i < chapterBlocks.length; i++) {
            const block = chapterBlocks[i];
            const lines = block.split("\n");
            const chapterTitle = lines[0]?.trim() || `${t("chapter")} ${i + 1}`;
            const chapterText = lines.slice(1).join("\n").trim();

            await saveChapter(i, chapterTitle, chapterText);
        }

        renderOutput();
        btn.style.display = "inline-block";
    } catch (err) {
        console.error("[MOBILE-V2-PARSE-ERROR]", err);
        output.value = "Không thể xử lý file EPUB";
    }
});

const renderOutput = async () => {
    const meta = await getMetadata();
    if (!meta) return;

    const splitter = getSplitter();

    let previewTxt =
        makeTitleBox(meta.title) +
        `${splitter}` +
        makeInfoBox(
            `${t("author")}: ${meta.creator} | ${t("genre")}: ${meta.genre} | ${t("chapter.count")}: ${meta.spineLength}\n\n${t("description")}:\n${meta.finalDescription}`,
        ) +
        `${splitter}`;

    const db = await initDB();
    const tx = db.transaction("chapters", "readonly");
    const store = tx.objectStore("chapters");

    let count = 0;
    const previewChapters = [];

    await new Promise((resolve) => {
        store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor && count < 10) {
                previewChapters.push(
                    `${cursor.value.title}\n${cursor.value.text}`,
                );
                count++;
                cursor.continue();
            } else {
                resolve();
            }
        };
    });

    if (previewChapters.length > 0) {
        previewTxt +=
            previewChapters.join(splitter) +
            splitter +
            `\n... [Còn tiếp - Nhấn nút Tải về để xuất toàn bộ file] ...`;
    }

    output.value = previewTxt;
};

splitterBox.addEventListener("change", renderOutput);
splitterLength.addEventListener("input", renderOutput);

const generateFileHeader = async (meta) => {
    const splitter = getSplitter();
    return (
        makeTitleBox(meta.title) +
        `${splitter}` +
        makeInfoBox(
            `${t("author")}: ${meta.creator} | ${t("genre")}: ${meta.genre} | ${t("chapter.count")}: ${meta.spineLength}\n\n${t("description")}:\n${meta.finalDescription}`,
        ) +
        `${splitter}`
    );
};

if (Filesystem !== null) {
    btn.addEventListener("click", async () => {
        if (!output.value) {
            alert("Không có nội dung để lưu!");
            return;
        }

        const meta = await getMetadata();
        if (!meta) return;

        const safeTitle = title
            ? title.replace(/[^a-zA-Z0-9À-ỹ ]/g, "")
            : "converted";
        const defaultFileName = `${safeTitle}.txt`;
        const splitter = getSplitter();

        try {
            const headerTxt = await generateFileHeader(meta);
            await Filesystem.writeFile({
                path: defaultFileName,
                data: headerTxt,
                directory: "Documents",
                encoding: "utf8",
            });

            const totalChapters = await getChaptersCount();
            const db = await initDB();
            const chunkSize = 100;

            for (
                let startId = 0;
                startId < totalChapters;
                startId += chunkSize
            ) {
                const endId = startId + chunkSize;

                const chunkTexts = await new Promise((resolve, reject) => {
                    const tx = db.transaction("chapters", "readonly");
                    const store = tx.objectStore("chapters");
                    const range = IDBKeyRange.bound(startId, endId - 1);
                    const req = store.getAll(range);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(tx.error);
                });

                if (chunkTexts.length > 0) {
                    const chunkMerged =
                        chunkTexts
                            .map((ch) => `${ch.title}\n${ch.text}`)
                            .join(splitter) + splitter;

                    await Filesystem.appendFile({
                        path: defaultFileName,
                        data: chunkMerged,
                        directory: "Documents",
                        encoding: "utf8",
                    });
                }
            }

            alert(
                `Đã lưu file thành công (Tối ưu hóa tránh OOM) vào:\nDocuments/${defaultFileName}`,
            );
        } catch (error) {
            console.error("Lỗi khi ghi file Capacitor:", error);
            alert("Lỗi bộ nhớ thiết bị hoặc phân quyền khi ghi file!");
        }
    });
} else {
    btn.addEventListener("click", async () => {
        try {
            if (!output.value) {
                alert("Không có nội dung để lưu!");
                return;
            }

            const meta = await getMetadata();
            if (!meta) return;

            const splitter = getSplitter();
            const headerTxt = await generateFileHeader(meta);

            const totalChapters = await getChaptersCount();
            const db = await initDB();
            const chunkSize = 100;

            const blobParts = [headerTxt];

            for (
                let startId = 0;
                startId < totalChapters;
                startId += chunkSize
            ) {
                const endId = startId + chunkSize;

                const chunkTexts = await new Promise((resolve, reject) => {
                    const tx = db.transaction("chapters", "readonly");
                    const store = tx.objectStore("chapters");
                    const range = IDBKeyRange.bound(startId, endId - 1);
                    const req = store.getAll(range);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(tx.error);
                });

                if (chunkTexts.length > 0) {
                    const chunkMerged =
                        chunkTexts
                            .map((ch) => `${ch.title}\n${ch.text}`)
                            .join(splitter) + splitter;
                    blobParts.push(chunkMerged);
                }
            }

            const blob = new Blob(blobParts, { type: "text/plain" });
            const a = document.createElement("a");
            const downloadUrl = URL.createObjectURL(blob);
            a.href = downloadUrl;

            const safeTitle = title
                ? title.replace(/[^a-zA-Z0-9À-ỹ ]/g, "")
                : "converted";
            a.download = `${safeTitle}.txt`;
            a.click();

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            console.log("[DEBUG][DOWNLOAD] success");
        } catch (err) {
            console.log("[DEBUG][DOWNLOAD-ERROR]", err);
        }
    });
}
