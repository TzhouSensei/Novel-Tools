let zipData = null;
let config = null;
let parsedChapters = [];
let parsedAppendixTree = null;
let parsedAppendixEntries = [];
let detectedImages = [];
let finalEpubBlob = null;

document.addEventListener("DOMContentLoaded", () => {
    const zipInput = document.getElementById("zipInput");
    const selectZipBtn = document.getElementById("selectZipBtn");
    const generateBtn = document.getElementById("generateBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    selectZipBtn.addEventListener("click", () => zipInput.click());
    generateBtn.addEventListener("click", generateEpub);
    downloadBtn.addEventListener("click", downloadEpub);

    zipInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            log(`Đang tải file: ${file.name}`);
            updateProgress(10, "Đang giải nén tập tin ZIP...");
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            zipData = zip;

            const configFile = zip.file("configuration.json");
            if (!configFile) {
                throw new Error(
                    "Không tìm thấy file configuration.json trong ZIP!",
                );
            }

            const configText = await configFile.async("string");
            config = JSON.parse(configText);
            log("Đã load configuration thành công.");

            await processConfiguration(config);

            generateBtn.disabled = false;
            updateProgress(100, "Nạp dữ liệu thành công! Sẵn sàng tạo EPUB.");
        } catch (err) {
            log(`Lỗi: ${err.message}`);
            updateProgress(0, "Có lỗi xảy ra.");
        }
    });
    const temporaryZip =
        window.parent !== window && window.parent.creatorParserZipUrl
            ? window.parent.creatorParserZipUrl
            : sessionStorage.getItem("creatorParserZip");
    if (temporaryZip) {
        sessionStorage.removeItem("creatorParserZip");
        if (window.parent !== window) {
            window.parent.creatorParserZipUrl = null;
        }
        injectZipIntoInput(zipInput, temporaryZip).catch((err) => {
            log(`Lỗi: ${err.message}`);
            updateProgress(0, "Có lỗi xảy ra.");
        });
    }
});

async function injectZipIntoInput(
    zipInput,
    source,
    fileName = "ebook_package.zip",
) {
    const blob =
        typeof source === "string"
            ? await fetch(source).then((response) => {
                  if (!response.ok)
                      throw new Error("Không thể đọc file ZIP tạm từ creator");
                  return response.blob();
              })
            : source;
    if (typeof source === "string") {
        URL.revokeObjectURL(source);
    }
    const file = new File([blob], fileName, { type: "application/zip" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    zipInput.files = dataTransfer.files;
    zipInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function log(msg) {
    const logBox = document.getElementById("logBox");
    if (logBox) {
        logBox.textContent += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function updateProgress(percent, statusMsg) {
    const bar = document.getElementById("progressBar");
    if (bar) {
        bar.style.width = `${percent}%`;
        bar.textContent = `${percent}%`;
    }
    if (statusMsg) {
        const txt = document.getElementById("statusText");
        if (txt) txt.textContent = statusMsg;
    }
}

function getMimeType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
    };
    return map[ext] || "application/octet-stream";
}

function parseDesc(descObj) {
    if (!descObj) return "";
    let lines = [];
    const sortedKeys = Object.keys(descObj)
        .filter((k) => k !== "comment")
        .sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, "")) || 0;
            const numB = parseInt(b.replace(/\D/g, "")) || 0;
            return numA - numB;
        });
    sortedKeys.forEach((key) => {
        lines.push(descObj[key]);
    });
    return lines.join("\n");
}

function resolveRelativePath(basePath, relativePath) {
    if (relativePath.startsWith("/")) return relativePath.substring(1);

    let baseParts = basePath.split("/");
    baseParts.pop();

    let relParts = relativePath.split("/");
    for (let part of relParts) {
        if (part === "." || part === "") {
            continue;
        } else if (part === "..") {
            if (baseParts.length > 0) baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }
    return baseParts.join("/");
}

function isTocNameValid(tocNames) {
    if (!tocNames) return false;
    const keys = Object.keys(tocNames).filter((k) => k !== "comment");
    return keys.length > 0;
}

function hasNoLineBreaks(text) {
    if (!text) return false;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const normalized = tempDiv.textContent
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n");

    return !normalized.includes("\n");
}

function getParentTagName(parentTag) {
    if (parentTag === undefined || parentTag === null) return "p";
    const normalized = String(parentTag).trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "none") return "";
    if (/^h[1-6]$/.test(normalized)) return normalized;
    return normalized;
}

function isAlreadyWrapped(node, parentTag, childTag) {
    if (!node || !childTag) return false;
    const kids = Array.from(node.children);
    if (kids.length === 0) return false;

    let parentEl = null;
    if (parentTag) {
        if (node.tagName.toLowerCase() === parentTag) {
            parentEl = node;
        } else if (
            kids.length === 1 &&
            kids[0].tagName.toLowerCase() === parentTag
        ) {
            parentEl = kids[0];
        }
    } else {
        if (kids.length === 1) {
            parentEl = kids[0];
        }
    }
    if (!parentEl) return false;

    const parentKids = Array.from(parentEl.children);
    return (
        parentKids.length > 0 &&
        parentKids.every((k) => k.tagName.toLowerCase() === childTag)
    );
}

function extractPlainLines(htmlStr) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlStr;
    let container = tempDiv;

    let innerHtml = container.innerHTML;
    innerHtml = innerHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(
            /<\/(?:p|div|pre|h[1-6]|blockquote|section|article|li)>/gi,
            "\n",
        )
        .replace(/<[^>]+>/g, "");

    return innerHtml
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function groupSentencesForBr(lines, parsingType) {
    const grouped = [];
    const isBrSingle = parsingType === "br-single";

    if (isBrSingle) {
        let currentGroup = "";
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
                        if (joined.trim())
                            grouped.push({
                                type: "br",
                                content: joined.trim(),
                            });
                        buffer = [];
                    }
                    grouped.push({ type: "br", content: sentence });
                } else {
                    buffer.push(sentence);
                    if (buffer.length >= 2) {
                        const joined = buffer.join(" ");
                        const total = buffer
                            .map((s) => s.length)
                            .reduce((a, b) => a + b, 0);
                        if (total <= 20 || buffer.length === 2) {
                            grouped.push({
                                type: "br",
                                content: joined.trim(),
                            });
                            buffer = [];
                        }
                    }
                }
            });

            if (buffer.length > 0) {
                const joined = buffer.join(" ");
                if (joined.trim())
                    grouped.push({ type: "br", content: joined.trim() });
            }
        });
    } else {
        lines.forEach((line) => {
            grouped.push({ type: "br", content: line.trim() });
        });
    }

    return grouped;
}

function applyParsing(rawHtml, parseConfig = {}) {
    const parsingType = parseConfig.parsing_type || "single";

    const parentRaw = parseConfig.parent_tag;
    const parentIsNone =
        parentRaw !== undefined && parentRaw !== null
            ? String(parentRaw).trim().toLowerCase() === "none"
            : false;
    const parentTag = parentIsNone ? "" : getParentTagName(parentRaw) || "div";
    const childTag = getParentTagName(parseConfig.child_tag) || "p";

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const scripts = doc.querySelectorAll("script");
    scripts.forEach((el) => el.remove());
    const buttons = doc.querySelectorAll("button");
    buttons.forEach((el) => el.remove());

    let bestNode = doc.body;
    let maxLen = 0;

    function walk(node) {
        if (!node) return;
        if (
            ["SCRIPT", "STYLE", "BUTTON", "NOSCRIPT", "NAV"].includes(
                node.tagName,
            )
        )
            return;

        const totalLen = node.textContent ? node.textContent.trim().length : 0;
        if (totalLen > maxLen) {
            maxLen = totalLen;
            bestNode = node;
        }

        for (let i = 0; i < node.children.length; i++) {
            walk(node.children[i]);
        }
    }

    walk(doc.body);

    const headingRegex = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi;
    let titleHtml = "";
    let bodyHtml = bestNode.innerHTML;
    const allHeadings = bodyHtml.match(headingRegex) || [];
    if (allHeadings.length > 0) {
        titleHtml = allHeadings[0];
        bodyHtml = bodyHtml.replace(headingRegex, "");
    }

    const noLineBreaks = hasNoLineBreaks(bodyHtml);

    let finalBody = "";

    if (parsingType === "single" || parsingType === "br-single") {
        let contentLines = [];

        if (parsingType === "br-single" && noLineBreaks) {
            const rawLines = extractPlainLines(bodyHtml);
            const groups = groupSentencesForBr(rawLines, "br-single");
            contentLines = groups.map((g) => escapeText(g.content));
        } else {
            const rawLines = extractPlainLines(bodyHtml);
            contentLines = rawLines.map((line) => escapeText(line));
        }

        const inner =
            parsingType === "br-single"
                ? contentLines.join("<br/>\n")
                : contentLines.join("\n");

        if (parentTag) {
            finalBody = `<${parentTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">\n${inner}\n</${parentTag}>`;
        } else {
            finalBody = inner;
        }
    } else if (parsingType === "multiple" || parsingType === "br-multiple") {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = bodyHtml;
        const alreadyWrapped = isAlreadyWrapped(tempDiv, parentTag, childTag);

        if (alreadyWrapped) {
            finalBody = tempDiv.innerHTML;
        } else {
            const lines = extractPlainLines(bodyHtml);
            let children = "";

            if (parsingType === "br-multiple") {
                const groups = groupSentencesForBr(lines, "br-multiple");
                children = groups
                    .map(
                        (g) =>
                            `<${childTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(g.content)}</${childTag}>`,
                    )
                    .join("<br/>");
            } else {
                children = lines
                    .map(
                        (line) =>
                            `<${childTag} style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${escapeText(line)}</${childTag}>`,
                    )
                    .join("");
            }

            if (parentTag) {
                finalBody = `<${parentTag}>${children}</${parentTag}>`;
            } else {
                finalBody = children;
            }
        }
    }

    if (titleHtml) {
        finalBody = titleHtml + "\n" + finalBody;
    }

    return finalBody;
}

function escapeText(text) {
    const A = () => String.fromCharCode(38);
    return String(text)
        .replace(/&/g, () => A() + "amp;")
        .replace(/</g, () => A() + "lt;")
        .replace(/>/g, () => A() + "gt;")
        .replace(/"/g, () => A() + "quot;");
}

function cleanAndOptimizeHtml(rawHtml, title, lang = "vi", parseConfig = null) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const scripts = doc.querySelectorAll("script");
    scripts.forEach((el) => el.remove());
    const buttons = doc.querySelectorAll("button");
    buttons.forEach((el) => el.remove());

    let bestNode = doc.body;
    let maxLen = 0;

    function walk(node) {
        if (!node) return;
        if (
            ["SCRIPT", "STYLE", "BUTTON", "NOSCRIPT", "NAV"].includes(
                node.tagName,
            )
        )
            return;

        const totalLen = node.textContent ? node.textContent.trim().length : 0;
        if (totalLen > maxLen) {
            maxLen = totalLen;
            bestNode = node;
        }

        for (let i = 0; i < node.children.length; i++) {
            walk(node.children[i]);
        }
    }

    walk(doc.body);

    let finalBodyContent = "";

    if (parseConfig && (parseConfig.parsing_type || "").trim() !== "") {
        finalBodyContent = applyParsing(rawHtml, parseConfig);
    } else {
        const hasBlockElements = !!bestNode.querySelector(
            "p, div, pre, li, table, h1, h2, h3, h4, h5, h6",
        );

        if (!hasBlockElements) {
            let htmlStr = bestNode.innerHTML;
            if (htmlStr.includes("<br") || htmlStr.includes("<BR")) {
                finalBodyContent = htmlStr
                    .split(/<br\s*\/?>/i)
                    .map(
                        (line) =>
                            `<p style="text-indent: 2em; margin: 0.5em 0;">${line.trim()}</p>`,
                    )
                    .join("");
            } else {
                finalBodyContent = bestNode.textContent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .map(
                        (line) =>
                            `<p style="text-indent: 2em; margin: 0.5em 0;">${line}</p>`,
                    )
                    .join("");
            }
        } else {
            const inlineHybridRegex =
                /((?:<[a-z0-9]+[^>]*>.*?<\/[a-z0-9]+>\s*)+)(<br\s*\/?>|$)/gi;

            if (
                !hasBlockElements &&
                inlineHybridRegex.test(bestNode.innerHTML)
            ) {
                let innerContent = bestNode.innerHTML;
                let blocks = innerContent.split(/<br\s*\/?>/i);
                let processedLines = [];

                blocks.forEach((block) => {
                    let tempDiv = document.createElement("div");
                    tempDiv.innerHTML = block;
                    let text = tempDiv.textContent.trim();
                    if (!text) return;

                    const hasPunctuation = /[.\s?!;"）»』」。！？…]$/g.test(
                        text,
                    );

                    if (!hasPunctuation) {
                        processedLines.push(
                            `<p style="text-indent: 2em; margin: 0.5em 0;">${text}</p>`,
                        );
                    } else {
                        let sentences = text.match(
                            /[^.!?。！？]+[.!?。！？]*/g,
                        ) || [text];
                        let currentPair = [];

                        for (let i = 0; i < sentences.length; i++) {
                            currentPair.push(sentences[i].trim());
                            if (
                                currentPair.length === 2 ||
                                i === sentences.length - 1
                            ) {
                                processedLines.push(
                                    `<p style="text-indent: 2em; margin: 0.5em 0;">${currentPair.join(" ")}</p>`,
                                );
                                currentPair = [];
                            }
                        }
                    }
                });
                finalBodyContent = processedLines.join("");
            } else {
                finalBodyContent = bestNode.innerHTML;
            }
        }
    }

    const xhtmlResult = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>${title}</title>
    <meta charset="utf-8" />
</head>
<body>
        ${finalBodyContent}
</body>
</html>`;

    return xhtmlResult;
}

const appendixTypeKeys = [
    "item",
    "itemset",
    "character",
    "faction",
    "realms",
    "abilities",
    "skillset",
    "definition",
    "relations",
    "timeline",
    "systems",
];

const appendixDefaultPaths = {
    item: "appendix/item",
    itemset: "appendix/itemset",
    character: "appendix/character",
    faction: "appendix/faction",
    realms: "appendix/realms",
    abilities: "appendix/abilities",
    skillset: "appendix/skillset",
    definition: "appendix/definition",
    relations: "appendix/relations",
    timeline: "appendix/timeline",
    systems: "appendix/systems",
};

function appendixFlag(value) {
    return value === true || String(value) === "true";
}

function appendixFileOrder(path) {
    const match = path.split("/").pop().match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
}

async function relocateAppendixFile(zip, location, folder, content) {
    const target = `${folder}/${location.split("/").pop()}`;
    const copyQueue = [];
    const rewritten = content.replace(
        /(<(?:img|image)\b[^>]*?\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
        (full, attr, quote, ref) => {
            const resolved = resolveRelativePath(location, ref);
            if (!zip.file(resolved) || resolved === target) return full;
            const imgBase = resolved.split("/").pop();
            const imgTarget = `${folder}/${imgBase}`;
            if (imgTarget !== resolved && !zip.file(imgTarget)) {
                copyQueue.push([imgTarget, resolved]);
            }
            return `${attr}${quote}${imgBase}${quote}`;
        },
    );
    for (const [imgTarget, resolved] of copyQueue) {
        zip.file(imgTarget, await zip.file(resolved).async("uint8array"));
    }
    zip.file(target, rewritten);
    return target;
}

const APPENDIX_TOC_ID = "appendix_toc";
const APPENDIX_TOC_HREF = "appendix-toc.xhtml";
const APPENDIX_ROOT_TITLE = "Phụ lục";

function appendixLocalizedTitle(key, fallback) {
    return typeof t === "function" ? t(key, fallback) : fallback;
}

function getHtmlTitle(htmlStr, fallback) {
    const match = htmlStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match && match[1] ? match[1].trim() : fallback;
}

function buildAppendixResourceIndex(cfg) {
    const appendixCfg = cfg.appendix || {};
    const customAppendix = (cfg.custom_toc && cfg.custom_toc.appendix) || {};
    const folders = new Set();
    const listed = new Set();
    for (const type of appendixTypeKeys) {
        const folder = appendixCfg.path?.[type] || appendixDefaultPaths[type];
        if (folder) {
            folders.add(String(folder).replace(/\/+$/, "").toLowerCase());
        }
        const listedMap = customAppendix[`${type}appendix`];
        if (listedMap && typeof listedMap === "object") {
            Object.keys(listedMap).forEach((k) => {
                if (k !== "comment" && listedMap[k]) {
                    listed.add(String(listedMap[k]).replace(/\\/g, "/"));
                }
            });
        }
    }
    return { folders, listed };
}

function isAppendixResource(index, path) {
    const normalized = String(path).replace(/\\/g, "/");
    if (index.listed.has(normalized)) return true;
    const lower = normalized.toLowerCase();
    for (const folder of index.folders) {
        if (lower === folder || lower.startsWith(`${folder}/`)) return true;
    }
    return false;
}

function getRelativeHrefBetween(fromHref, toHref) {
    const fromDir = String(fromHref).split("/").slice(0, -1);
    const toParts = String(toHref).split("/");
    let shared = 0;
    while (
        shared < fromDir.length &&
        shared < toParts.length - 1 &&
        fromDir[shared] === toParts[shared]
    ) {
        shared += 1;
    }
    const ups = fromDir.slice(shared).map(() => "..");
    const rel = [...ups, ...toParts.slice(shared)].join("/");
    return rel || toHref;
}

function sanitizeAppendixFileSegment(value, fallback) {
    const cleaned = String(value || "")
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || fallback;
}

function assignAppendixSectionHref(folder, type, takenPaths) {
    const normalized = String(folder).replace(/\\/g, "/").replace(/\/+$/, "");
    const dir = normalized.includes("/")
        ? `${normalized.slice(0, normalized.lastIndexOf("/"))}/`
        : "";
    const base = sanitizeAppendixFileSegment(normalized.split("/").pop(), type);
    let href = `${dir}${base}-toc.xhtml`;
    let counter = 2;
    const exists = (p) =>
        takenPaths.has(p) || (zipData.files[p] && !zipData.files[p].dir);
    while (exists(href)) {
        href = `${dir}${base}-toc-${counter}.xhtml`;
        counter += 1;
    }
    takenPaths.add(href);
    return href;
}

function buildAppendixSectionTocXhtml(section, lang, rootTitle) {
    const entryLis = section.children
        .map((entry) => {
            const entryHref = getRelativeHrefBetween(section.href, entry.href);
            return `                <li style="margin: 0.5em 0;"><a href="${entryHref}" style="text-decoration: none; color: #0066cc;">${entry.title}</a></li>`;
        })
        .join("\n");
    const backHref = getRelativeHrefBetween(section.href, APPENDIX_TOC_HREF);
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>${section.title}</title>
    <meta charset="utf-8" />
</head>
<body>
    <section style="padding: 1em;">
        <h2 style="color: #bf0000; border-bottom: 2px solid #bf0000; padding-bottom: 0.3em;">${section.title}</h2>
        <div style="margin-top: 1em; padding-left: 10px;">
            <p><a href="${backHref}" style="color: #666; font-size: 0.9em; text-decoration: none;">← ${rootTitle}</a></p>
            <ol style="list-style-type: none; padding-left: 0;">
${entryLis}
            </ol>
        </div>
    </section>
</body>
</html>`;
}

async function buildAppendixSectionFromStructure(sec, cfg, lang, parseConfig) {
    const appendixCfg = cfg.appendix || {};
    const customAppendix = (cfg.custom_toc && cfg.custom_toc.appendix) || {};
    const customTocOn = appendixFlag(cfg.custom_toc?.enabled);
    if (appendixCfg.render?.[sec.type] === false) return null;
    const folder =
        sec.folder ||
        appendixCfg.path?.[sec.type] ||
        appendixDefaultPaths[sec.type];
    const tocName =
        (customTocOn && customAppendix[sec.type]) ||
        sec.title ||
        appendixLocalizedTitle(`epub.appendix_${sec.type}`, sec.type);
    const indexSource = sec.index_href ? zipData.file(sec.index_href) : null;
    if (!indexSource) return null;
    const section = {
        type: "appendix-section",
        appendixType: sec.type,
        id: `appendix_${sec.type}_toc`,
        title: tocName,
        href: sec.index_href,
        folder: folder,
        children: [],
    };
    section.content = await indexSource.async("string");
    let sIdx = 0;
    for (const child of sec.children || []) {
        if (!child || !child.href) continue;
        const pageSource = zipData.file(child.href);
        if (!pageSource) continue;
        sIdx += 1;
        const raw = await pageSource.async("string");
        if (child.kind === "group" && Array.isArray(child.children)) {
            const group = {
                type: "appendix-group",
                appendixType: sec.type,
                id: `appendix_${sec.type}_g${sIdx}`,
                title: child.title || getHtmlTitle(raw, tocName),
                href: child.href,
                folder: folder,
                content: raw,
                children: [],
            };
            let eIdx = 0;
            for (const ent of child.children) {
                if (!ent || !ent.href) continue;
                const entSource = zipData.file(ent.href);
                if (!entSource) continue;
                eIdx += 1;
                const entRaw = await entSource.async("string");
                const entTitle = ent.title || getHtmlTitle(entRaw, group.title);
                const optimized = cleanAndOptimizeHtml(
                    entRaw,
                    entTitle,
                    lang,
                    parseConfig,
                );
                group.children.push({
                    type: "appendix-entry",
                    id: `appendix_${sec.type}_g${sIdx}_e${eIdx}`,
                    title: entTitle,
                    href: ent.href,
                    content: optimized,
                });
            }
            if (group.children.length > 0) section.children.push(group);
        } else {
            const title = child.title || getHtmlTitle(raw, tocName);
            const optimized = cleanAndOptimizeHtml(raw, title, lang, parseConfig);
            section.children.push({
                type: "appendix-entry",
                id: `appendix_${sec.type}_${sIdx}`,
                title: title,
                href: child.href,
                content: optimized,
            });
        }
    }
    return section.children.length > 0 ? section : null;
}

async function buildAppendixTree(cfg, lang) {
    const appendixCfg = cfg.appendix || {};
    const customAppendix = (cfg.custom_toc && cfg.custom_toc.appendix) || {};
    const customTocOn = appendixFlag(cfg.custom_toc?.enabled);
    const isFromCreator = appendixFlag(appendixCfg.is_from_creator);
    const appendixOn =
        appendixFlag(cfg.render_appendix) ||
        appendixFlag(cfg.custom_toc?.override_appendix);
    if (!appendixOn) return null;

    const parseConfig = cfg.expand_parsing && cfg.parse ? cfg.parse : null;
    const tree = {
        type: "appendix-root",
        title: appendixLocalizedTitle(
            "epub.appendix_root",
            APPENDIX_ROOT_TITLE,
        ),
        children: [],
    };

    const structure = Array.isArray(appendixCfg.structure)
        ? appendixCfg.structure.filter((s) => s && s.index_href)
        : [];
    if (structure.length > 0) {
        tree.fromStructure = true;
        for (const sec of structure) {
            const section = await buildAppendixSectionFromStructure(
                sec,
                cfg,
                lang,
                parseConfig,
            );
            if (section) tree.children.push(section);
        }
        return tree.children.length > 0 ? tree : null;
    }

    const takenPaths = new Set([APPENDIX_TOC_HREF, "toc.xhtml", "nav.xhtml"]);
    for (const type of appendixTypeKeys) {
        const reservedList = customAppendix[`${type}appendix`];
        if (reservedList && typeof reservedList === "object") {
            Object.keys(reservedList).forEach((k) => {
                if (k !== "comment" && reservedList[k]) {
                    takenPaths.add(String(reservedList[k]).replace(/\\/g, "/"));
                }
            });
        }
    }

    for (const type of appendixTypeKeys) {
        if (appendixCfg.render?.[type] === false) continue;
        const folder = appendixCfg.path?.[type] || appendixDefaultPaths[type];
        const tocName =
            (customTocOn && customAppendix[type]) ||
            appendixLocalizedTitle(`epub.appendix_${type}`, type);
        const listedMap = customAppendix[`${type}appendix`];
        let locations = [];
        const listedKeys =
            listedMap && typeof listedMap === "object"
                ? Object.keys(listedMap).filter(
                      (k) => k !== "comment" && listedMap[k],
                  )
                : [];
        if (listedKeys.length > 0) {
            locations = listedKeys
                .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
                .map((k) => String(listedMap[k]));
        } else if (isFromCreator) {
            locations = Object.keys(zipData.files)
                .filter(
                    (f) =>
                        f.startsWith(`${folder}/`) &&
                        /\.(?:xhtml|html)$/i.test(f) &&
                        !zipData.files[f].dir,
                )
                .sort((a, b) => appendixFileOrder(a) - appendixFileOrder(b));
        }

        const entries = [];
        let fileIndex = 0;
        for (const location of locations) {
            const source = zipData.file(location);
            if (!source) continue;
            let href = location;
            let content = await source.async("string");
            if (!isFromCreator && !location.includes("appendix")) {
                href = await relocateAppendixFile(
                    zipData,
                    location,
                    folder,
                    content,
                );
                content = await zipData.file(href).async("string");
            }
            fileIndex += 1;
            let title = getHtmlTitle(content, "");
            if (!title) title = tocName;
            const optimizedContent = cleanAndOptimizeHtml(
                content,
                title,
                lang,
                parseConfig,
            );
            entries.push({
                type: "appendix-entry",
                id: `appendix_${type}_${fileIndex}`,
                title: title,
                href: href,
                content: optimizedContent,
            });
        }

        if (entries.length > 0) {
            const section = {
                type: "appendix-section",
                appendixType: type,
                id: `appendix_${type}_toc`,
                title: tocName,
                href: assignAppendixSectionHref(folder, type, takenPaths),
                folder: folder,
                children: entries,
            };
            section.content = buildAppendixSectionTocXhtml(
                section,
                lang,
                tree.title,
            );
            tree.children.push(section);
        }
    }

    return tree.children.length > 0 ? tree : null;
}

function collectAppendixEntries(tree) {
    parsedAppendixEntries = [];
    const walk = (node) => {
        if (!node || !Array.isArray(node.children)) return;
        node.children.forEach((child) => {
            parsedAppendixEntries.push(child);
            walk(child);
        });
    };
    walk(tree);
}

function buildAppendixNavListHtml(tree) {
    if (!tree) return "";
    const sectionLis = tree.children
        .map((section) => {
            const entryLis = (section.children || [])
                .map((child) => {
                    if (
                        child.type === "appendix-group" &&
                        Array.isArray(child.children)
                    ) {
                        const subLis = child.children
                            .map(
                                (e) =>
                                    `                            <li><a href="${e.href}">${e.title}</a></li>`,
                            )
                            .join("\n");
                        return `                        <li>\n                            <a href="${child.href}">${child.title}</a>\n                            <ol>\n${subLis}\n                            </ol>\n                        </li>`;
                    }
                    return `                            <li><a href="${child.href}">${child.title}</a></li>`;
                })
                .join("\n");
            return `                    <li>\n                        <a href="${section.href}">${section.title}</a>\n                        <ol>\n${entryLis}\n                        </ol>\n                    </li>`;
        })
        .join("\n");
    return `            <li>\n                <a href="${APPENDIX_TOC_HREF}">${tree.title}</a>\n                <ol>\n${sectionLis}\n                </ol>\n            </li>\n`;
}

function buildAppendixTocPageHtml(tree) {
    if (!tree) return "";
    return `        <li style="margin: 0.8em 0; font-weight: bold; font-size: 1.1em;">\n            <a href="${APPENDIX_TOC_HREF}" style="color: #bf0000; text-decoration: none;">${tree.title}</a>\n        </li>\n`;
}

function buildAppendixTocXhtml(tree, lang, includeBackLink) {
    const sections = tree.children
        .map(
            (section) =>
                `            <li style="margin: 0.5em 0;"><a href="${section.href}" style="text-decoration: none; color: #0066cc;">${section.title}</a></li>`,
        )
        .join("\n");
    const backLink = includeBackLink
        ? `\n            <p><a href="toc.xhtml" style="color: #666; font-size: 0.9em; text-decoration: none;">← 返回主目录</a></p>`
        : "";
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>${tree.title}</title>
    <meta charset="utf-8" />
</head>
<body>
    <section style="padding: 1em;">
        <h2 style="color: #bf0000; border-bottom: 2px solid #bf0000; padding-bottom: 0.3em;">${tree.title}</h2>
        <div style="margin-top: 1em; padding-left: 10px;">${backLink}
            <ol style="list-style-type: none; padding-left: 0;">
${sections}
            </ol>
        </div>
    </section>
</body>
</html>`;
}

async function processConfiguration(cfg) {
    if (document.getElementById("titleCell"))
        document.getElementById("titleCell").textContent = cfg.title || "-";
    if (document.getElementById("authorCell"))
        document.getElementById("authorCell").textContent = cfg.author || "-";
    if (document.getElementById("languageCell"))
        document.getElementById("languageCell").textContent =
            cfg.language || "vi";
    if (document.getElementById("descriptionBox"))
        document.getElementById("descriptionBox").textContent = parseDesc(
            cfg.desc,
        );
    if (document.getElementById("genreCell")) {
        document.getElementById("genreCell").textContent = cfg.genre
            ? Object.entries(cfg.genre)
                  .filter(([k]) => k !== "comment")
                  .map(([, v]) => v)
                  .join(", ")
            : "-";
    }

    if (cfg.cover_href && zipData.file(cfg.cover_href)) {
        if (document.getElementById("coverCell"))
            document.getElementById("coverCell").textContent = cfg.cover_href;
        const coverFile = zipData.file(cfg.cover_href);
        if (coverFile) {
            const base64 = await coverFile.async("base64");
            const mime = getMimeType(cfg.cover_href);
            const previewImg = document.getElementById("coverPreview");
            if (previewImg) {
                previewImg.src = `data:${mime};base64,${base64}`;
                previewImg.style.display = "block";
            }
        }
    }

    parsedChapters = [];
    parsedAppendixTree = null;
    parsedAppendixEntries = [];
    const allFiles = Object.keys(zipData.files);
    const xhtmlFiles = allFiles.filter(
        (f) =>
            (f.endsWith(".xhtml") || f.endsWith(".html")) &&
            !f.endsWith(".verified"),
    );
    const tocNames = cfg.toc_name || {};
    const lang = cfg.language || "vi";
    const appendixResourceIndex = buildAppendixResourceIndex(cfg);

    if (cfg.custom_toc && cfg.custom_toc.enabled) {
        log(
            "Custom TOC enabled, đang sắp xếp lại thứ tự theo cấu trúc thư mục mới...",
        );

        const sortedFolderKeys = Object.keys(cfg.custom_toc)
            .filter(
                (key) =>
                    key !== "enabled" &&
                    key !== "comment" &&
                    key !== "override_appendix" &&
                    key !== "appendix" &&
                    key !== "locked",
            )
            .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

        let chapterVirtualIndex = 1;

        for (let folderKey of sortedFolderKeys) {
            const folderObj = cfg.custom_toc[folderKey];
            if (!folderObj || typeof folderObj !== "object") continue;

            const customDisplayId = folderObj.id || folderKey;

            if (folderObj.chapter_id) {
                const sortedChKeys = Object.keys(folderObj.chapter_id)
                    .filter((k) => k !== "comment")
                    .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

                for (let chKey of sortedChKeys) {
                    const fileLoc = folderObj.chapter_id[chKey];

                    if (fileLoc && zipData.file(fileLoc)) {
                        const content = await zipData
                            .file(fileLoc)
                            .async("string");
                        const pathParts = fileLoc.split("/");
                        const folder = pathParts.length > 1 ? pathParts[0] : "";

                        let title = getHtmlTitle(content, "");
                        if (!title) {
                            title =
                                tocNames[folder] ||
                                (folder
                                    ? `Mục ${folder}`
                                    : `Chương ${customDisplayId}_${chKey}`);
                        }

                        const parseConfig =
                            cfg.expand_parsing && cfg.parse ? cfg.parse : null;
                        const optimizedContent = cleanAndOptimizeHtml(
                            content,
                            title,
                            lang,
                            parseConfig,
                        );

                        parsedChapters.push({
                            id: `ch_${customDisplayId}_${chKey}`,
                            title: title,
                            href: fileLoc,
                            content: optimizedContent,
                            folder: folderKey,
                        });
                    }
                }
            }
        }
    } else {
        log("Render TOC theo mặc định (tên file chứa số tăng dần)");
        let fileOrderPairs = [];
        xhtmlFiles.forEach((path) => {
            if (isAppendixResource(appendixResourceIndex, path)) return;
            const filename = path.split("/").pop();
            const numMatch = filename.match(/\d+/);
            if (numMatch) {
                fileOrderPairs.push({ num: parseInt(numMatch[0]), path: path });
            } else {
                fileOrderPairs.push({ num: 999999, path: path });
            }
        });

        fileOrderPairs.sort((a, b) => a.num - b.num);

        let virtualId = 1;
        for (let pair of fileOrderPairs) {
            const content = await zipData.file(pair.path).async("string");
            const pathParts = pair.path.split("/");
            const folder = pathParts.length > 1 ? pathParts[0] : "";

            let title = getHtmlTitle(content, "");
            if (!title) {
                title = folder
                    ? `Chương thuộc ${tocNames[folder] || folder}`
                    : `Chương ${virtualId}`;
            }

            const parseConfig =
                cfg.expand_parsing && cfg.parse ? cfg.parse : null;
            const optimizedContent = cleanAndOptimizeHtml(
                content,
                title,
                lang,
                parseConfig,
            );

            parsedChapters.push({
                id: `ch_${virtualId}`,
                title: title,
                href: pair.path,
                content: optimizedContent,
                folder: folder,
            });
            virtualId++;
        }
    }

    parsedAppendixTree = await buildAppendixTree(cfg, lang);
    if (parsedAppendixTree) {
        collectAppendixEntries(parsedAppendixTree);
        log(
            `Đã nạp phụ lục: ${parsedAppendixTree.children.length} nhóm, ${parsedAppendixEntries.length} file. Appendix TOC sẽ nằm sau chương cuối.`,
        );
    }

    await detectImagesFiles(zipData);
    renderTablesUI(tocNames);
}

async function detectImagesFiles(zip) {
    log(
        "Bắt đầu quét phân tích mã XHTML để trích xuất và xử lý đường dẫn ảnh...",
    );
    detectedImages = [];
    let imgIndex = 1;

    if (config.cover_href && zip.file(config.cover_href)) {
        detectedImages.push({
            id: "cover_img",
            href: config.cover_href,
            mime: getMimeType(config.cover_href),
        });
    }

    for (let ch of [...parsedChapters, ...parsedAppendixEntries]) {
        const imgRegex =
            /<(?:img\s+[^>]*src|image\s+[^>]*href)\s*=\s*["']([^"']+)["']/gi;
        let match;
        let localCount = 0;

        while ((match = imgRegex.exec(ch.content)) !== null) {
            let originalSrc = match[1];
            let resolvedHref = resolveRelativePath(ch.href, originalSrc);

            if (zip.file(resolvedHref)) {
                if (!detectedImages.some((img) => img.href === resolvedHref)) {
                    detectedImages.push({
                        id: `img_media_${imgIndex++}`,
                        href: resolvedHref,
                        mime: getMimeType(resolvedHref),
                    });
                }
                localCount++;
            }
        }
        ch.detectedImgsCount = localCount;
    }
}

function renderTablesUI(tocNames) {
    const groups = {};
    parsedChapters.forEach((ch) => {
        const folderKey = ch.folder || "Root_Files";
        if (!groups[folderKey]) groups[folderKey] = [];
        if (!groups[folderKey].some((item) => item.href === ch.href)) {
            groups[folderKey].push(ch);
        }
    });

    let treeHtml = "";
    Object.keys(groups).forEach((folder) => {
        const folderTitle =
            tocNames[folder] ||
            (folder === "Root_Files" ? "Thư mục gốc" : `Thư mục: ${folder}`);
        treeHtml += `<div class="fw-bold text-dark mt-2"><i class="bi bi-folder-fill text-warning"></i> ${folderTitle}</div>`;

        const maxTreePreview = 20;
        const filesToRender = groups[folder].slice(0, maxTreePreview);

        filesToRender.forEach((ch) => {
            treeHtml += `
                <div class="py-1 px-4 border-bottom text-secondary small">
                    <i class="bi bi-file-earmark-code text-primary"></i> <span>${ch.href.split("/").pop()} [${ch.title}]</span>
                </div>
            `;
        });

        if (groups[folder].length > maxTreePreview) {
            treeHtml += `<div class="py-1 px-4 text-muted small fst-italic">... và ${groups[folder].length - maxTreePreview} file khác</div>`;
        }
    });

    if (parsedAppendixTree) {
        treeHtml += `<div class="fw-bold text-dark mt-2"><i class="bi bi-folder-fill text-warning"></i> ${parsedAppendixTree.title}</div>`;
        parsedAppendixTree.children.forEach((section) => {
            treeHtml += `<div class="py-1 px-4 border-bottom text-secondary small"><i class="bi bi-collection text-danger"></i> <span>${section.title} (${section.children.length} mục)</span></div>`;
            section.children.slice(0, 20).forEach((entry) => {
                treeHtml += `<div class="py-1 px-4 border-bottom text-secondary small"><i class="bi bi-file-earmark-code text-primary"></i> <span>${entry.href.split("/").pop()} [${entry.title}]</span></div>`;
                if (entry.type === "appendix-group" && entry.children) {
                    entry.children.slice(0, 20).forEach((sub) => {
                        treeHtml += `<div class="py-1 px-4 border-bottom text-secondary small"><i class="bi bi-file-earmark-text text-primary"></i> <span>${sub.href.split("/").pop()} [${sub.title}]</span></div>`;
                    });
                }
            });
        });
    }

    if (document.getElementById("tocTree")) {
        document.getElementById("tocTree").innerHTML = treeHtml;
    }

    const MAX_PREVIEW_ROWS = 50;

    if (document.getElementById("chapterTable")) {
        const chaptersPreview = parsedChapters.slice(0, MAX_PREVIEW_ROWS);
        let chapterHtml = chaptersPreview
            .map(
                (ch, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td><span class="badge bg-dark">${ch.id}</span> ➔ ${ch.href}<br><small class="text-muted">${ch.title}</small></td>
                <td><span class="badge bg-info">${ch.detectedImgsCount || 0} ảnh</span></td>
            </tr>`,
            )
            .join("");

        if (parsedChapters.length > MAX_PREVIEW_ROWS) {
            chapterHtml += `
                <tr>
                    <td colspan="3" class="text-center text-muted fst-italic bg-light">
                        Hiển thị preview ${MAX_PREVIEW_ROWS}/${parsedChapters.length} chương để tối ưu bộ nhớ RAM. Toàn bộ chương vẫn sẽ được đóng gói đầy đủ vào file EPUB.
                    </td>
                </tr>`;
        }
        document.getElementById("chapterTable").innerHTML = chapterHtml;
    }

    if (document.getElementById("imageTable")) {
        const imagesPreview = detectedImages.slice(0, MAX_PREVIEW_ROWS);
        let imageHtml = imagesPreview
            .map(
                (img, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${img.href}</td>
                <td><span class="badge bg-secondary">${img.mime}</span></td>
            </tr>`,
            )
            .join("");

        if (detectedImages.length > MAX_PREVIEW_ROWS) {
            imageHtml += `
                <tr>
                    <td colspan="3" class="text-center text-muted fst-italic bg-light">
                        Hiển thị preview ${MAX_PREVIEW_ROWS}/${detectedImages.length} ảnh để tối ưu bộ nhớ RAM. Toàn bộ ảnh vẫn sẽ được đóng gói đầy đủ vào file EPUB.
                    </td>
                </tr>`;
        }
        document.getElementById("imageTable").innerHTML = imageHtml;
    }

    log(
        `Hoàn tất phân tích dữ liệu: tìm thấy ${parsedChapters.length} Chương, ${parsedAppendixEntries.length} File phụ lục, ${detectedImages.length} Tài nguyên ảnh.`,
    );
}

async function generateEpub() {
    if (!zipData || !config) return;
    log("Bắt đầu khởi tạo cấu trúc đóng gói EPUB chuẩn...");
    updateProgress(30, "Đang xây dựng manifest & spine...");

    const epub = new JSZip();
    epub.file("mimetype", "application/epub+zip", { compression: "STORE" });

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
    epub.file("META-INF/container.xml", containerXml);

    const bookTitle =
        config.title ||
        (parsedChapters[0] ? parsedChapters[0].title : "EPUB Generated");
    const author = config.author || "Unknown";
    const lang = config.language || "Unknown";
    const description = parseDesc(config.desc).replace(/\n/g, " ");
    let descriptionLines = [];
    if (config.desc) {
        const sortedDescKeys = Object.keys(config.desc)
            .filter((k) => k !== "comment")
            .sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, "")) || 0;
                const numB = parseInt(b.replace(/\D/g, "")) || 0;
                return numA - numB;
            });

        sortedDescKeys.forEach((key) => {
            const line = config.desc[key];

            if (line && typeof line === "string") {
                descriptionLines.push(
                    `<dc:description>${line}</dc:description>`,
                );
            }
        });
    }
    const subjects = config.genre
        ? Object.values(config.genre).filter(
              (value) => typeof value === "string" && value.trim() !== "",
          )
        : [];
    let manifestItems = [];
    let spineItems = [];

    const allowedTargets = config.generate_in_ebook
        ? Object.values(config.generate_in_ebook)
        : ["cover", "desc", "toc"];

    const hasTocNameData = isTocNameValid(config.toc_name);

    detectedImages.forEach((img) => {
        if (img.id === "cover_img" && !allowedTargets.includes("cover")) return;
        let propertiesAttr =
            img.id === "cover_img" ? ' properties="cover-image"' : "";
        manifestItems.push(
            `    <item id="${img.id}" href="${img.href}" media-type="${img.mime}"${propertiesAttr}/>`,
        );
    });

    allowedTargets.forEach((target) => {
        if (target === "cover" && config.cover_href) {
            manifestItems.push(
                `    <item id="page_cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
            );
            spineItems.push(`    <itemref idref="page_cover"/>`);
        } else if (target === "desc" && config.desc) {
            manifestItems.push(
                `    <item id="page_desc" href="desc.xhtml" media-type="application/xhtml+xml"/>`,
            );
            spineItems.push(`    <itemref idref="page_desc"/>`);
        } else if (target === "toc") {
            manifestItems.push(
                `    <item id="page_toc" href="toc.xhtml" media-type="application/xhtml+xml"/>`,
            );
            spineItems.push(`    <itemref idref="page_toc"/>`);

            if (hasTocNameData) {
                const tocNames = config.toc_name || {};
                Object.keys(tocNames).forEach((folderKey) => {
                    if (folderKey !== "comment") {
                        manifestItems.push(
                            `    <item id="toc_vol_${folderKey}" href="toc_volume_${folderKey}.xhtml" media-type="application/xhtml+xml"/>`,
                        );
                        spineItems.push(
                            `    <itemref idref="toc_vol_${folderKey}"/>`,
                        );
                    }
                });
            } else if (config.custom_toc && config.custom_toc.enabled) {
                Object.keys(config.custom_toc)
                    .filter(
                        (key) =>
                            key !== "enabled" &&
                            key !== "comment" &&
                            key !== "override_appendix" &&
                            key !== "appendix" &&
                            key !== "locked",
                    )
                    .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
                    .forEach((folderKey) => {
                        manifestItems.push(
                            `    <item id="toc_vol_${folderKey}" href="toc_volume_${folderKey}.xhtml" media-type="application/xhtml+xml"/>`,
                        );
                        spineItems.push(
                            `    <itemref idref="toc_vol_${folderKey}"/>`,
                        );
                    });
            }
        }
    });

    parsedChapters.forEach((ch) => {
        manifestItems.push(
            `    <item id="${ch.id}" href="${ch.href}" media-type="application/xhtml+xml"/>`,
        );
        spineItems.push(`    <itemref idref="${ch.id}"/>`);
    });

    if (parsedAppendixTree) {
        manifestItems.push(
            `    <item id="${APPENDIX_TOC_ID}" href="${APPENDIX_TOC_HREF}" media-type="application/xhtml+xml"/>`,
        );
        spineItems.push(`    <itemref idref="${APPENDIX_TOC_ID}"/>`);
        const addManifestNode = (node) => {
            if (!node || !node.id || !node.href) return;
            manifestItems.push(
                `    <item id="${node.id}" href="${node.href}" media-type="application/xhtml+xml"/>`,
            );
            spineItems.push(`    <itemref idref="${node.id}"/>`);
            (node.children || []).forEach(addManifestNode);
        };
        parsedAppendixTree.children.forEach(addManifestNode);
    }

    manifestItems.push(
        `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    );

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${bookTitle}</dc:title>
        <dc:creator>${author}</dc:creator>
        <dc:language>${lang}</dc:language>
        ${descriptionLines.join("\n        ")}
        ${subjects.map((sub) => `<dc:subject>${sub}</dc:subject>`).join("\n        ")}
        <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : "12345678-1234-5678-1234-567812345678"}</dc:identifier>
        <meta property="dcterms:modified">${new Date().toISOString().split(".")[0] + "Z"}</meta>
    </metadata>
    <manifest>
\n${manifestItems.join("\n")}
    </manifest>
    <spine>
\n${spineItems.join("\n")}
    </spine>
</package>`;
    epub.file("OEBPS/content.opf", contentOpf);

    updateProgress(60, "Đang khởi tạo các trang nội dung đặc biệt...");

    if (allowedTargets.includes("cover") && config.cover_href) {
        const coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>Cover</title>
    <style>
        body { margin: 0; padding: 0; text-align: center; background-color: #ffffff; }
        img { max-width: 100%; height: auto; max-height: 100vh; }
    </style>
</head>
<body>
    <div class="cover-container">
        <img src="${config.cover_href}" alt="Cover Image" />
    </div>
</body>
</html>`;
        epub.file("OEBPS/cover.xhtml", coverHtml);
    }

    if (allowedTargets.includes("desc") && config.desc) {
        const descParagraphs = parseDesc(config.desc)
            .split("\n")
            .map(
                (line) =>
                    `     <p style="text-indent: 2em; line-height: 1.6; margin: 0.5em 0;">${line}</p>`,
            )
            .join("\n");

        const descHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>Description</title>
    <meta charset="utf-8" />
</head>
<body>
    <section class="book-desc" style="padding: 1em;">
        <h2 style="text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 0.5em;">简介 / Description</h2>
        <div style="margin-top: 1.5em;">
${descParagraphs}
        </div>
    </section>
</body>
</html>`;
        epub.file("OEBPS/desc.xhtml", descHtml);
    }

    let navListHtml = "";
    let tocPageHtml = "";

    if (allowedTargets.includes("toc")) {
        const tocNames = config.toc_name || {};

        const customTocOn =
            config.custom_toc && config.custom_toc.enabled === true;
        if (!hasTocNameData && !customTocOn) {
            parsedChapters.forEach((ch) => {
                navListHtml += `            <li><a href="${ch.href}">${ch.title}</a></li>\n`;
                tocPageHtml += `        <li style="margin: 0.4em 0;"><a href="${ch.href}" style="text-decoration: none; color: #0066cc;">${ch.title}</a></li>\n`;
            });
            if (parsedAppendixTree) {
                navListHtml += buildAppendixNavListHtml(parsedAppendixTree);
                tocPageHtml += buildAppendixTocPageHtml(parsedAppendixTree);
            }
        } else {
            const groups = {};
            parsedChapters.forEach((ch) => {
                const folderKey = ch.folder || "Unclassified";
                if (!groups[folderKey]) groups[folderKey] = [];
                groups[folderKey].push(ch);
            });

            const volumeKeys = hasTocNameData
                ? Object.keys(tocNames).filter((k) => k !== "comment")
                : Object.keys(config.custom_toc || {}).filter(
                      (key) =>
                          key !== "enabled" &&
                          key !== "comment" &&
                          key !== "override_appendix" &&
                          key !== "appendix" &&
                          key !== "locked",
                  );
            const sortedVolKeys = volumeKeys.sort(
                (a, b) => (parseInt(a) || 0) - (parseInt(b) || 0),
            );

            sortedVolKeys.forEach((folderKey) => {
                const volTitle = tocNames[folderKey] || `Volume ${folderKey}`;
                const chsInVol = groups[folderKey] || [];
                const targetSubTocHref = `toc_volume_${folderKey}.xhtml`;

                navListHtml += `            <li>\n                <a href="${targetSubTocHref}">${volTitle}</a>\n                <ol>\n`;
                chsInVol.forEach((ch) => {
                    navListHtml += `                    <li><a href="${ch.href}">${ch.title}</a></li>\n`;
                });
                navListHtml += `                </ol>\n            </li>\n`;

                tocPageHtml += `        <li style="margin: 0.8em 0; font-weight: bold; font-size: 1.1em;">\n            <a href="${targetSubTocHref}" style="color: #bf0000; text-decoration: none;">${volTitle} (点击查看分卷)</a>\n        </li>\n`;

                let subTocLiHtml = "";
                chsInVol.forEach((ch) => {
                    subTocLiHtml += `        <li style="margin: 0.5em 0;"><a href="${ch.href}" style="text-decoration: none; color: #0066cc;">${ch.title}</a></li>\n`;
                });

                const subTocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>${volTitle}</title>
    <meta charset="utf-8" />
</head>
<body>
    <section style="padding: 1em;">
        <h2 style="color: #bf0000; border-bottom: 2px solid #bf0000; padding-bottom: 0.3em;">${volTitle}</h2>
        <div style="margin-top: 1em; padding-left: 10px;">
            <p><a href="toc.xhtml" style="color: #666; font-size: 0.9em; text-decoration: none;">← 返回主目录</a></p>
            <ul style="list-style-type: none; padding-left: 0;">
${subTocLiHtml}
            </ul>
        </div>
    </section>
</body>
</html>`;
                epub.file(`OEBPS/${targetSubTocHref}`, subTocXhtml);
            });

            if (parsedAppendixTree) {
                navListHtml += buildAppendixNavListHtml(parsedAppendixTree);
                tocPageHtml += buildAppendixTocPageHtml(parsedAppendixTree);
            }
        }
    }

    const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}">
<head>
    <title>Navigation</title>
    <meta charset="utf-8" />
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>${bookTitle} - 目录</h1>
        <ol>
${navListHtml}        </ol>
    </nav>
</body>
</html>`;
    epub.file("OEBPS/nav.xhtml", navXhtml);

    const mainTocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
    <title>Table of Contents</title>
    <meta charset="utf-8" />
</head>
<body>
    <section class="book-toc" style="padding: 1em;">
        <h2 style="text-align: center; margin-bottom: 1.2em;">目 录 / Table of Contents</h2>
        <ul style="list-style-type: none; padding-left: 5px; line-height: 1.5;">
${tocPageHtml}        </ul>
    </section>
</body>
</html>`;
    epub.file("OEBPS/toc.xhtml", mainTocXhtml);

    if (parsedAppendixTree) {
        if (parsedAppendixTree.fromStructure) {
            const appendixSource = zipData.file(APPENDIX_TOC_HREF);
            if (appendixSource) {
                epub.file(
                    `OEBPS/${APPENDIX_TOC_HREF}`,
                    await appendixSource.async("string"),
                );
            }
        } else {
            epub.file(
                `OEBPS/${APPENDIX_TOC_HREF}`,
                buildAppendixTocXhtml(
                    parsedAppendixTree,
                    lang,
                    allowedTargets.includes("toc"),
                ),
            );
        }
        const writeTreePage = (node) => {
            if (!node || !node.href || !node.content) return;
            epub.file(`OEBPS/${node.href}`, node.content);
            (node.children || []).forEach(writeTreePage);
        };
        parsedAppendixTree.children.forEach(writeTreePage);
    }

    updateProgress(
        80,
        "Đang biên dịch gom các chương và tệp ảnh đính kèm vào sách...",
    );

    for (let img of detectedImages) {
        if (img.id === "cover_img" && !allowedTargets.includes("cover"))
            continue;
        const imgData = await zipData.file(img.href).async("uint8array");
        epub.file(`OEBPS/${img.href}`, imgData);
    }

    for (let ch of parsedChapters) {
        epub.file(`OEBPS/${ch.href}`, ch.content);
    }

    for (let entry of parsedAppendixEntries) {
        epub.file(`OEBPS/${entry.href}`, entry.content);
    }

    try {
        finalEpubBlob = await epub.generateAsync({
            type: "blob",
            mimeType: "application/epub+zip",
        });
        log("Thành công! File EPUB đã được cấu trúc và đóng gói thành công.");
        updateProgress(100, "Hoàn tất! Sẵn sàng tải xuống.");
        if (document.getElementById("downloadBtn"))
            document.getElementById("downloadBtn").disabled = false;
    } catch (err) {
        log(`Lỗi khi đóng gói: ${err.message}`);
    }
}

function downloadEpub() {
    if (!finalEpubBlob || !config) return;

    const cleanName = (config.title || config.author || "ebook")
        .replace(/[^\w\s\u4e00-\u9fa5]/g, "_")
        .trim()
        .substring(0, 50);

    saveAs(finalEpubBlob, `${cleanName}.epub`);
    log("Đã xuất và tải file EPUB thành công!");
}
