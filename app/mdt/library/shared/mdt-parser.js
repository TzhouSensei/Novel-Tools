function escapeHtml(str) {
    return str.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
function renderChapterHTML(content, tFn) {
    const t = tFn || ((k, fb) => fb);
    const isEmpty = content.split(/\r?\n/).every((line) => {
        const trimmed = line.trim();
        return trimmed === "" || trimmed === "•";
    });

    if (isEmpty) {
        return `<span class="bullet">•</span><span class="empty-text">${t("reader.not_updated", "Chưa cập nhật")}</span><span class="bullet">•</span>`;
    }

    const lines = content.split(/\r?\n/);
    let html = "";
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed === "•") {
            html += `<span class="bullet">•</span>`;
            return;
        }
        if (trimmed === "") {
            html += "<br><br>";
            return;
        }
        html += escapeHtml(line);
        html += "<br><br>";
    });
    html = html.replace(/(<br><br>)+$/, "");
    return html;
}

function parseMDTText(text, fallbackTitle) {
    let storyTitle = fallbackTitle || "Truyện không có tiêu đề";
    let description = "Chưa cập nhật";
    let characters = [];
    let chapters = [];

    const isTxtAutoSplit = !text.includes("<list>");

    if (isTxtAutoSplit) {
        const lines = text.split(/\r?\n/);

        const isSplitterLine = (str) => {
            const trimmed = str.trim();
            if (
                /^(\-+|=+|★+|\*+|~+|\+|=)+$/.test(trimmed) &&
                trimmed.length >= 3
            )
                return true;
            if (/^\*=\s*=*\*$/.test(trimmed)) return true;
            if (/^\*\-\s*\-*\*$/.test(trimmed)) return true;
            return false;
        };

        let hasAsciiBoxes = false;
        let splitterCount = 0;
        for (let i = 0; i < lines.length; i++) {
            if (isSplitterLine(lines[i])) splitterCount++;
            if (
                lines[i].trim().startsWith("||") &&
                lines[i].trim().endsWith("||")
            ) {
                hasAsciiBoxes = true;
            }
        }

        let strategy = "FALLBACK_KEYWORD";
        if (splitterCount >= 2 && hasAsciiBoxes) {
            strategy = "SPLITTER";
        } else {
            const nametester2 =
                /^(?:(?:Chương|Hồi|Phần|Tập|Trận|Quyển|Bản|Kiếp|Chapter|Chap|Ch|Vol|Volume|Episode|Ep|Part|Section|Act|Глава|Часть|第|【|no\.?)? ?(?:[0-9一二三四五六七八九十千万亿零百]+) ?[章节集回卷 phần chapter ]*[:\-.]?)|^(?:Ngoại truyện|Phiên ngoại|Vĩ thanh|Mở đầu|Tiền truyện|Lời mở đầu|Lời kết|Prologue|Epilogue|Side story|Extra|Bonus|Spin-off|Interlude|Afterword|Preface|Введение|Эпилог|Пролог|Послесловие|番外|序章|終章|외전|프롤로그|에필로그)/i;
            const contentLineTester = /^([ \t\xA0\u2002\u2003\u2009]| )+/;

            let totalLines = 0;
            let indentedLines = 0;
            let strictTitleMatchCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                if (trimmed === "") continue;

                totalLines++;
                if (contentLineTester.test(line)) indentedLines++;
                if (nametester2.test(trimmed) && nametester2.test(line)) {
                    strictTitleMatchCount++;
                }
            }

            const isLargeScaleIndent =
                totalLines > 0 && indentedLines / totalLines > 0.4;
            if (isLargeScaleIndent) {
                strategy = "PURE_INDENT";
            } else if (strictTitleMatchCount > 0) {
                let hasHybridSign = false;
                for (let i = 0; i < lines.length; i++) {
                    if (
                        contentLineTester.test(lines[i]) &&
                        nametester2.test(lines[i].trim())
                    ) {
                        hasHybridSign = true;
                        break;
                    }
                }
                strategy = hasHybridSign
                    ? "HYBRID_MIXED"
                    : "FLAT_BLOCK_KEYWORD";
            }
        }

        let formattedChapters = [];

        if (strategy === "SPLITTER") {
            let parsedBlocks = [];
            let currentBlock = [];

            for (let i = 0; i < lines.length; i++) {
                if (isSplitterLine(lines[i])) {
                    let hasPrevEmpty = i > 0 && lines[i - 1].trim() === "";
                    let hasNextEmpty =
                        i < lines.length - 1 && lines[i + 1].trim() === "";

                    if (hasPrevEmpty && hasNextEmpty) {
                        if (
                            currentBlock.length > 0 &&
                            currentBlock[currentBlock.length - 1].trim() === ""
                        ) {
                            currentBlock.pop();
                        }
                        if (currentBlock.length > 0) {
                            parsedBlocks.push(currentBlock);
                        }
                        currentBlock = [];
                        i++;
                    } else {
                        if (currentBlock.length > 0) {
                            parsedBlocks.push(currentBlock);
                        }
                        currentBlock = [];
                    }
                } else {
                    currentBlock.push(lines[i]);
                }
            }
            if (currentBlock.length > 0) {
                parsedBlocks.push(currentBlock);
            }

            let finalTitleBoxStr = "";
            let infoBoxIndex = -1;

            let processedBlocks = parsedBlocks.map((block, bIdx) => {
                let contentStr = block.join("\n");

                if (contentStr.includes("||")) {
                    let linesInBlock = block
                        .map((l) => l.trim())
                        .filter(Boolean);
                    let middleLine = linesInBlock.find(
                        (l) => l.startsWith("||") && l.endsWith("||"),
                    );
                    if (middleLine) {
                        let cleanTitle = middleLine
                            .replace(/^\|\|\s*/, "")
                            .replace(/\s*\|\|$/, "")
                            .trim();
                        storyTitle = cleanTitle;
                        finalTitleBoxStr = cleanTitle;
                        return { type: "TITLE", text: cleanTitle };
                    }
                }

                if (
                    contentStr.includes("Tác giả:") ||
                    contentStr.includes("Mô tả:") ||
                    contentStr.includes("Thể loại:")
                ) {
                    infoBoxIndex = bIdx;
                    let cleanLines = block
                        .map((l) => l.trim())
                        .filter((l) => l !== "" && !isSplitterLine(l))
                        .map((l) =>
                            l.replace(/^\|/, "").replace(/\|$/, "").trim(),
                        )
                        .filter(Boolean);
                    return { type: "INFO", text: cleanLines.join("\n") };
                }

                return { type: "CONTENT", text: block.join("\n").trim() };
            });

            let descTextContent = "Chưa cập nhật";
            let infoBlock = processedBlocks.find((b) => b.type === "INFO");
            if (infoBlock) {
                descTextContent = infoBlock.text;
            }
            if (finalTitleBoxStr) {
                descTextContent = finalTitleBoxStr + "\n\n" + descTextContent;
            }
            description = descTextContent;

            processedBlocks.forEach((block, idx) => {
                if (
                    block.type === "CONTENT" &&
                    block.text.length > 0 &&
                    idx > infoBoxIndex
                ) {
                    let chLines = block.text.split("\n");
                    let chTitle = chLines[0].trim();
                    let chBody = chLines.slice(1).join("\n").trim();

                    if (chTitle.length > 0) {
                        formattedChapters.push({
                            title: chTitle,
                            body: chBody,
                        });
                    }
                }
            });
        } else {
            const nametester2 =
                /^(?:(?:Chương|Hồi|Phần|Tập|Trận|Quyển|Bản|Kiếp|Chapter|Chap|Ch|Vol|Volume|Episode|Ep|Part|Section|Act|Глава|Часть|第|【|no\.?)? ?(?:[0-9一二三四五六七八九十千万亿零两]+) ?[章节集回卷话节 ]*[:\-.]?)|^(?:Ngoại truyện|Phiên ngoại|Vĩ thanh|Mở đầu|Tiền truyện|Lời mở đầu|Lời kết|Prologue|Epilogue|Side story|Extra|Bonus|Spin-off|Interlude|Afterword|Preface|Введение|Эпилог|Пролог|Послесловие|番外|序章|終章|외전|프롤로그|에필로그)/i;
            const contentLineTester = /^([ \t\xa0\u2002\u2003\u2009]| )+/;

            if (strategy === "PURE_INDENT") {
                let currentChapter = null;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    if (trimmed === "") {
                        if (currentChapter) currentChapter.bodyLines.push(line);
                        continue;
                    }

                    const isIndent = contentLineTester.test(line);

                    if (
                        !isIndent &&
                        (nametester2.test(trimmed) || trimmed.length < 80)
                    ) {
                        if (currentChapter) {
                            formattedChapters.push({
                                title: currentChapter.title,
                                body: currentChapter.bodyLines
                                    .join("\n")
                                    .trim(),
                            });
                        }
                        currentChapter = { title: trimmed, bodyLines: [] };
                    } else {
                        if (currentChapter) {
                            currentChapter.bodyLines.push(line);
                        } else {
                            currentChapter = {
                                title: "Mở đầu",
                                bodyLines: [line],
                            };
                        }
                    }
                }
                if (currentChapter) {
                    formattedChapters.push({
                        title: currentChapter.title,
                        body: currentChapter.bodyLines.join("\n").trim(),
                    });
                }
            } else if (strategy === "HYBRID_MIXED") {
                let currentChapter = null;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    if (trimmed === "") {
                        if (currentChapter) currentChapter.bodyLines.push(line);
                        continue;
                    }

                    const isStrictTitle = nametester2.test(line);

                    if (isStrictTitle) {
                        if (currentChapter) {
                            formattedChapters.push({
                                title: currentChapter.title,
                                body: currentChapter.bodyLines
                                    .join("\n")
                                    .trim(),
                            });
                        }
                        currentChapter = { title: trimmed, bodyLines: [] };
                    } else {
                        if (currentChapter) {
                            currentChapter.bodyLines.push(line);
                        } else {
                            currentChapter = {
                                title: "Mở đầu",
                                bodyLines: [line],
                            };
                        }
                    }
                }
                if (currentChapter) {
                    formattedChapters.push({
                        title: currentChapter.title,
                        body: currentChapter.bodyLines.join("\n").trim(),
                    });
                }
            } else {
                let currentChapter = null;
                let temporaryChapters = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    if (trimmed === "") {
                        if (currentChapter) currentChapter.bodyLines.push(line);
                        continue;
                    }

                    const isStrictTitle = nametester2.test(line);

                    if (isStrictTitle) {
                        if (currentChapter) {
                            temporaryChapters.push({
                                title: currentChapter.title,
                                bodyLines: currentChapter.bodyLines,
                            });
                        }
                        currentChapter = { title: trimmed, bodyLines: [] };
                    } else {
                        if (currentChapter) {
                            currentChapter.bodyLines.push(line);
                        } else {
                            currentChapter = {
                                title: "Mở đầu",
                                bodyLines: [line],
                            };
                        }
                    }
                }
                if (currentChapter) {
                    temporaryChapters.push({
                        title: currentChapter.title,
                        bodyLines: currentChapter.bodyLines,
                    });
                }

                temporaryChapters.forEach((chap) => {
                    let subLines = chap.bodyLines;
                    let hasInternalTitle = false;

                    for (let j = 0; j < subLines.length; j++) {
                        if (nametester2.test(subLines[j].trim())) {
                            hasInternalTitle = true;
                            break;
                        }
                    }

                    if (hasInternalTitle) {
                        let cleanedSubText = subLines
                            .map((l) => l.trim())
                            .join("\n");
                        let subLinesCleaned = cleanedSubText.split("\n");

                        let subChapter = null;
                        let isFirstSub = true;

                        for (let j = 0; j < subLinesCleaned.length; j++) {
                            const sLine = subLinesCleaned[j];
                            if (sLine === "") {
                                if (subChapter) subChapter.bodyLines.push("");
                                continue;
                            }

                            if (nametester2.test(sLine)) {
                                if (subChapter) {
                                    formattedChapters.push({
                                        title: subChapter.title,
                                        body: subChapter.bodyLines
                                            .join("\n")
                                            .trim(),
                                    });
                                }
                                subChapter = {
                                    title: sLine,
                                    bodyLines: [],
                                };
                                isFirstSub = false;
                            } else {
                                if (subChapter) {
                                    subChapter.bodyLines.push(sLine);
                                } else if (isFirstSub) {
                                    subChapter = {
                                        title: chap.title,
                                        bodyLines: [sLine],
                                    };
                                    isFirstSub = false;
                                }
                            }
                        }
                        if (subChapter) {
                            formattedChapters.push({
                                title: subChapter.title,
                                body: subChapter.bodyLines.join("\n").trim(),
                            });
                        }
                    } else {
                        formattedChapters.push({
                            title: chap.title,
                            body: chap.bodyLines.join("\n").trim(),
                        });
                    }
                });
            }
        }

        const validChapters = formattedChapters.filter(
            (chap) => chap.body.length > 5 || chap.title.length > 0,
        );

        let simulatedList = "<list>";
        validChapters.forEach((chap) => {
            simulatedList += `${chap.title}⟨${chap.body}⟩\n`;
        });
        simulatedList += "</list>";

        text = simulatedList;
    }

    const titleMatch = text.match(/<>\s*([\s\S]*?)\s*<\/>/);
    if (titleMatch) {
        storyTitle = titleMatch[1].trim() || storyTitle;
        text = text.replace(titleMatch[0], "");
    }

    const descMatch = text.match(/<info>\s*([\s\S]*?)\s*<\/info>/);
    if (descMatch) {
        const cleaned = descMatch[1].trim();
        if (cleaned.length > 0) {
            description = cleaned;
        }
        text = text.replace(descMatch[0], "");
    }

    const listMatch = text.match(/\[\s*([\s\S]*?)\s*\]/);
    if (listMatch) {
        characters = listMatch[1]
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        text = text.replace(listMatch[0], "");
    }

    const listRegex = /<list>([\s\S]*?)<\/list>/g;
    let listChap;
    while ((listChap = listRegex.exec(text)) !== null) {
        const listContent = listChap[1];

        const delimiters = [
            { open: "\\{", close: "\\}" },
            { open: "⟨", close: "⟩" },
            { open: "⟦", close: "⟧" },
            { open: "⟪", close: "⟫" },
            { open: "⟬", close: "⟭" },
            { open: "⌈", close: "⌋" },
            { open: "⌊", close: "⌉" },
            { open: "⌜", close: "⌟" },
            { open: "⌞", close: "⌝" },
        ];

        const openChars = delimiters
            .map((d) => d.open.replace("\\", ""))
            .join("");
        const allOpenPatterns = delimiters.map((d) => d.open).join("|");
        const dynamicRegex = new RegExp(
            `([^\\n${openChars}]+)(?:${allOpenPatterns})([\\s\\S]*?)(?:\\}|⟩|⟧|⟫|⟭|⌋|⌉|⌟|⌝)`,
            "g",
        );

        let match;
        while ((match = dynamicRegex.exec(listContent)) !== null) {
            let bodyContent = match[2].trim();
            if (bodyContent.startsWith("•")) {
                bodyContent = bodyContent.replace(/^•\s*/, "");
            }
            if (bodyContent.endsWith("•")) {
                bodyContent = bodyContent.replace(/\s*•$/, "");
            }
            chapters.push({
                title: match[1].trim(),
                body: bodyContent.trim(),
            });
        }
    }

    return { title: storyTitle, description, characters, chapters };
}

function buildMDTText(story) {
    let output = "";
    output += "<>" + story.title + "</>\n";
    output += "===========\n";
    output += "<info>\n" + cleanBlankLines(story.description) + "\n</info>\n";
    output += "===========\n";
    output += "[\n" + (story.characters || []).join("\n") + "\n]\n";
    output += "===========\n";
    output += "<list>\n";

    (story.chapters || []).forEach((ch) => {
        output += ch.title + "{\n" + cleanBlankLines(ch.body) + "\n}\n";
    });

    output += "</list>";
    return output;
}

function cleanBlankLines(str) {
    return String(str || "")
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .join("\n");
}

function renumberChapters(chapters) {
    chapters.forEach((ch, i) => {
        ch.title = ch.title.replace(/^\d+\.\s*/, "");
        ch.title = i + 1 + "." + ch.title;
    });
    return chapters;
}
