import {
    cleanBodyText,
    collectMetaText,
    getFirstHeading,
    selectChapterFiles,
} from "./epubChapterPipeline.js";

export const getDisplayWidth = (str = "") => {
    let width = 0;

    for (const ch of str) {
        const code = ch.codePointAt(0);

        if (
            (code >= 0x1100 && code <= 0x115f) ||
            (code >= 0x2e80 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe10 && code <= 0xfe6f) ||
            (code >= 0xff01 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6) ||
            (code >= 0x3000 && code <= 0x303f) ||
            (code >= 0x3040 && code <= 0x309f) ||
            (code >= 0x30a0 && code <= 0x30ff) ||
            (code >= 0x31f0 && code <= 0x31ff)
        ) {
            width += 2;
        } else {
            width += 1;
        }
    }

    return width;
};

export const padDisplayEnd = (str, targetWidth) => {
    const currentWidth = getDisplayWidth(str);
    if (currentWidth >= targetWidth) return str;
    return str + " ".repeat(targetWidth - currentWidth);
};

export const wrapDisplayText = (text, maxWidth = 80) => {
    const lines = [];

    for (const rawLine of text.split("\n")) {
        let current = "";
        let currentWidth = 0;

        for (const ch of rawLine) {
            const w = getDisplayWidth(ch);

            if (currentWidth + w > maxWidth) {
                lines.push(current);
                current = ch;
                currentWidth = w;
            } else {
                current += ch;
                currentWidth += w;
            }
        }

        lines.push(current);
    }

    return lines.join("\n");
};

export const makeTitleBox = (text) => {
    const middle = `|| ${text} ||`;
    const width = getDisplayWidth(middle);
    const line = "*" + "=".repeat(width - 2) + "*";
    return `${line}\n${middle}\n${line}`;
};

export const makeInfoBox = (text, maxBoxWidth = 80) => {
    const wrapped = wrapDisplayText(text, maxBoxWidth);
    const lines = wrapped.split("\n");
    const maxWidth = Math.max(...lines.map((l) => getDisplayWidth(l)));
    const border = "*" + "-".repeat(maxWidth) + "*";

    return (
        border +
        "\n" +
        lines.map((l) => `|${padDisplayEnd(l, maxWidth)}|`).join("\n") +
        "\n" +
        border
    );
};

const requestUserChoiceAsync = (filename, title) =>
    new Promise((resolve) => {
        setTimeout(() => {
            const choice = prompt(
                `Phát hiện FILE THỪA cấu trúc: "${filename}"\nTiêu đề: "${title}"\n\n` +
                    `Vui lòng nhập số để xử lý:\n` +
                    `1. Không render (Loại bỏ hoàn toàn)\n` +
                    `2. Render vào phần mô tả (<info>)`,
                "1",
            );
            resolve(choice || "1");
        }, 50);
    });

function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html;

    const blockTags = new Set([
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "div",
        "dl",
        "fieldset",
        "figcaption",
        "figure",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "li",
        "main",
        "nav",
        "ol",
        "p",
        "pre",
        "section",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    ]);

    const walk = (node, parts) => {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            if (text) parts.push(text);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        if (
            node.tagName &&
            ["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName)
        ) {
            return;
        }

        const tag = node.tagName?.toLowerCase();

        if (tag === "br") {
            parts.push("\n");
            return;
        }

        const children = [...node.childNodes];
        for (const child of children) {
            walk(child, parts);
        }

        if (tag && blockTags.has(tag)) {
            const last = parts[parts.length - 1] || "";
            if (last && !/\n$/.test(last)) {
                parts.push("\n");
            } else if (!last) {
                parts.push("\n");
            }
        }
    };

    const parts = [];
    walk(div, parts);

    return parts
        .join("")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n\s+\n/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n+$/g, "")
        .replace(/^\n+/g, "")
        .trim();
}

export async function parseEpubAdvancedMobile(file, JSZip, DOMParser, state) {
    const zip = await JSZip.loadAsync(file);
    const parser = new DOMParser();

    const loadCharacters = async () => {
        const allFiles = Object.keys(zip.files);
        const targetPaths = allFiles.filter((path) =>
            /(^|\/)(characters?|character)\.xhtml$/i.test(path),
        );

        if (!targetPaths.length) return [];

        const fileData = zip.file(targetPaths[0]);
        if (!fileData) return [];

        const html = await fileData.async("string");
        const doc = parser.parseFromString(html, "text/html");
        const pre = doc.querySelector("pre");

        let lines = pre
            ? pre.textContent.split("\n")
            : [...doc.querySelectorAll("li, p")].map((el) => el.textContent);

        return lines
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => l.replace(/^\d+\s*[\.\:\-]\s*/, ""));
    };

    const characters = await loadCharacters();
    state.characters = characters;

    const container = await zip.file("META-INF/container.xml")?.async("string");
    if (!container) throw new Error("OPF not found");

    const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
    const opfText = await zip.file(opfPath).async("string");
    const opfXml = parser.parseFromString(opfText, "application/xml");

    const basePath = opfPath.split("/").slice(0, -1).join("/");
    const title =
        opfXml.querySelector("title")?.textContent?.trim() || "no title";
    const creator =
        opfXml.querySelector("creator")?.textContent?.trim() || "no author";
    const genre = [...opfXml.querySelectorAll("subject, dc\\:subject")]
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(", ");
    const description = collectMetaText(opfXml, [
        "description",
        "dc\\:description",
        "meta[name='description']",
        "meta[name='comment']",
        "dc\\:comment",
    ]);

    const manifest = {};
    opfXml.querySelectorAll("manifest item").forEach((i) => {
        manifest[i.getAttribute("id")] = i.getAttribute("href");
    });

    const spine = [];
    opfXml.querySelectorAll("spine itemref").forEach((i) => {
        const id = i.getAttribute("idref");
        if (manifest[id]) spine.push(manifest[id]);
    });

    const spineFiles = [];
    for (let i = 0; i < spine.length; i++) {
        const fullPath = basePath ? `${basePath}/${spine[i]}` : spine[i];
        const fileData = zip.file(fullPath);
        if (!fileData) continue;

        const html = await fileData.async("string");
        const doc = parser.parseFromString(html, "text/html");

        const firstHeading = getFirstHeading(doc);
        const fileTitle =
            firstHeading?.textContent?.trim() || doc.title?.trim() || spine[i];
        const text = cleanBodyText(doc, fileTitle, stripHTML);

        spineFiles.push({
            index: i,
            fullPath,
            relativePath: spine[i],
            title: fileTitle,
            doc,
            text,
        });
    }

    const { validIndexes, extraFiles } = selectChapterFiles(spineFiles);

    let extraFilesInfo = "";
    for (const extraFile of extraFiles) {
        const isCharacterException = state.characterFiles?.some(
            (charPath) =>
                charPath === extraFile.fullPath ||
                charPath.endsWith(extraFile.relativePath),
        );

        if (isCharacterException) continue;

        const choice = await requestUserChoiceAsync(
            extraFile.relativePath,
            extraFile.title,
        );

        if (choice === "2") {
            extraFilesInfo += `--- File Th?a: ${extraFile.title || extraFile.relativePath} ---\n${extraFile.text}\n\n`;
        }
    }

    const validChapters = validIndexes
        .sort((a, b) => a - b)
        .map((i) => spineFiles[i])
        .map((f) => ({
            title: f.title,
            text: f.text,
        }));

    return {
        title,
        creator,
        genre,
        description,
        spine,
        characters,
        validChapters,
        extraFiles,
        extraFilesInfo,
    };
}

export async function parseEpubMobileV2(file, t) {
    const zip = await JSZip.loadAsync(file);
    const container = await zip.file("META-INF/container.xml").async("string");
    const opfPathMatch = container.match(/full-path="([^"]+)"/);
    if (!opfPathMatch) {
        throw new Error("OPF not found");
    }

    const opfPath = opfPathMatch[1];
    const basePath = opfPath.split("/").slice(0, -1).join("/");
    const opfText = await zip.file(opfPath).async("string");
    const parser = new DOMParser();
    const opfXml = parser.parseFromString(opfText, "application/xml");

    const title =
        opfXml.querySelector("title")?.textContent || t("book.no_title");
    const creator =
        opfXml.querySelector("creator")?.textContent || t("book.no_author");

    const getMetaContent = (xml, selector) => collectMetaText(xml, selector);

    const description =
        getMetaContent(opfXml, "description") ||
        getMetaContent(opfXml, "dc\\:description") ||
        getMetaContent(opfXml, "meta[name='description']");
    const comment =
        getMetaContent(opfXml, "meta[name='comment']") ||
        getMetaContent(opfXml, "dc\\:comment");

    const genre = [...opfXml.querySelectorAll("subject, dc\\:subject")]
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join(", ");

    const manifestItems = {};
    opfXml.querySelectorAll("manifest item").forEach((item) => {
        manifestItems[item.getAttribute("id")] = item.getAttribute("href");
    });

    const spine = [];
    opfXml.querySelectorAll("spine itemref").forEach((item) => {
        const idref = item.getAttribute("idref");
        if (manifestItems[idref]) spine.push(manifestItems[idref]);
    });

    const spineFiles = [];
    for (let i = 0; i < spine.length; i++) {
        const filePath = basePath ? `${basePath}/${spine[i]}` : spine[i];
        const fileObj = zip.file(filePath);
        if (!fileObj) continue;

        const html = await fileObj.async("string");
        const doc = parser.parseFromString(html, "text/html");

        const headings = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")]
            .map((el) => el.textContent?.trim())
            .filter(Boolean);
        const chapterTitle =
            headings.find((t) => t.length < 120) ||
            doc.title?.trim() ||
            `${t("chapter")} ${i + 1}`;

        const text = cleanBodyText(doc, chapterTitle, stripHTML);

        spineFiles.push({
            index: i,
            fullPath: filePath,
            relativePath: spine[i],
            title: chapterTitle,
            doc,
            text,
        });
    }

    const { validIndexes, descriptionIndexes } = selectChapterFiles(spineFiles);
    const extraDescription = spineFiles
        .filter((file) => descriptionIndexes.has(file.index))
        .map((file) => file.text)
        .join("\n\n");

    let chaptersTxt = "";
    validIndexes
        .sort((a, b) => a - b)
        .map((index) => spineFiles[index])
        .forEach((file) => {
            chaptersTxt += `${file.title}\n${file.text}\n{{SPLITTER}}`;
        });

    return {
        title,
        creator,
        genre,
        description,
        comment,
        extraDescription,
        spineLength: spine.length,
        chaptersTxt,
    };
}
