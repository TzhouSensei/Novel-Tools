export const normalizeForComparison = (value = "") =>
    String(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

export const getFirstHeading = (doc) =>
    [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")].find((el) =>
        (el.textContent || "").trim(),
    );

export const removeTitleLikeBlocks = (text, title) => {
    if (!text || !title) return text;

    const normalizedTitle = normalizeForComparison(title);
    if (!normalizedTitle) return text;

    return text
        .split(/\n\s*\n/)
        .map((block) =>
            block
                .replace(/\r\n/g, "\n")
                .replace(/[ \t]+/g, " ")
                .replace(/[ \t]*\n[ \t]*/g, "\n")
                .replace(/\n{3,}/g, "\n\n")
                .trim(),
        )
        .filter((block) => {
            if (!block) return false;
            const normalizedBlock = normalizeForComparison(block);
            if (!normalizedBlock) return true;
            return (
                normalizedBlock !== normalizedTitle &&
                normalizedBlock !== `${normalizedTitle} ${normalizedTitle}`
            );
        })
        .join("\n\n");
};

export const normalizeTextBlock = (text = "") =>
    text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n\s+\n/g, "\n\n")
        .trim();

export const cleanBodyText = (doc, title, stripHTMLFn) => {
    const body = doc.body || doc.documentElement;
    if (!body) return "";

    const clonedBody = body.cloneNode(true);

    clonedBody
        .querySelectorAll?.("h1,h2,h3,h4,h5,h6")
        ?.forEach?.((el) => el.remove());

    const htmlText = clonedBody.innerHTML || "";
    const cleanedText =
        typeof stripHTMLFn === "function"
            ? stripHTMLFn(htmlText)
            : htmlText
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

    return normalizeTextBlock(removeTitleLikeBlocks(cleanedText, title));
};

export const tokenizeStructure = (str = "") =>
    String(str)
        .toLowerCase()
        .trim()
        .match(/\d+|[a-zA-ZÀ-ỹ]+|[^a-zA-ZÀ-ỹ\d]+/g) || [];

export const normalizeTokens = (tokens) =>
    tokens.map((token) => (/^\d+$/.test(token) ? "[NUMBER]" : token));

export const buildTemplate = (samples) => {
    if (!samples.length) return [];

    const tokenized = samples.map((s) => normalizeTokens(tokenizeStructure(s)));
    const maxLen = Math.max(...tokenized.map((t) => t.length));
    const template = [];

    for (let i = 0; i < maxLen; i++) {
        const values = tokenized.map((t) => t[i]);
        const first = values[0];
        const same = values.every((v) => v === first);
        template.push(same ? first : "[VAR]");
    }

    return template;
};

export const templateScore = (value, template) => {
    if (!template.length) return 1;

    const tokens = normalizeTokens(tokenizeStructure(value));
    const maxLen = Math.max(tokens.length, template.length);

    let matched = 0;

    for (let i = 0; i < maxLen; i++) {
        if (template[i] === "[VAR]") {
            matched++;
            continue;
        }
        if (tokens[i] === template[i]) matched++;
    }

    return matched / maxLen;
};

export const isFakeChapter = (text, title, doc) => {
    if (!text || text.length < 200) return true;

    const normalizedText = normalizeForComparison(text);
    const normalizedTitle = normalizeForComparison(title || "");
    const tocSignals = [
        "table of contents",
        "contents",
        "mục lục",
        "chương mục",
        "chapter list",
        "index",
        "content",
    ];

    const tocHits = tocSignals.filter(
        (signal) =>
            normalizedText.includes(signal) || normalizedTitle.includes(signal),
    ).length;

    if (tocHits >= 1 && text.length < 3000) return true;

    const linkCount = doc?.querySelectorAll?.("a")?.length || 0;
    if (linkCount > 10) return true;

    const linkRatio = linkCount / (text.length || 1);
    if (linkRatio > 0.02) return true;

    return false;
};

export const collectMetaText = (xml, selectors = []) => {
    const values = [];
    const seen = new Set();

    const addValue = (value) => {
        if (!value) return;
        const trimmed = String(value).trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        values.push(trimmed);
    };

    const addSelectorValues = (selector) => {
        if (!selector) return;

        const elements = xml?.querySelectorAll?.(selector) || [];
        elements.forEach((el) => addValue(el.textContent));

        if (elements.length) return;

        if (selector === "dc\\:description") {
            const namespaced =
                xml?.getElementsByTagName?.("dc:description") || [];
            [...namespaced].forEach((el) => addValue(el.textContent));
        }

        if (selector === "dc\\:comment") {
            const namespaced = xml?.getElementsByTagName?.("dc:comment") || [];
            [...namespaced].forEach((el) => addValue(el.textContent));
        }
    };

    (Array.isArray(selectors) ? selectors : [selectors]).forEach(
        addSelectorValues,
    );

    return values.join("\n");
};

export const selectChapterFiles = (spineFiles = []) => {
    if (!spineFiles.length) {
        return {
            validIndexes: [],
            extraFiles: [],
            descriptionIndexes: new Set(),
        };
    }

    const samples = spineFiles.slice(0, Math.min(10, spineFiles.length));
    const avgLength =
        samples.reduce((sum, file) => sum + (file.text?.length || 0), 0) /
        (samples.length || 1);
    const threshold = avgLength * 0.3;

    const descriptionIndexes = new Set();
    const validIndexes = [];
    const extraFiles = [];

    spineFiles.forEach((file) => {
        const normalizedTitle = normalizeForComparison(file.title || "");
        const normalizedText = normalizeForComparison(file.text || "");
        const titleSignals = [
            "table of contents",
            "contents",
            "mục lục",
            "chapter list",
            "index",
            "about",
            "author",
            "copyright",
            "foreword",
            "prologue",
            "introduction",
            "preface",
        ];

        const isLikelyDescriptionFile =
            (file.text?.length || 0) < threshold ||
            titleSignals.some(
                (signal) =>
                    normalizedTitle.includes(signal) ||
                    normalizedText.includes(signal),
            );

        if (isLikelyDescriptionFile) {
            descriptionIndexes.add(file.index);
            return;
        }

        if (isFakeChapter(file.text, file.title, file.doc)) {
            extraFiles.push(file);
            return;
        }

        validIndexes.push(file.index);
    });

    return { validIndexes, extraFiles, descriptionIndexes };
};
