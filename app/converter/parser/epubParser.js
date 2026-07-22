import {
    cleanBodyText,
    collectMetaText,
    getFirstHeading,
    selectChapterFiles,
} from "./epubChapterPipeline.js";

export const fileLog = (tag, msg) => console.log(`[DEBUG][${tag}]`, msg);

export async function parseEpubAdvanced(file, JSZip, DOMParser, state) {
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
    };
}

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

export const stripHTML = (html) => {
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
};

export const isFakeChapter = (text, title, doc) => {
    if (!text || text.length < 200) return true;

    const normalized = text.toLowerCase();
    const tocSignals = ["table of contents", "mục lục", "contents"];
    const tocHits = tocSignals.filter((s) => normalized.includes(s)).length;

    if (tocHits >= 2 && text.length < 3000) return true;

    const linkCount = doc.querySelectorAll("a").length;
    if (linkCount > 10) return true;

    const linkRatio = linkCount / (text.length || 1);
    if (linkRatio > 0.02) return true;

    return false;
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

export const parseEpub = async (file, t) => {
    const zip = await JSZip.loadAsync(file);
    const container = await zip.file("META-INF/container.xml").async("string");

    const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
    if (!opfPath) throw new Error("OPF not found");

    const opfText = await zip.file(opfPath).async("string");
    const parser = new DOMParser();
    const opfXml = parser.parseFromString(opfText, "application/xml");

    const title =
        opfXml.querySelector("title")?.textContent || t("book.no_title");

    const creator =
        opfXml.querySelector("creator")?.textContent || t("book.no_author");

    const description = collectMetaText(opfXml, [
        "description",
        "dc\\:description",
        "meta[name='description']",
        "meta[name='comment']",
        "dc\\:comment",
    ]);

    const comment = collectMetaText(opfXml, [
        "meta[name='comment']",
        "dc\\:comment",
    ]);

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

    const basePath = opfPath.split("/").slice(0, -1).join("/");
    const spineFiles = [];

    for (let i = 0; i < spine.length; i++) {
        const filePath = basePath ? `${basePath}/${spine[i]}` : spine[i];
        const file = zip.file(filePath);
        if (!file) continue;

        const html = await file.async("string");
        const doc = parser.parseFromString(html, "text/html");

        const firstHeading = getFirstHeading(doc);
        const chapterTitle =
            firstHeading?.textContent?.trim() ||
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
};
