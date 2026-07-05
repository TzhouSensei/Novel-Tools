import { parseEpubAdvancedMobile } from "../../parser/epubParserMobile.js";

const fileInput = document.getElementById("file");
const output = document.getElementById("output");
const btn = document.getElementById("download");

let Filesystem = null;
try {
    Filesystem = Capacitor.Plugins.Filesystem;
} catch {
    console.log("Không có Capacitor");
}

let state = {
    characters: [],
    characterFiles: [],
};

let finalTxt = "";

let renderMode = {
    open: "{",
    close: "}",
};

const delimiterModes = [
    { name: "{}", open: "{", close: "}" },
    { name: "⟨⟩", open: "⟨", close: "⟩" },
    { name: "⟦⟧", open: "⟦", close: "⟧" },
    { name: "⟪⟫", open: "⟪", close: "⟫" },
    { name: "⟬⟭", open: "⟬", close: "⟭" },
    { name: "⌈⌋", open: "⌈", close: "⌋" },
    { name: "⌊⌉", open: "⌊", close: "⌉" },
    { name: "⌜⌟", open: "⌜", close: "⌟" },
    { name: "⌞⌝", open: "⌞", close: "⌝" },
];

const modeContainer = document.createElement("div");
modeContainer.style.margin = "10px 0";

let cachedData = {
    title: "",
    creator: "",
    genre: "",
    spine: [],
    finalDescription: "",
    validChapters: [],
    extraFilesInfo: "",
    renderMode,
};

const render = (characters = []) => {
    let result = "";

    result += `<>
${cachedData.title}
</>

`;

    result += `<info>
`;
    result += `Author: ${cachedData.creator}
`;
    result += `Genre: ${cachedData.genre}
`;
    result += `Chapters: ${cachedData.validChapters.length}
`;
    result += `${cachedData.finalDescription}
`;
    if (cachedData.extraFilesInfo) {
        result += `\n[File Thừa Được Chỉ Định]:\n${cachedData.extraFilesInfo}`;
    }
    result += `</info>\n\n`;

    result += `[\n`;
    if (characters && characters.length) {
        characters.forEach((c) => {
            result += `- ${c}\n`;
        });
    }
    result += `]\n\n`;

    result += `<list>\n`;

    const previewLimit = Math.min(3, cachedData.validChapters.length);
    for (let i = 0; i < previewLimit; i++) {
        const ch = cachedData.validChapters[i];
        result += `${ch.title} ${renderMode.open}\n`;
        result += `•\n ${ch.text.trim()}\n`;
        result += `• ${renderMode.close}\n\n`;
    }

    if (cachedData.validChapters.length > previewLimit) {
        result += `... [Còn tiếp ${cachedData.validChapters.length - previewLimit} chương - Nhấn nút Download để xuất toàn bộ file] ...\n`;
    }

    result += `</list>`;
    return result;
};

const makeFileHeaderText = (characters = []) => {
    let result = "";
    result += `<>
${cachedData.title}
</>

`;
    result += `<info>
`;
    result += `Author: ${cachedData.creator}
`;
    result += `Genre: ${cachedData.genre}
`;
    result += `Chapters: ${cachedData.validChapters.length}
`;
    result += `${cachedData.finalDescription}
`;
    if (cachedData.extraFilesInfo) {
        result += `\n[File Thừa Được Chỉ Định]:\n${cachedData.extraFilesInfo}`;
    }
    result += `</info>\n\n`;

    result += `[\n`;
    if (characters && characters.length) {
        characters.forEach((c) => {
            result += `- ${c}\n`;
        });
    }
    result += `]\n\n`;
    result += `<list>\n`;
    return result;
};

document.body.insertBefore(modeContainer, fileInput);
renderModeUI();

function renderModeUI() {
    modeContainer.innerHTML = "";
    delimiterModes.forEach((mode, idx) => {
        const label = document.createElement("label");
        label.style.marginRight = "10px";
        label.style.cursor = "pointer";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "chapterMode";
        radio.value = idx;

        if (mode.open === renderMode.open && mode.close === renderMode.close) {
            radio.checked = true;
        }

        radio.addEventListener("change", () => {
            renderMode.open = mode.open;
            renderMode.close = mode.close;

            if (window.__lastRender) {
                output.value = render(state.characters);
            }
        });

        label.appendChild(radio);
        label.appendChild(document.createTextNode(" " + mode.name));
        modeContainer.appendChild(label);
    });
}

fileInput.addEventListener("change", async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const data = await parseEpubAdvancedMobile(
            file,
            JSZip,
            DOMParser,
            state,
        );
        cachedData = {
            title: data.title,
            creator: data.creator,
            genre: data.genre,
            spine: data.spine,
            finalDescription: data.description,
            validChapters: data.validChapters,
            extraFilesInfo: data.extraFilesInfo || "",
        };

        window.__lastRender = true;
        output.value = render(state.characters);
        btn.style.display = "inline-block";
    } catch (err) {
        console.error("[MOBILE-ADVANCED-ERROR]", err);
        output.value = "Không thể xử lý file EPUB";
    }
});

btn.addEventListener("click", async () => {
    if (!cachedData.title) {
        alert("Không có nội dung dữ liệu hợp lệ để xuất!");
        return;
    }

    const safeTitle = cachedData.title
        ? cachedData.title.replace(/[^a-zA-Z0-9À-ỹ ]/g, "")
        : "converted";
    const defaultFileName = `${safeTitle}.txt`;

    if (Filesystem !== null) {
        try {
            output.value =
                "Đang xuất file xử lý chuyên sâu cho thiết bị di động...";

            const headerTxt = makeFileHeaderText(state.characters);
            await Filesystem.writeFile({
                path: defaultFileName,
                data: headerTxt,
                directory: "Documents",
                encoding: "utf8",
            });

            const chunkSize = 50;
            const totalChapters = cachedData.validChapters.length;

            for (let i = 0; i < totalChapters; i += chunkSize) {
                let chunkMerged = "";
                const currentChunkEnd = Math.min(i + chunkSize, totalChapters);

                for (let j = i; j < currentChunkEnd; j++) {
                    const ch = cachedData.validChapters[j];
                    chunkMerged += `${ch.title} ${renderMode.open}\n`;
                    chunkMerged += `•\n ${ch.text.trim()}\n`;
                    chunkMerged += `• ${renderMode.close}\n\n`;
                }

                await Filesystem.appendFile({
                    path: defaultFileName,
                    data: chunkMerged,
                    directory: "Documents",
                    encoding: "utf8",
                });
            }

            await Filesystem.appendFile({
                path: defaultFileName,
                data: `</list>`,
                directory: "Documents",
                encoding: "utf8",
            });

            output.value = render(state.characters);
            alert(
                `Đã xuất file an toàn thành công vào mục:\nDocuments/${defaultFileName}`,
            );
        } catch (err) {
            console.log("[CAPACITOR-WRITE-ERROR]", err);
            alert(
                "Sập quy trình ghi file Native. Vui lòng kiểm tra quyền truy cập ổ đĩa.",
            );
        }
    } else {
        try {
            const blobParts = [];
            blobParts.push(makeFileHeaderText(state.characters));

            cachedData.validChapters.forEach((ch) => {
                let chunk = `${ch.title} ${renderMode.open}\n`;
                chunk += `•\n ${ch.text.trim()}\n`;
                chunk += `• ${renderMode.close}\n\n`;
                blobParts.push(chunk);
            });

            blobParts.push(`</list>`);

            const blob = new Blob(blobParts, { type: "text/plain" });
            const a = document.createElement("a");
            const downloadUrl = URL.createObjectURL(blob);
            a.href = downloadUrl;
            a.download = defaultFileName;
            a.click();

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
        } catch (err) {
            console.log("[DEBUG][WEB-DOWNLOAD-ERROR]", err);
        }
    }
});
