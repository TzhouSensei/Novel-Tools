const status = document.getElementById("status");
const fileInput = document.getElementById("file");
const clearBtn = document.getElementById("clearFile");
const app = document.getElementById("app");

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function renderChapter(div, content, scrollContainer) {
    div.dataset.loaded = "1";
    div.textContent = "";
    const isEmpty = content.split(/\r?\n/).every((line) => {
        const t = line.trim();
        return t === "" || t === "•";
    });
    if (isEmpty) {
        div.classList.add("empty");
        ["•", t("reader.not_updated", "Chưa cập nhật"), "•"].forEach(
            (text, i) => {
                const span = document.createElement("span");
                span.className = i === 1 ? "empty-text" : "bullet";
                span.textContent = text;
                div.appendChild(span);
            },
        );
    } else {
        const lines = content.split(/\r?\n/);
        let html = "";
        lines.forEach((line, index) => {
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
        div.innerHTML = html;
        div.classList.add("chapter-content");
    }
}

function enableDetailsAnimation(details) {
    const content = details.querySelector(":scope > .content");
    if (!content) return;
    details.addEventListener("click", (e) => {
        const summary = e.target.closest("summary");
        if (!summary || summary.parentElement !== details) return;
        e.preventDefault();
        const isOpen = details.hasAttribute("open");
        if (!isOpen) {
            isAnimating = true;
            details.setAttribute("open", "");
            details.dispatchEvent(new Event("toggle"));
            content.style.maxHeight = "0px";
            requestAnimationFrame(() => {
                content.style.maxHeight = content.scrollHeight + "px";
                content.addEventListener("transitionend", function handler() {
                    content.style.maxHeight = "none";
                    isAnimating = false;
                    content.removeEventListener("transitionend", handler);
                });
            });
        } else {
            isAnimating = true;
            const startHeight = content.scrollHeight;
            content.style.maxHeight = startHeight + "px";
            requestAnimationFrame(() => {
                content.style.maxHeight = "0px";
            });
            function finishClose() {
                details.removeAttribute("open");
                details.dispatchEvent(new Event("toggle"));
                isAnimating = false;
                content.removeEventListener("transitionend", finishClose);
            }
            content.addEventListener("transitionend", finishClose);
            setTimeout(finishClose, 700);
        }
    });
}

document.getElementById("file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    status.textContent = t(
        "reader.status_loading",
        "📂 Đang tải file truyện...",
    );
    status.style.color = "#666";
    app.classList.add("fade-out");
    const reader = new FileReader();
    reader.onload = () => {
        setTimeout(() => {
            try {
                parseText(reader.result);
                hideIntro();
                slideInDetails();
                status.textContent = t(
                    "reader.status_success",
                    "✅ Tải thành công",
                );
                status.style.color = "green";
                document.querySelector("h2").style.display = "none";
                document.getElementById("chuy").style.display = "none";
                clearBtn.style.display = "inline-block";
                app.classList.remove("fade-out");
                app.classList.add("fade-in");
            } catch (err) {
                console.error(err);
                status.textContent = t(
                    "reader.status_error",
                    "❌ File lỗi hoặc sai format EPUB",
                );
                status.style.color = "red";
            }
        }, 160);
    };
    reader.readAsText(file, "utf-8");

    function parseText(text) {
        let outsideText = text;
        app.textContent = "";
        const STORAGE_KEY = "opened-chapters";
        const LAST_READ_KEY = "last-read-chapter";
        let chapterToScroll = null;
        const isTxtAutoSplit = !text.includes("<list>");

        if (isTxtAutoSplit) {
            const lines = text.split(/\r?\n/);

            // --- KIỂM TRA PHÂN CHIA THEO NHÁNH SPLITTER MỚI ---
            // Phát hiện các dòng chứa đường kẻ phân đoạn (hơn 3 ký tự liên tiếp tương đồng) hoặc viền khung ascii
            const isSplitterLine = (str) => {
                const trimmed = str.trim();
                if (
                    /^(\-+|=\+|★+|\*+|~+|\+|=)+$/.test(trimmed) &&
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

            // Gán chiến lược xử lý
            let strategy = "FALLBACK_KEYWORD";
            if (splitterCount >= 2 && hasAsciiBoxes) {
                strategy = "SPLITTER";
            } else {
                const nametester2 =
                    /^(?:(?:Chương|Hồi|Phần|Tập|Trận|Quyển|Bản|Kiếp|Chapter|Chap|Ch|Vol|Volume|Episode|Ep|Part|Section|Act|Глава|Часть|第|【|no\.?)? ?(?:[0-9一二三四五六七八九十万千两百零]+) ?[章节集回卷 phần chapter ]*[:\-.]?)|^(?:Ngoại truyện|Phiên ngoại|Vĩ thanh|Mở đầu|Tiền truyện|Lời mở đầu|Lời kết|Prologue|Epilogue|Side story|Extra|Bonus|Spin-off|Interlude|Afterword|Preface|Введение|Эпилог|Пролог|Послесловие|番外|序章|終章|외전|프롤로그|에필로그)/i;
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
            let storyTitle = file.name.replace(/\.[^/.]+$/, "");

            // --- THỰC THI NHÁNH PHÂN TÁCH CHƯƠNG THEO SPLITTER ---
            if (strategy === "SPLITTER") {
                let parsedBlocks = [];
                let currentBlock = [];

                // 1. Phân cắt mảng dòng dựa theo dòng Splitter và triệt tiêu dòng trống xung quanh splitter
                for (let i = 0; i < lines.length; i++) {
                    if (isSplitterLine(lines[i])) {
                        // Kiểm tra khoảng trống kề cận (trên dưới đều trống)
                        let hasPrevEmpty = i > 0 && lines[i - 1].trim() === "";
                        let hasNextEmpty =
                            i < lines.length - 1 && lines[i + 1].trim() === "";

                        if (hasPrevEmpty && hasNextEmpty) {
                            if (
                                currentBlock.length > 0 &&
                                currentBlock[currentBlock.length - 1].trim() ===
                                    ""
                            ) {
                                currentBlock.pop(); // Xoá dòng trống phía trên
                            }
                            if (currentBlock.length > 0) {
                                parsedBlocks.push(currentBlock);
                            }
                            currentBlock = [];
                            i++; // Bỏ qua dòng trống kế tiếp phía dưới
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

                // 2. Định dạng bóc tách và dọn sạch ASCII Box
                let processedBlocks = parsedBlocks.map((block, bIdx) => {
                    let contentStr = block.join("\n");

                    // Phát hiện Title Box dạng dấu ||
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
                            storyTitle = cleanTitle; // Cập nhật Title chính
                            finalTitleBoxStr = cleanTitle; // Lưu lại text gốc làm mô tả
                            return { type: "TITLE", text: cleanTitle };
                        }
                    }

                    // Phát hiện Info Box (Chứa các trường thông tin truyện dạng bảng phân cách | )
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

                    // Mặc định là khối text hoặc nội dung chương truyện
                    return { type: "CONTENT", text: block.join("\n").trim() };
                });

                // 3. Tiến hành gán Title Box vào Description (đã loại bỏ ASCII box) và tổ chức chương
                let descTextContent = "Chưa cập nhật";
                let infoBlock = processedBlocks.find((b) => b.type === "INFO");
                if (infoBlock) {
                    descTextContent = infoBlock.text;
                }
                if (finalTitleBoxStr) {
                    descTextContent =
                        finalTitleBoxStr + "\n\n" + descTextContent;
                }

                // Append phần tiêu đề câu chuyện lên giao diện chính
                const h1 = document.createElement("h1");
                h1.textContent =
                    storyTitle ||
                    t("reader.untitled_story", "Truyện không có tiêu đề");
                app.appendChild(h1);

                // Dựng giao diện hộp mô tả
                const descDetails = document.createElement("details");
                const descSummary = document.createElement("summary");
                descSummary.setAttribute(
                    "data-i18n",
                    "reader.description_title",
                );
                const descDiv = document.createElement("div");
                descDiv.className = "content";
                descDiv.innerText = descTextContent;
                descDetails.appendChild(descSummary);
                descDetails.appendChild(descDiv);
                enableDetailsAnimation(descDetails);
                app.appendChild(descDetails);

                // Giao diện danh sách nhân vật mặc định
                const charDetails = document.createElement("details");
                const charSummary = document.createElement("summary");
                charSummary.setAttribute("data-i18n", "reader.character_list");
                const charDiv = document.createElement("div");
                charDiv.className = "content";
                const ul = document.createElement("ul");
                const li = document.createElement("li");
                li.textContent = "Chưa cập nhật";
                ul.appendChild(li);
                charDiv.appendChild(ul);
                charDetails.appendChild(charSummary);
                charDetails.appendChild(charDiv);
                enableDetailsAnimation(charDetails);
                app.appendChild(charDetails);

                // Gom tất cả các blocks hợp lệ còn lại sau khối mô tả làm danh sách chương truyện
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
                // --- CÁC NHÁNH ĐỊNH DẠNG CŨ CỦA KHÔNG LIST (PURE_INDENT, HYBRID_MIXED, FLAT_BLOCK_KEYWORD) ---
                const h1 = document.createElement("h1");
                h1.textContent =
                    storyTitle ||
                    t("reader.untitled_story", "Truyện không có tiêu đề");
                app.appendChild(h1);

                const nametester2 =
                    /^(?:(?:Chương|Hồi|Phần|Tập|Trận|Quyển|Bản|Kiếp|Chapter|Chap|Ch|Vol|Volume|Episode|Ep|Part|Section|Act|Глава|Часть|第|【|no\.?)? ?(?:[0-9一二三四五六七八九十万千两百零]+) ?[章节集回卷 phần chapter ]*[:\-.]?)|^(?:Ngoại truyện|Phiên ngoại|Vĩ thanh|Mở đầu|Tiền truyện|Lời mở đầu|Lời kết|Prologue|Epilogue|Side story|Extra|Bonus|Spin-off|Interlude|Afterword|Preface|Введение|Эпилог|Пролог|Послесловие|番外|序章|終章|외전|프롤로그|에필로그)/i;
                const contentLineTester = /^([ \t\xA0\u2002\u2003\u2009]| )+/;

                if (strategy === "PURE_INDENT") {
                    let currentChapter = null;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const trimmed = line.trim();

                        if (trimmed === "") {
                            if (currentChapter)
                                currentChapter.bodyLines.push(line);
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
                                    title: t("reader.prologue", "Mở đầu"),
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
                            if (currentChapter)
                                currentChapter.bodyLines.push(line);
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
                                    title: t("reader.prologue", "Mở đầu"),
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
                            if (currentChapter)
                                currentChapter.bodyLines.push(line);
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
                                    title: t("reader.prologue", "Mở đầu"),
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
                                    if (subChapter)
                                        subChapter.bodyLines.push("");
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
                                    body: subChapter.bodyLines
                                        .join("\n")
                                        .trim(),
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
        } else {
            // --- NHÁNH ĐÃ CÓ SẴN THẺ <LIST> ---
            const titleMatch = text.match(/<>\s*([\s\S]*?)\s*<\/>/);
            if (titleMatch) {
                const h1 = document.createElement("h1");
                h1.textContent =
                    titleMatch[1].trim() ||
                    t("reader.untitled_story", "Truyện không có tiêu đề");
                app.appendChild(h1);
                text = text.replace(titleMatch[0], "");
            }

            const descMatch = text.match(/<info>\s*([\s\S]*?)\s*<\/info>/);
            let descriptionContent = "Chưa cập nhật";
            if (descMatch) {
                const cleaned = descMatch[1].trim();
                if (cleaned.length > 0) {
                    descriptionContent = cleaned;
                }
                text = text.replace(descMatch[0], "");
            }

            const descDetails = document.createElement("details");
            const descSummary = document.createElement("summary");
            descSummary.setAttribute("data-i18n", "reader.description_title");
            const descDiv = document.createElement("div");
            descDiv.className = "content";
            descDiv.textContent = descriptionContent;
            descDetails.appendChild(descSummary);
            descDetails.appendChild(descDiv);
            enableDetailsAnimation(descDetails);
            app.appendChild(descDetails);

            let characters = [];
            const listMatch = text.match(/\[\s*([\s\S]*?)\s*\]/);
            if (listMatch) {
                characters = listMatch[1]
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                text = text.replace(listMatch[0], "");
            }
            if (!characters.length) {
                characters = ["Chưa cập nhật"];
            }

            const charDetails = document.createElement("details");
            const charSummary = document.createElement("summary");
            charSummary.setAttribute("data-i18n", "reader.character_list");
            const charDiv = document.createElement("div");
            charDiv.className = "content";
            const ul = document.createElement("ul");
            characters.forEach((name) => {
                const li = document.createElement("li");
                li.textContent = name;
                ul.appendChild(li);
            });
            charDiv.appendChild(ul);
            charDetails.appendChild(charSummary);
            charDetails.appendChild(charDiv);
            enableDetailsAnimation(charDetails);
            app.appendChild(charDetails);
        }

        // --- RENDER DANH SÁCH CHƯƠNG ẢO (VIRTUAL SCROLL) ---
        const listRegex = /<list>([\s\S]*?)<\/list>/g;
        let listChap;
        while ((listChap = listRegex.exec(text)) !== null) {
            const listContent = listChap[1];
            const folder = document.createElement("details");
            const folderSummary = document.createElement("summary");
            folderSummary.setAttribute("data-i18n", "reader.chapter_list");
            const folderContent = document.createElement("div");
            folderContent.className = "content virtual-scroll";
            folder.appendChild(folderSummary);
            folder.appendChild(folderContent);
            enableDetailsAnimation(folder);
            app.appendChild(folder);

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

            const chapters = [];
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

            const ITEM_HEIGHT = 40;
            const EXPANDED_HEIGHT = 600;
            const BUFFER = 20;

            const openedItems = new Set();
            const renderedBodies = new Map();

            function getItemHeight(index) {
                return openedItems.has(index) ? EXPANDED_HEIGHT : ITEM_HEIGHT;
            }

            function getOffset(index) {
                let total = 0;
                for (let i = 0; i < index; i++) {
                    total += getItemHeight(i);
                }
                return total;
            }

            async function lazyRenderContent(container, chapter) {
                container.innerHTML = `
                    <div class="chapter-loading">
                        ${t("reader.chapter_loading", "Đang tải chương...")}
                    </div>
                `;
                await new Promise((resolve) => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, 100);
                    });
                });
                renderChapter(container, chapter.body, folderContent);
            }

            function saveOpened() {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify([...openedItems]),
                );
            }

            function loadOpened() {
                try {
                    return JSON.parse(
                        localStorage.getItem(STORAGE_KEY) || "[]",
                    );
                } catch {
                    return [];
                }
            }

            function createChapterItem(index) {
                const chapter = chapters[index];
                const details = document.createElement("details");
                details.className = "virtual-chapter";

                if (openedItems.has(index)) {
                    details.open = true;
                }

                const summary = document.createElement("summary");
                summary.textContent = chapter.isFallbackTitle
                    ? `${t("reader.chapter_prefix", "Chương")} ${chapter.fallbackIndex}`
                    : chapter.title;

                details.appendChild(summary);
                const content = document.createElement("div");
                content.className = "content";
                details.appendChild(content);

                if (openedItems.has(index)) {
                    if (renderedBodies.has(index)) {
                        content.innerHTML = renderedBodies.get(index);
                    } else {
                        lazyRenderContent(content, chapter).then(() => {
                            renderedBodies.set(index, content.innerHTML);
                        });
                    }
                }

                summary.addEventListener("click", async (e) => {
                    e.preventDefault();
                    if (openedItems.has(index)) {
                        openedItems.delete(index);
                        saveOpened();
                        renderVisible();
                        return;
                    }

                    openedItems.add(index);
                    localStorage.setItem(LAST_READ_KEY, index);
                    saveOpened();
                    renderVisible();

                    requestAnimationFrame(async () => {
                        const current = folderContent.querySelector(
                            `[data-chapter="${index}"] .content`,
                        );
                        if (!current) return;
                        await lazyRenderContent(current, chapter);
                        renderedBodies.set(index, current.innerHTML);
                    });
                });

                details.dataset.chapter = index;
                return details;
            }

            function renderVisible() {
                const scrollTop = folderContent.scrollTop;
                const viewportHeight = folderContent.clientHeight;
                folderContent.innerHTML = "";

                let start = 0;
                let offset = 0;
                while (start < chapters.length) {
                    const h = getItemHeight(start);
                    if (offset + h >= scrollTop) break;
                    offset += h;
                    start++;
                }

                let end = start;
                let visible = 0;
                while (
                    end < chapters.length &&
                    visible < viewportHeight + 2000
                ) {
                    visible += getItemHeight(end);
                    end++;
                }

                start = Math.max(0, start - BUFFER);
                end = Math.min(chapters.length, end + BUFFER);

                const top = document.createElement("div");
                top.className = "vs-spacer";
                top.style.height = getOffset(start) + "px";
                folderContent.appendChild(top);

                for (let i = start; i < end; i++) {
                    const item = createChapterItem(i);
                    item.style.minHeight = getItemHeight(i) + "px";
                    folderContent.appendChild(item);
                }

                const bottom = document.createElement("div");
                bottom.className = "vs-spacer";
                const totalHeight = getOffset(chapters.length);
                bottom.style.height = totalHeight - getOffset(end) + "px";
                folderContent.appendChild(bottom);
            }

            let scrollRAF = null;
            folderContent.addEventListener("scroll", () => {
                if (scrollRAF) return;
                scrollRAF = requestAnimationFrame(() => {
                    scrollRAF = null;
                    renderVisible();
                });
            });

            loadOpened().forEach((i) => openedItems.add(i));
            renderVisible();

            const lastRead = parseInt(localStorage.getItem(LAST_READ_KEY), 10);
            if (!isNaN(lastRead)) {
                requestAnimationFrame(() => {
                    folderContent.scrollTop = getOffset(lastRead);
                    renderVisible();
                });
            }
        }

        if (chapterToScroll) {
            setTimeout(() => {
                chapterToScroll.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }, 300);
        }
        requestAnimationFrame(() => {
            applyI18n();
        });
    }
});

function wrapSlideItems() {
    const chuy = document.getElementById("chuy");
    if (chuy && !chuy.dataset.wrapped) {
        chuy.dataset.wrapped = "1";
        [...chuy.children].forEach((el) => {
            const wrapper = document.createElement("div");
            wrapper.className = "slide-item show";
            wrapper.appendChild(el);
            chuy.appendChild(wrapper);
        });
    }
    document.querySelectorAll("#app > details").forEach((details) => {
        if (details.dataset.wrapped) return;
        details.dataset.wrapped = "1";
        const wrapper = document.createElement("div");
        wrapper.className = "slide-item show";
        details.parentNode.insertBefore(wrapper, details);
        wrapper.appendChild(details);
    });
}

clearBtn.addEventListener("click", () => {
    slideOutDetails();
    showIntro();
    fileInput.value = "";
    app.textContent = "";
    status.textContent = "";
    history.replaceState(null, "", location.pathname);
    app.classList.remove("fade-in");
    document.querySelector("h2").style.display = "block";
    document.getElementById("chuy").style.display = "block";
    clearBtn.style.display = "none";
});

function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        const value = t(key);
        el.innerHTML = value.replace(/\n/g, "<br>");
    });
}
