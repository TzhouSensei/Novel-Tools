import { STORY_DATA } from "./editor-main.js";
let Filesystem = null;
try {
    Filesystem = Capacitor.Plugins.Filesystem;
} catch {
    console.log("Không có Capacitor");
}
export async function exportEPUB() {
    const zip = new JSZip();

    const folderName =
        (STORY_DATA.title || "story").replace(/[<>:"/\\|?*]/g, "").trim() ||
        "story";

    STORY_DATA.chapters.forEach((ch, i) => {
        zip.file(
            `chap${i}.xhtml`,
            `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${escapeHTML(ch.title)}</title>
</head>
<body>

<h1>${escapeHTML(ch.title)}</h1>

<pre>${escapeHTML(cleanChapterBody(ch.body))}</pre>

</body>
</html>`,
        );
    });

    const blob = await zip.generateAsync({ type: "blob" });

    if (Filesystem) {
        const buffer = await blob.arrayBuffer();

        let binary = "";
        const bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        await Filesystem.writeFile({
            path: `${folderName}.zip`,
            data: btoa(binary),
            directory: "DOCUMENTS",
        });

        alert("Đã lưu file ZIP");
    } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${folderName}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
}
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
function createI18nSnapshot() {
    const snap = { ...translations };

    return (key, fallback = key) => snap[key] ?? fallback;
}
