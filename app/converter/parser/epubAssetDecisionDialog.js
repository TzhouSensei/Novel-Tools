export const ASSET_ACTIONS = {
    SKIP: "skip",
    CONTENT: "content",
    DESCRIPTION: "description",
};

const ACTION_LABELS = {
    [ASSET_ACTIONS.SKIP]: "Bỏ (loại bỏ)",
    [ASSET_ACTIONS.CONTENT]: "Thêm vào content parse",
    [ASSET_ACTIONS.DESCRIPTION]: "Thêm vào mô tả",
};

const ACTION_COLORS = {
    [ASSET_ACTIONS.SKIP]: "#ff6b6b",
    [ASSET_ACTIONS.CONTENT]: "#4ecdc4",
    [ASSET_ACTIONS.DESCRIPTION]: "#ffd93d",
};

const ACTION_ORDER = [
    ASSET_ACTIONS.SKIP,
    ASSET_ACTIONS.CONTENT,
    ASSET_ACTIONS.DESCRIPTION,
];

let activeDialog = null;

export const showAssetDecisionDialog = (flaggedFiles) => {
    return new Promise((resolve) => {
        if (!flaggedFiles || flaggedFiles.length === 0) {
            resolve(new Map());
            return;
        }

        if (activeDialog) {
            activeDialog.destroy();
        }

        const decisions = new Map();
        flaggedFiles.forEach((f) => {
            decisions.set(f.index, ASSET_ACTIONS.SKIP);
        });

        let currentIdx = 0;
        let isFastAction = false;
        const fastActionValue = { current: ASSET_ACTIONS.SKIP };

        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        const dialog = document.createElement("div");
        dialog.style.cssText = `
            background: #1b1e2b;
            color: #e8e8f0;
            border-radius: 16px;
            width: 90%;
            max-width: 760px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 24px 80px rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
        `;

        const header = document.createElement("div");
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.03);
        `;

        const headerTitle = document.createElement("div");
        headerTitle.style.cssText = "font-size: 15px; font-weight: 600;";
        headerTitle.innerHTML =
            '⚠️ <span style="color:#ffd93d">Phát hiện file có tham chiếu</span> (a / img / svg)';

        const headerProgress = document.createElement("div");
        headerProgress.style.cssText = `
            font-size: 13px;
            color: rgba(255,255,255,0.6);
            padding: 4px 12px;
            background: rgba(255,255,255,0.06);
            border-radius: 999px;
        `;

        header.appendChild(headerTitle);
        header.appendChild(headerProgress);
        dialog.appendChild(header);

        const body = document.createElement("div");
        body.style.cssText = `
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            min-height: 0;
        `;
        dialog.appendChild(body);

        const contentRow = document.createElement("div");
        contentRow.style.cssText = `
            display: flex;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        `;
        body.appendChild(contentRow);

        const fileListPanel = document.createElement("div");
        fileListPanel.style.cssText = `
            width: 260px;
            min-width: 200px;
            border-right: 1px solid rgba(255,255,255,0.08);
            overflow-y: auto;
            padding: 8px;
            background: rgba(0,0,0,0.15);
        `;
        contentRow.appendChild(fileListPanel);

        const previewPanel = document.createElement("div");
        previewPanel.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding: 12px;
            overflow: hidden;
        `;
        contentRow.appendChild(previewPanel);

        const previewTitle = document.createElement("div");
        previewTitle.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            color: rgba(255,255,255,0.8);
            padding: 4px 0 8px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            margin-bottom: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        previewPanel.appendChild(previewTitle);

        const previewBody = document.createElement("div");
        previewBody.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background: rgba(0,0,0,0.25);
            border-radius: 10px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 280px;
        `;
        previewPanel.appendChild(previewBody);

        const assetInfoBar = document.createElement("div");
        assetInfoBar.style.cssText = `
            display: flex;
            gap: 8px;
            padding: 8px 0 0;
            flex-wrap: wrap;
        `;
        previewPanel.appendChild(assetInfoBar);

        const actionSection = document.createElement("div");
        actionSection.style.cssText = `
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.02);
        `;
        body.appendChild(actionSection);

        const actionTitle = document.createElement("div");
        actionTitle.style.cssText = `
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            color: rgba(255,255,255,0.7);
        `;
        actionTitle.textContent = "Lựa chọn hành động cho file này:";
        actionSection.appendChild(actionTitle);

        const radioRow = document.createElement("div");
        radioRow.style.cssText = `
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        `;
        actionSection.appendChild(radioRow);

        const radioInputs = {};
        ACTION_ORDER.forEach((action) => {
            const label = document.createElement("label");
            label.style.cssText = `
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.03);
                transition: all 0.15s ease;
                color: ${ACTION_COLORS[action]};
            `;

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "asset-action";
            radio.value = action;
            radio.style.cssText = "accent-color: " + ACTION_COLORS[action];

            radio.addEventListener("change", handleRadioChange);

            label.appendChild(radio);
            label.appendChild(document.createTextNode(ACTION_LABELS[action]));
            radioRow.appendChild(label);
            radioInputs[action] = radio;
        });

        const fastActionRow = document.createElement("div");
        fastActionRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 16px;
            border-top: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.02);
            flex-wrap: wrap;
        `;
        body.appendChild(fastActionRow);

        const fastCheckLabel = document.createElement("label");
        fastCheckLabel.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            cursor: pointer;
            color: rgba(255,255,255,0.8);
            font-weight: 500;
        `;
        const fastCheck = document.createElement("input");
        fastCheck.type = "checkbox";
        fastCheck.style.cssText = "accent-color: #4ecdc4;";
        fastCheckLabel.appendChild(fastCheck);
        fastCheckLabel.appendChild(
            document.createTextNode("⚡ Fast action: áp dụng cho tất cả"),
        );
        fastActionRow.appendChild(fastCheckLabel);

        const fastSelect = document.createElement("select");
        fastSelect.style.cssText = `
            padding: 6px 10px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            color: #e8e8f0;
            border-radius: 8px;
            font-size: 13px;
            outline: none;
            cursor: pointer;
        `;
        ACTION_ORDER.forEach((action) => {
            const opt = document.createElement("option");
            opt.value = action;
            opt.textContent = ACTION_LABELS[action];
            fastSelect.appendChild(opt);
        });
        fastActionRow.appendChild(fastSelect);

        const applyAllBtn = document.createElement("button");
        applyAllBtn.textContent = "Áp dụng";
        applyAllBtn.style.cssText = `
            padding: 6px 14px;
            background: rgba(78,205,196,0.15);
            border: 1px solid rgba(78,205,196,0.4);
            color: #4ecdc4;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: none;
        `;
        applyAllBtn.onmouseenter = () => {
            applyAllBtn.style.background = "rgba(78,205,196,0.25)";
        };
        applyAllBtn.onmouseleave = () => {
            applyAllBtn.style.background = "rgba(78,205,196,0.15)";
        };
        fastActionRow.appendChild(applyAllBtn);

        const footer = document.createElement("div");
        footer.style.cssText = `
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0,0,0,0.2);
        `;
        dialog.appendChild(footer);

        const navButtons = document.createElement("div");
        navButtons.style.cssText = "display: flex; gap: 8px;";

        const prevBtn = document.createElement("button");
        prevBtn.textContent = "← Trước";
        prevBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            color: #e8e8f0;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        prevBtn.onmouseenter = () =>
            (prevBtn.style.background = "rgba(255,255,255,0.15)");
        prevBtn.onmouseleave = () =>
            (prevBtn.style.background = "rgba(255,255,255,0.08)");
        navButtons.appendChild(prevBtn);

        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Tiếp theo →";
        nextBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(78,205,196,0.15);
            border: 1px solid rgba(78,205,196,0.4);
            color: #4ecdc4;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
            font-weight: 500;
        `;
        nextBtn.onmouseenter = () =>
            (nextBtn.style.background = "rgba(78,205,196,0.25)");
        nextBtn.onmouseleave = () =>
            (nextBtn.style.background = "rgba(78,205,196,0.15)");
        navButtons.appendChild(nextBtn);

        footer.appendChild(navButtons);

        const dialogButtons = document.createElement("div");
        dialogButtons.style.cssText = "display: flex; gap: 8px;";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Hủy";
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(255,107,107,0.1);
            border: 1px solid rgba(255,107,107,0.3);
            color: #ff6b6b;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        cancelBtn.onmouseenter = () =>
            (cancelBtn.style.background = "rgba(255,107,107,0.2)");
        cancelBtn.onmouseleave = () =>
            (cancelBtn.style.background = "rgba(255,107,107,0.1)");
        dialogButtons.appendChild(cancelBtn);

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "✅ Xác nhận";
        confirmBtn.style.cssText = `
            padding: 8px 20px;
            background: rgba(78,205,196,0.2);
            border: 1px solid rgba(78,205,196,0.5);
            color: #4ecdc4;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        confirmBtn.onmouseenter = () =>
            (confirmBtn.style.background = "rgba(78,205,196,0.35)");
        confirmBtn.onmouseleave = () =>
            (confirmBtn.style.background = "rgba(78,205,196,0.2)");
        dialogButtons.appendChild(confirmBtn);

        footer.appendChild(dialogButtons);

        overlay.appendChild(dialog);

        const fileItemEls = [];

        const buildFileList = () => {
            fileListPanel.innerHTML = "";
            fileItemEls.length = 0;

            flaggedFiles.forEach((file, idx) => {
                const item = document.createElement("div");
                item.style.cssText = `
                    padding: 8px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 4px;
                    transition: all 0.15s ease;
                    border: 1px solid transparent;
                    background: transparent;
                    user-select: none;
                `;

                const fileName = document.createElement("div");
                fileName.style.cssText = `
                    font-size: 12.5px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.85);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                fileName.textContent =
                    file.relativePath || file.title || `File ${idx + 1}`;
                item.appendChild(fileName);

                const badgeRow = document.createElement("div");
                badgeRow.style.cssText = `
                    display: flex;
                    gap: 6px;
                    margin-top: 4px;
                    font-size: 11px;
                `;
                if (file.assetInfo?.hasLinks) {
                    const badge = document.createElement("span");
                    badge.textContent = `🔗 ${file.assetInfo.linkCount}`;
                    badge.style.cssText = `
                        padding: 1px 6px;
                        background: rgba(78,205,196,0.15);
                        border-radius: 4px;
                        color: #4ecdc4;
                    `;
                    badgeRow.appendChild(badge);
                }
                if (file.assetInfo?.hasImages || file.assetInfo?.hasSvg) {
                    const badge = document.createElement("span");
                    badge.textContent = `🖼️ ${file.assetInfo.imageCount}`;
                    badge.style.cssText = `
                        padding: 1px 6px;
                        background: rgba(255,217,61,0.15);
                        border-radius: 4px;
                        color: #ffd93d;
                    `;
                    badgeRow.appendChild(badge);
                }
                if (badgeRow.childNodes.length > 0) item.appendChild(badgeRow);

                item.addEventListener("mouseenter", () => {
                    if (currentIdx !== idx) {
                        item.style.background = "rgba(255,255,255,0.08)";
                    }
                });
                item.addEventListener("mouseleave", () => {
                    if (currentIdx !== idx) {
                        item.style.background = "transparent";
                    }
                });
                item.addEventListener("click", () => {
                    selectFile(idx);
                });

                fileItemEls.push({ el: item, idx });
                fileListPanel.appendChild(item);
            });
        };

        const renderPreview = (file) => {
            previewTitle.textContent = `${file.relativePath || file.title}`;

            const textPreview = (file.text || "").slice(0, 2000);
            previewBody.textContent = textPreview || "(Không có văn bản)";

            assetInfoBar.innerHTML = "";
            if (file.assetInfo?.hasLinks) {
                const badge = document.createElement("span");
                badge.style.cssText = `
                    padding: 3px 10px;
                    background: rgba(78,205,196,0.15);
                    border-radius: 6px;
                    font-size: 12px;
                    color: #4ecdc4;
                `;
                badge.textContent = `🔗 ${file.assetInfo.linkCount} liên kết`;
                assetInfoBar.appendChild(badge);
            }
            if (file.assetInfo?.hasImages || file.assetInfo?.hasSvg) {
                const badge = document.createElement("span");
                badge.style.cssText = `
                    padding: 3px 10px;
                    background: rgba(255,217,61,0.15);
                    border-radius: 6px;
                    font-size: 12px;
                    color: #ffd93d;
                `;
                badge.textContent = `🖼️ ${file.assetInfo.imageCount} hình ảnh/SVG`;
                assetInfoBar.appendChild(badge);
            }
            if (file.assetInfo?.hasLinks && file.assetInfo.links?.length > 0) {
                const linkList = document.createElement("div");
                linkList.style.cssText = `
                    width: 100%;
                    margin-top: 6px;
                    font-size: 11px;
                    color: rgba(255,255,255,0.5);
                    word-break: break-all;
                `;
                linkList.textContent =
                    "Links: " + file.assetInfo.links.join(" | ");
                assetInfoBar.appendChild(linkList);
            }
        };

        const highlightItem = (idx) => {
            fileItemEls.forEach(({ el, idx: i }) => {
                if (i === idx) {
                    const action =
                        decisions.get(flaggedFiles[i].index) ||
                        ASSET_ACTIONS.SKIP;
                    el.style.background = ACTION_COLORS[action] + "22";
                    el.style.borderColor = ACTION_COLORS[action] + "55";
                } else {
                    el.style.background = "transparent";
                    el.style.borderColor = "transparent";
                }
            });
        };

        function selectFile(idx) {
            if (idx < 0 || idx >= flaggedFiles.length) return;
            currentIdx = idx;
            const file = flaggedFiles[currentIdx];

            headerProgress.textContent = `File ${currentIdx + 1} / ${flaggedFiles.length}`;
            renderPreview(file);

            const currentAction =
                decisions.get(file.index) || ASSET_ACTIONS.SKIP;
            ACTION_ORDER.forEach((action) => {
                radioInputs[action].checked = action === currentAction;
            });

            highlightItem(currentIdx);

            prevBtn.disabled = currentIdx === 0;
            prevBtn.style.opacity = currentIdx === 0 ? "0.4" : "1";
            nextBtn.disabled = currentIdx === flaggedFiles.length - 1;
            nextBtn.style.opacity =
                currentIdx === flaggedFiles.length - 1 ? "0.4" : "1";
            nextBtn.textContent =
                currentIdx === flaggedFiles.length - 1
                    ? "Hoàn tất ✓"
                    : "Tiếp theo →";
        }

        function handleRadioChange() {
            const selectedAction = ACTION_ORDER.find(
                (a) => radioInputs[a].checked,
            );
            if (!selectedAction) return;

            const file = flaggedFiles[currentIdx];
            decisions.set(file.index, selectedAction);

            highlightItem(currentIdx);

            const item = fileItemEls[currentIdx]?.el;
            if (item) {
                const action = selectedAction;
                item.style.borderLeft = `3px solid ${ACTION_COLORS[action]}`;
            }
        }

        fastCheck.addEventListener("change", () => {
            isFastAction = fastCheck.checked;
            fastSelect.disabled = !isFastAction;
            fastSelect.style.opacity = isFastAction ? "1" : "0.5";
            applyAllBtn.style.display = isFastAction ? "inline-block" : "none";

            if (isFastAction) {
                fastActionValue.current = fastSelect.value;
            }
        });

        fastSelect.addEventListener("change", () => {
            fastActionValue.current = fastSelect.value;
        });

        applyAllBtn.addEventListener("click", () => {
            const action = fastSelect.value;
            flaggedFiles.forEach((f) => {
                decisions.set(f.index, action);
            });

            const currentAction = decisions.get(flaggedFiles[currentIdx].index);
            ACTION_ORDER.forEach((a) => {
                radioInputs[a].checked = a === currentAction;
            });
            highlightItem(currentIdx);

            fileItemEls.forEach(({ el, idx: i }) => {
                const fileAction = decisions.get(flaggedFiles[i].index);
                el.style.borderLeft = `3px solid ${ACTION_COLORS[fileAction]}`;
            });

            applyAllBtn.textContent = "✅ Đã áp dụng";
            setTimeout(() => {
                applyAllBtn.textContent = "Áp dụng";
            }, 1500);
        });

        prevBtn.addEventListener("click", () => {
            if (currentIdx > 0) selectFile(currentIdx - 1);
        });

        nextBtn.addEventListener("click", () => {
            if (isFastAction) {
                const action = fastSelect.value;
                flaggedFiles.forEach((f) => {
                    const existing = decisions.get(f.index);

                    if (!existing || existing === ASSET_ACTIONS.SKIP) {
                        decisions.set(f.index, action);
                    }
                });
                finishDialog();
                return;
            }
            if (currentIdx < flaggedFiles.length - 1) {
                selectFile(currentIdx + 1);
            } else {
                finishDialog();
            }
        });

        cancelBtn.addEventListener("click", () => {
            overlay.remove();
            activeDialog = null;
            resolve(decisions);
        });

        confirmBtn.addEventListener("click", () => {
            finishDialog();
        });

        function finishDialog() {
            if (isFastAction) {
                const action = fastSelect.value;
                flaggedFiles.forEach((f) => {
                    decisions.set(f.index, action);
                });
            }
            overlay.remove();
            activeDialog = null;
            resolve(decisions);
        }

        const escHandler = (e) => {
            if (e.key === "Escape") {
                overlay.remove();
                document.removeEventListener("keydown", escHandler);
                activeDialog = null;
                resolve(decisions);
            }
        };
        document.addEventListener("keydown", escHandler);

        buildFileList();

        fileItemEls.forEach(({ el, idx: i }) => {
            const fileAction = decisions.get(flaggedFiles[i].index);
            el.style.borderLeft = `3px solid ${ACTION_COLORS[fileAction]}`;
        });

        selectFile(0);

        document.body.appendChild(overlay);

        activeDialog = {
            destroy: () => {
                overlay.remove();
                document.removeEventListener("keydown", escHandler);
                activeDialog = null;
            },
        };
    });
};
