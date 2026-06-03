const fileInput = document.getElementById("file");
const output = document.getElementById("output");
const btn = document.getElementById("download");

let finalTxt = "";

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const zip = await JSZip.loadAsync(file);

    const container = await zip.file("META-INF/container.xml").async("string");
    const opfPathMatch = container.match(/full-path="([^"]+)"/);

    if (!opfPathMatch) {
        output.value = "OPF not found";
        return;
    }

    const opfPath = opfPathMatch[1];
    const opfText = await zip.file(opfPath).async("string");

    const parser = new DOMParser();
    const opfXml = parser.parseFromString(opfText, "application/xml");

    const titleRaw = opfXml.querySelector("title")?.textContent?.trim();
    const title = titleRaw || t("book.no_title");

    const creatorRaw = opfXml.querySelector("creator")?.textContent?.trim();
    const creator = creatorRaw || t("book.no_author");

    const getMetaContent = (xml, selector) =>
        xml.querySelector(selector)?.textContent?.trim() || "";

    const description =
        getMetaContent(opfXml, "description") ||
        getMetaContent(opfXml, "dc\\:description") ||
        getMetaContent(opfXml, "meta[name='description']");

    const comment =
        getMetaContent(opfXml, "meta[name='comment']") ||
        getMetaContent(opfXml, "dc\\:comment");

    const genre = opfXml.querySelector("subject")?.textContent || "";

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

    const stripHTML = (html) => {
        const div = document.createElement("div");
        div.innerHTML = html;

        div.querySelectorAll("script,style,noscript").forEach((el) =>
            el.remove(),
        );

        div.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));

        const blockTags = div.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li");

        blockTags.forEach((el) => el.append("\n"));

        return div.textContent
            .replace(/\n\s+\n/g, "\n\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    };

    const normalizeTitle = (title, index) => {
        if (!title) return title;

        const cleaned = title.trim();

        const regex = new RegExp(`^\\s*0*${index + 1}[\\.|\\-|\\s]+`, "i");

        return cleaned.replace(regex, "").trim();
    };

    const isFakeChapter = (text, title, doc) => {
        if (!text || text.length < 200) return true;

        const normalized = text.toLowerCase();

        const blacklist = [title, creator, description, genre]
            .filter(Boolean)
            .map((s) => s.toLowerCase());

        if (blacklist.some((b) => b && normalized.includes(b))) return true;

        const tocSignals = ["table of contents", "mục lục", "contents"];
        const tocHits = tocSignals.filter((s) => normalized.includes(s)).length;
        if (tocHits >= 2 && text.length < 3000) return true;

        const aTags = doc.querySelectorAll("a");
        const linkCount = aTags.length;

        if (linkCount > 10) return true;

        const linkRatio = linkCount / (text.length || 1);
        if (linkRatio > 0.02) return true;

        return false;
    };

    const firstTenLengths = [];

    for (let i = 0; i < Math.min(10, spine.length); i++) {
        const filePath = basePath ? `${basePath}/${spine[i]}` : spine[i];
        const file = zip.file(filePath);
        if (!file) continue;

        const html = await file.async("string");
        const doc = parser.parseFromString(html, "text/html");

        const text = stripHTML(doc.body?.innerHTML || "");

        firstTenLengths.push({
            index: i,
            length: text.length,
            text,
        });
    }

    const avgLength =
        firstTenLengths.reduce((sum, x) => sum + x.length, 0) /
        (firstTenLengths.length || 1);

    const descriptionIndexes = new Set(
        firstTenLengths
            .filter((x) => x.length < avgLength * 0.3)
            .map((x) => x.index),
    );

    let extraDescription = firstTenLengths
        .filter((x) => descriptionIndexes.has(x.index))
        .map((x) => x.text)
        .join("\n\n");

    const validChapters = [];

    for (let i = 0; i < spine.length; i++) {
        const filePath = basePath ? `${basePath}/${spine[i]}` : spine[i];
        const file = zip.file(filePath);
        if (!file) continue;

        const html = await file.async("string");
        const doc = parser.parseFromString(html, "text/html");

        const headings = [...doc.querySelectorAll("h1, h2")]
            .map((el) => el.textContent?.trim())
            .filter(Boolean);

        let chapterTitle =
            headings.find((t) => t.length < 120) ||
            doc.title?.trim() ||
            `${t("chapter")} ${i + 1}`;

        chapterTitle = normalizeTitle(chapterTitle, i);

        doc.querySelectorAll("h1, h2").forEach((el) => el.remove());

        const text = stripHTML(doc.body?.innerHTML || "")
            .split("\n")
            .filter(
                (line) =>
                    line.trim().toLowerCase() !== chapterTitle.toLowerCase(),
            )
            .join("\n");

        if (descriptionIndexes.has(i)) continue;
        if (isFakeChapter(text, chapterTitle, doc)) continue;

        validChapters.push({
            index: validChapters.length + 1,
            title: chapterTitle,
            text,
        });
    }

    const finalDescription = [description, comment, extraDescription]
        .filter(Boolean)
        .join("\n\n");

    const render = () => {
        let result = "";

        result += `<>\n${title}\n</>\n\n`;

        result += `<info>\n`;
        result += `$t("author"): ${creator}\n$t("genre"): ${genre}\n$t("chapter.count"): ${spine.length}\n`;
        result += `${finalDescription}\n`;
        result += `</info>\n\n`;

        result += `[\n$t("charlist")\n]\n\n`;

        result += `<list>\n`;

        validChapters.forEach((ch, idx) => {
            result += `${idx + 1}. ${ch.title} {\n`;
            result += `• ${ch.text.trim()}\n`;
            result += `• }\n\n`;
        });

        result += `</list>`;

        return result;
    };

    finalTxt = render();
    output.value = finalTxt;
    btn.style.display = "inline-block";
});

btn.addEventListener("click", () => {
    const blob = new Blob([output.value], { type: "text/plain" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "converted.txt";
    a.click();
});
