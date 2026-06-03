(function () {
    let box = null;
    let history = { find: [], replace: [] };
    let undoStack = [];
    let redoStack = [];
    let currentMatchIndex = -1;
    let matches = [];
    let isDragging = false;
    let dragStartX, dragStartY, boxStartX, boxStartY;

    const APP_DIV = document.getElementById("app");
    const STORAGE_KEY_FIND = "fnr_history_find";
    const STORAGE_KEY_REPLACE = "fnr_history_replace";

    function loadHistory() {
        try {
            history.find =
                JSON.parse(localStorage.getItem(STORAGE_KEY_FIND)) || [];
            history.replace =
                JSON.parse(localStorage.getItem(STORAGE_KEY_REPLACE)) || [];
        } catch (e) {
            history = { find: [], replace: [] };
        }
    }

    function saveHistory(type, value) {
        if (!value) return;
        let list = history[type];
        list = list.filter((item) => item !== value);
        list.unshift(value);
        if (list.length > 50) list.pop();
        history[type] = list;
        localStorage.setItem(
            type === "find" ? STORAGE_KEY_FIND : STORAGE_KEY_REPLACE,
            JSON.stringify(list),
        );
        updateHistoryDropdown(type);
    }

    function saveStateForUndo() {
        if (!APP_DIV) return;
        if (undoStack.length >= 30) undoStack.shift();
        undoStack.push(APP_DIV.innerHTML);
        redoStack = [];
    }

    function performUndo() {
        if (undoStack.length === 0 || !APP_DIV) return;
        redoStack.push(APP_DIV.innerHTML);
        APP_DIV.innerHTML = undoStack.pop();
        clearMatches();
        findMatches();
    }

    function performRedo() {
        if (redoStack.length === 0 || !APP_DIV) return;
        undoStack.push(APP_DIV.innerHTML);
        APP_DIV.innerHTML = redoStack.pop();
        clearMatches();
        findMatches();
    }

    function injectStyles() {
        if (document.getElementById("fnr-styles")) return;
        const style = document.createElement("style");
        style.id = "fnr-styles";
        style.innerHTML = `
            .fnr-box { position: fixed; top: 20px; right: 20px; width: 380px; background: #1e1e1e; color: #cccccc; border: 1px solid #454545; font-family: Segoe UI, sans-serif; font-size: 13px; z-index: 99999; box-shadow: 0 4px 10px rgba(0,0,0,0.5); user-select: none; border-radius: 4px; }
            .fnr-header { background: #2d2d2d; padding: 6px 10px; cursor: move; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #454545; font-weight: bold; }
            .fnr-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
            .fnr-row { display: flex; gap: 6px; align-items: center; position: relative; }
            .fnr-input-wrapper { flex: 1; position: relative; display: flex; align-items: center; }
            .fnr-input { width: 100%; background: #3c3c3c; color: #cccccc; border: 1px solid #3c3c3c; padding: 4px 24px 4px 6px; font-size: 13px; box-sizing: border-box; }
            .fnr-input:focus { border-color: #007acc; outline: none; }
            .fnr-dropdown-btn { position: absolute; right: 4px; background: transparent; border: none; color: #858585; cursor: pointer; padding: 2px; font-size: 10px; }
            .fnr-dropdown-btn:hover { color: #cccccc; }
            .fnr-select-list { position: absolute; top: 100%; left: 0; right: 0; background: #2d2d2d; border: 1px solid #454545; max-height: 150px; overflow-y: auto; z-index: 100000; display: none; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
            .fnr-select-item { padding: 4px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .fnr-select-item:hover { background: #007acc; color: #fff; }
            .fnr-radio-group { display: flex; gap: 10px; padding: 2px 0; }
            .fnr-radio-label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
            .fnr-radio-label input { margin: 0; cursor: pointer; }
            .fnr-btn-group { display: flex; gap: 4px; justify-content: flex-end; }
            .fnr-btn { background: #0e639c; color: #ffffff; border: none; padding: 4px 10px; cursor: pointer; font-size: 12px; border-radius: 2px; min-width: 60px; text-align: center; }
            .fnr-btn:hover { background: #1177bb; }
            .fnr-btn-secondary { background: #3a3a3a; color: #cccccc; }
            .fnr-btn-secondary:hover { background: #4a4a4a; }
            .fnr-counter { font-size: 11px; color: #858585; min-width: 40px; text-align: right; margin-right: 4px; }
            .fnr-match-hl { background-color: rgba(157, 180, 252, 0.3); border: 1px solid rgba(157, 180, 252, 0.5); border-radius: 1px; display: inline; }
            .fnr-match-hl-active { background-color: rgba(245, 124, 0, 0.6) !important; border: 1px solid #f57c00 !important; }
        `;
        document.head.appendChild(style);
    }

    function createBox() {
        if (box) return;
        injectStyles();
        loadHistory();

        box = document.createElement("div");
        box.className = "fnr-box";
        box.innerHTML = `
    <div class="fnr-header">
        <span data-i18n="edit.title"></span>
        <span style="cursor:pointer;" id="fnr-close-x">×</span>
    </div>

    <div class="fnr-body">

        <div class="fnr-row">
            <div class="fnr-input-wrapper">
                <input type="text" id="fnr-find-input" class="fnr-input" placeholder="Find">
                <button class="fnr-dropdown-btn" id="fnr-find-drop-btn">▼</button>
                <div class="fnr-select-list" id="fnr-find-list"></div>
            </div>

            <div class="fnr-counter" id="fnr-match-counter">0/0</div>

            <button class="fnr-btn fnr-btn-secondary"
                style="min-width:30px;padding:4px;"
                id="fnr-prev-btn"
                data-i18n="edit.opt.prev">
            </button>

            <button class="fnr-btn fnr-btn-secondary"
                style="min-width:30px;padding:4px;"
                id="fnr-next-btn"
                data-i18n="edit.opt.next">
            </button>
        </div>

        <div class="fnr-row">
            <div class="fnr-input-wrapper">
                <input type="text" id="fnr-replace-input" class="fnr-input" placeholder="Replace">
                <button class="fnr-dropdown-btn" id="fnr-replace-drop-btn">▼</button>
                <div class="fnr-select-list" id="fnr-replace-list"></div>
            </div>
        </div>

        <div class="fnr-radio-group">
            <label class="fnr-radio-label">
                <input type="radio" name="fnr-mode" value="all" checked>
                <span data-i18n="edit.opt.match.all"></span>
            </label>

            <label class="fnr-radio-label">
                <input type="radio" name="fnr-mode" value="around">
                <span data-i18n="edit.opt.match.around"></span>
            </label>

            <label class="fnr-radio-label">
                <input type="radio" name="fnr-mode" value="regex">
                <span data-i18n="edit.opt.regex"></span>
            </label>
        </div>

        <div class="fnr-btn-group">
            <button class="fnr-btn"
                id="fnr-replace-btn"
                data-i18n="edit.opt.replace">
            </button>

            <button class="fnr-btn"
                id="fnr-replace-all-btn"
                data-i18n="edit.opt.replace.all">
            </button>

            <button class="fnr-btn fnr-btn-secondary"
                id="fnr-cancel-btn"
                data-i18n="edit.opt.cancel">
            </button>
        </div>

    </div>
`;

        document.body.appendChild(box);
        initEvents();
        applyI18n(box);
        updateHistoryDropdown("find");
        updateHistoryDropdown("replace");
        document.getElementById("fnr-find-input").focus();
    }

    function updateHistoryDropdown(type) {
        const listContainer = document.getElementById(`fnr-${type}-list`);
        if (!listContainer) return;
        listContainer.innerHTML = "";
        history[type].forEach((val) => {
            const item = document.createElement("div");
            item.className = "fnr-select-item";
            item.innerText = val;
            item.addEventListener("click", () => {
                const input = document.getElementById(`fnr-${type}-input`);
                input.value = val;
                listContainer.style.display = "none";
                if (type === "find") findMatches();
            });
            listContainer.appendChild(item);
        });
    }

    function closeBox() {
        if (!box) return;
        clearMatches();
        box.remove();
        box = null;
    }

    function getSearchRegex(text, mode) {
        if (!text) return null;
        try {
            if (mode === "regex") {
                return new RegExp(text, "g");
            } else if (mode === "all") {
                let escaped = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
                return new RegExp("\\b" + escaped + "\\b", "g");
            } else if (mode === "around") {
                let chess = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
                return new RegExp(chess, "gi");
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    function clearMatches() {
        if (!APP_DIV) return;
        const highlighted = APP_DIV.querySelectorAll(".fnr-match-hl");
        highlighted.forEach((el) => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(
                    document.createTextNode(el.textContent),
                    el,
                );
                parent.normalize();
            }
        });
        matches = [];
        currentMatchIndex = -1;
        updateCounter();
    }

    function findMatches() {
        if (!APP_DIV || !box) return;
        clearMatches();

        const findValue = document.getElementById("fnr-find-input").value;
        if (!findValue) return;

        const mode = box.querySelector('input[name="fnr-mode"]:checked').value;
        const regex = getSearchRegex(findValue, mode);
        if (!regex) return;

        function highlightNodes(node) {
            if (node.nodeType === 3) {
                const text = node.nodeValue;
                let match;
                const fragments = [];
                let lastIndex = 0;

                while ((match = regex.exec(text)) !== null) {
                    if (match.index === regex.lastIndex) regex.lastIndex++;

                    fragments.push(
                        document.createTextNode(
                            text.substring(lastIndex, match.index),
                        ),
                    );

                    const span = document.createElement("span");
                    span.className = "fnr-match-hl";
                    span.textContent = match[0];
                    fragments.push(span);

                    lastIndex = regex.lastIndex;
                }

                if (fragments.length > 0) {
                    fragments.push(
                        document.createTextNode(text.substring(lastIndex)),
                    );
                    const parent = node.parentNode;
                    fragments.forEach((frag) =>
                        parent.insertBefore(frag, node),
                    );
                    parent.removeChild(node);
                }
            } else if (
                node.nodeType === 1 &&
                node.childNodes &&
                !node.classList.contains("fnr-match-hl") &&
                node.id !== "fnr-box"
            ) {
                for (let i = node.childNodes.length - 1; i >= 0; i--) {
                    highlightNodes(node.childNodes[i]);
                }
            }
        }

        highlightNodes(APP_DIV);
        matches = Array.from(APP_DIV.querySelectorAll(".fnr-match-hl"));
        if (matches.length > 0) {
            currentMatchIndex = 0;
            highlightActiveMatch();
        }
        updateCounter();
    }

    function highlightActiveMatch() {
        matches.forEach((el, index) => {
            if (index === currentMatchIndex) {
                el.classList.add("fnr-match-hl-active");
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                el.classList.remove("fnr-match-hl-active");
            }
        });
    }

    function updateCounter() {
        const counter = document.getElementById("fnr-match-counter");
        if (!counter) return;
        if (matches.length === 0) {
            counter.innerText = "0/0";
        } else {
            counter.innerText = `${currentMatchIndex + 1}/${matches.length}`;
        }
    }

    function navigateMatch(direction) {
        if (matches.length === 0) return;
        if (direction === "next") {
            currentMatchIndex = (currentMatchIndex + 1) % matches.length;
        } else {
            currentMatchIndex =
                (currentMatchIndex - 1 + matches.length) % matches.length;
        }
        highlightActiveMatch();
        updateCounter();
    }

    function replaceSingle() {
        if (currentMatchIndex === -1 || matches.length === 0) return;
        saveStateForUndo();

        const replaceValue = document.getElementById("fnr-replace-input").value;
        const findValue = document.getElementById("fnr-find-input").value;
        saveHistory("find", findValue);
        saveHistory("replace", replaceValue);

        const currentEl = matches[currentMatchIndex];
        const parent = currentEl.parentNode;
        if (parent) {
            const textNode = document.createTextNode(replaceValue);
            parent.replaceChild(textNode, currentEl);
            parent.normalize();
        }

        findMatches();
        if (matches.length > 0) {
            if (currentMatchIndex >= matches.length) {
                currentMatchIndex = 0;
            }
            highlightActiveMatch();
        }
    }

    function replaceAll() {
        const findValue = document.getElementById("fnr-find-input").value;
        if (!findValue) return;
        saveStateForUndo();

        const replaceValue = document.getElementById("fnr-replace-input").value;
        saveHistory("find", findValue);
        saveHistory("replace", replaceValue);

        const mode = box.querySelector('input[name="fnr-mode"]:checked').value;
        const regex = getSearchRegex(findValue, mode);
        if (!regex) return;

        function processReplaceAll(node) {
            if (node.nodeType === 3) {
                const text = node.nodeValue;
                if (regex.test(text)) {
                    regex.lastIndex = 0;
                    node.nodeValue = text.replace(regex, replaceValue);
                }
            } else if (
                node.nodeType === 1 &&
                node.childNodes &&
                node.id !== "fnr-box"
            ) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    processReplaceAll(node.childNodes[i]);
                }
            }
        }

        clearMatches();
        processReplaceAll(APP_DIV);
        findMatches();
    }

    function initEvents() {
        const header = box.querySelector(".fnr-header");
        header.addEventListener("mousedown", (e) => {
            if (e.target.id === "fnr-close-x") return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            boxStartX = box.offsetLeft;
            boxStartY = box.offsetTop;
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            box.style.left = `${boxStartX + (e.clientX - dragStartX)}px`;
            box.style.top = `${boxStartY + (e.clientY - dragStartY)}px`;
            box.style.right = "auto";
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
        });

        document
            .getElementById("fnr-close-x")
            .addEventListener("click", closeBox);
        document
            .getElementById("fnr-cancel-btn")
            .addEventListener("click", closeBox);

        const findInput = document.getElementById("fnr-find-input");
        findInput.addEventListener("input", findMatches);

        box.querySelectorAll('input[name="fnr-mode"]').forEach((radio) => {
            radio.addEventListener("change", findMatches);
        });

        document
            .getElementById("fnr-next-btn")
            .addEventListener("click", () => navigateMatch("next"));
        document
            .getElementById("fnr-prev-btn")
            .addEventListener("click", () => navigateMatch("prev"));
        document
            .getElementById("fnr-replace-btn")
            .addEventListener("click", replaceSingle);
        document
            .getElementById("fnr-replace-all-btn")
            .addEventListener("click", replaceAll);

        const toggleDropdown = (type) => {
            const list = document.getElementById(`fnr-${type}-list`);
            list.style.display =
                list.style.display === "block" ? "none" : "block";
        };

        document
            .getElementById("fnr-find-drop-btn")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                toggleDropdown("find");
            });
        document
            .getElementById("fnr-replace-drop-btn")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                toggleDropdown("replace");
            });

        document.addEventListener("click", () => {
            if (box) {
                document.getElementById("fnr-find-list").style.display = "none";
                document.getElementById("fnr-replace-list").style.display =
                    "none";
            }
        });
    }

    document.addEventListener("keydown", function (e) {
        if (
            e.altKey &&
            (e.key === "h" || e.key === "H" || e.key === "ó" || e.key === "Ó")
        ) {
            e.preventDefault();
            if (box) {
                document.getElementById("fnr-find-input").focus();
            } else {
                createBox();
            }
        }

        if (e.altKey && (e.key === "z" || e.key === "Z")) {
            e.preventDefault();
            performUndo();
        }

        if (e.altKey && (e.key === "y" || e.key === "Y")) {
            e.preventDefault();
            performRedo();
        }

        if (e.key === "Escape" && box) {
            closeBox();
        }
    });
})();
