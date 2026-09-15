(function () {
    "use strict";

    var PROTOCOL_VERSION = 1;
    var MAX_HOPS = 20;
    var TIMEOUT_MS = 30000;
    var BRIDGE_TYPE_REQUEST = "NATIVE_BRIDGE_REQUEST";
    var BRIDGE_TYPE_RESPONSE = "NATIVE_BRIDGE_RESPONSE";

    function generateRequestId() {
        return (
            "req_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).substr(2, 9)
        );
    }

    function isCapacitorNative() {
        return (
            typeof Capacitor !== "undefined" &&
            (typeof Capacitor.isNativePlatform !== "function" ||
                Capacitor.isNativePlatform())
        );
    }

    function hasCapacitorPlugins() {
        return isCapacitorNative() && !!Capacitor.Plugins;
    }

    function hasFilesystem() {
        return hasCapacitorPlugins() && !!Capacitor.Plugins.Filesystem;
    }

    function hasFilePicker() {
        return hasCapacitorPlugins() && !!Capacitor.Plugins.FilePicker;
    }

    function isInIframe() {
        try {
            return window.parent && window.parent !== window;
        } catch (e) {
            return false;
        }
    }

    var pendingRequests = new Map();

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () {
                var result = reader.result;
                var base64 = result.split(",")[1] || result;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function base64ToFile(base64, name, type) {
        var raw = atob(String(base64).replace(/^data:[^;]+;base64/, ""));
        var bytes = Uint8Array.from(raw, function (char) {
            return char.charCodeAt(0);
        });
        return new File([bytes], name, {
            type: type || "application/octet-stream",
        });
    }

    function sendResponse(targetWindow, requestId, success, result, error) {
        var response = {
            type: BRIDGE_TYPE_RESPONSE,
            protocolVersion: PROTOCOL_VERSION,
            requestId: requestId,
            success: success,
            result: result,
            error: error,
        };
        try {
            targetWindow.postMessage(response, "*");
        } catch (e) {
            console.error("[NATIVE-BRIDGE][ERROR] Failed to send response:", e);
        }
    }

    function forwardToParent(request) {
        return new Promise(function (resolve, reject) {
            if (!isInIframe()) {
                reject(
                    new Error(
                        "[NATIVE-BRIDGE][ERROR] No parent window available",
                    ),
                );
                return;
            }
            var requestId = request.requestId;
            var timeout = setTimeout(function () {
                pendingRequests.delete(requestId);
                reject(new Error("[NATIVE-BRIDGE][TIMEOUT] Request timed out"));
            }, TIMEOUT_MS);
            pendingRequests.set(requestId, {
                resolve: resolve,
                reject: reject,
                timeout: timeout,
            });
            try {
                window.parent.postMessage(request, "*");
            } catch (e) {
                pendingRequests.delete(requestId);
                clearTimeout(timeout);
                reject(e);
            }
        });
    }
    async function nativeWriteFile(path, data, options) {
        options = options || {};
        if (!hasFilesystem()) {
            return { success: false, error: "Filesystem not available" };
        }
        await Capacitor.Plugins.Filesystem.writeFile({
            path: path,
            data: data,
            directory: options.directory || "Documents",
            encoding: options.encoding || "utf8",
        });
        return { success: true };
    }

    async function nativeAppendFile(path, data, options) {
        options = options || {};
        if (!hasFilesystem()) {
            return { success: false, error: "Filesystem not available" };
        }
        await Capacitor.Plugins.Filesystem.appendFile({
            path: path,
            data: data,
            directory: options.directory || "Documents",
            encoding: options.encoding || "utf8",
        });
        return { success: true };
    }

    async function nativeDownloadFile(blobOrBase64, name, contentType) {
        if (!hasFilesystem()) return false;

        let base64;

        if (typeof blobOrBase64 === "string") {
            base64 = blobOrBase64;
        } else {
            base64 = await blobToBase64(blobOrBase64);
        }

        console.log("[NATIVE-BRIDGE][DOWNLOAD] BEFORE FILESHARER", {
            name,
            contentType,
            base64Length: base64?.length,
        });

        try {
            const result = await Capacitor.Plugins.FileSharer.save({
                filename: name,
                contentType: contentType || "application/octet-stream",
                base64Data: base64,
                android: {
                    saveDirectory: "downloads",
                    relativePath: "Download/Export Novel",
                },
            });

            return result;
        } catch (err) {
            console.error("[NATIVE-BRIDGE][DOWNLOAD] FILESHARER FAILED", err);
            throw err;
        }
    }

    async function nativePickFile(options) {
        options = options || {};
        if (!hasFilePicker()) return null;
        var result = await Capacitor.Plugins.FilePicker.pickFiles({
            types: options.types || ["application/octet-stream"],
            multiple: false,
            readData: true,
        });
        var picked = result && result.files ? result.files[0] : null;
        if (!picked) return null;
        var data = picked.data
            ? picked.data
            : (
                  await Capacitor.Plugins.Filesystem.readFile({
                      path: picked.path,
                  })
              ).data;
        return base64ToFile(data, picked.name, picked.mimeType);
    }

    async function processRequest(request) {
        try {
            var result;
            switch (request.action) {
                case "writeFile":
                    result = await nativeWriteFile(
                        request.payload.path,
                        request.payload.data,
                        request.payload.options,
                    );
                    return result;
                case "appendFile":
                    result = await nativeAppendFile(
                        request.payload.path,
                        request.payload.data,
                        request.payload.options,
                    );
                    return result;
                case "downloadFile":
                case "save":
                    result = await nativeDownloadFile(
                        request.payload.blob,
                        request.payload.name,
                        request.payload.contentType,
                    );

                    return {
                        success: true,
                        result: result,
                    };
                case "pickFile":
                    result = await nativePickFile(request.payload.options);

                    return {
                        success: true,
                        result: {
                            file: result,
                        },
                    };
                case "isNative":
                    return { success: true, result: isCapacitorNative() };
                case "canPick":
                    return { success: true, result: hasFilePicker() };
                default:
                    return {
                        success: false,
                        error: "Unknown action: " + request.action,
                    };
            }
        } catch (err) {
            return {
                success: false,
                error: err.message || "Native execution error",
            };
        }
    }

    window.addEventListener("message", async function (event) {
        var data = event.data;
        if (!data || data.protocolVersion !== PROTOCOL_VERSION) return;

        if (data.type === BRIDGE_TYPE_RESPONSE) {
            var pending = pendingRequests.get(data.requestId);
            if (pending) {
                pendingRequests.delete(data.requestId);
                clearTimeout(pending.timeout);
                if (data.success) {
                    pending.resolve(data.result);
                } else {
                    pending.reject(
                        new Error(
                            data.error || "[NATIVE-BRIDGE][ERROR] Bridge error",
                        ),
                    );
                }
            }
            return;
        }

        if (data.type !== BRIDGE_TYPE_REQUEST) return;

        if (data.hop > MAX_HOPS) {
            sendResponse(
                event.source,
                data.requestId,
                false,
                null,
                "[NATIVE-BRIDGE][ERROR] Max hop count exceeded",
            );
            return;
        }

        if (!isInIframe() && hasCapacitorPlugins()) {
            var result = await processRequest(data);

            sendResponse(
                event.source,
                data.requestId,
                result.success,
                result.result,
                result.error,
            );

            return;
        }

        if (isInIframe()) {
            var forwardRequest = Object.assign({}, data, {
                hop: data.hop + 1,
            });

            try {
                var response = await forwardToParent(forwardRequest);

                sendResponse(event.source, data.requestId, true, response);
            } catch (err) {
                sendResponse(
                    event.source,
                    data.requestId,
                    false,
                    null,
                    err.message,
                );
            }

            return;
        }

        sendResponse(
            event.source,
            data.requestId,
            false,
            null,
            "[NATIVE-BRIDGE][ERROR] Native bridge not available",
        );
    });

    async function writeFile(path, data, options) {
        if (isInIframe()) {
            var request = {
                type: BRIDGE_TYPE_REQUEST,
                protocolVersion: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                action: "writeFile",
                payload: { path: path, data: data, options: options || {} },
                hop: 0,
            };
            return await forwardToParent(request);
        }
        if (hasFilesystem()) {
            return await nativeWriteFile(path, data, options);
        }

        return { success: false, error: "Filesystem not available" };
    }

    async function appendFile(path, data, options) {
        if (hasFilesystem()) {
            return await nativeAppendFile(path, data, options);
        }
        if (isInIframe()) {
            var request = {
                type: BRIDGE_TYPE_REQUEST,
                protocolVersion: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                action: "appendFile",
                payload: { path: path, data: data, options: options || {} },
                hop: 0,
            };
            return await forwardToParent(request);
        }
        return { success: false, error: "Filesystem not available" };
    }

    async function downloadFile(blob, name) {
        if (isInIframe()) {
            var base64 = await blobToBase64(blob);
            var request = {
                type: BRIDGE_TYPE_REQUEST,
                protocolVersion: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                action: "downloadFile",
                payload: { blob: base64, name: name },
                hop: 0,
            };
            return await forwardToParent(request);
        }
        if (hasCapacitorPlugins() && Capacitor.Plugins.FileSharer) {
            return await nativeDownloadFile(
                blob,
                name,
                blob?.type || "application/octet-stream",
            );
        }

        return false;
    }

    async function save(blob, name) {
        return await downloadFile(blob, name);
    }

    async function pickFile(options) {
        if (isInIframe()) {
            var request = {
                type: BRIDGE_TYPE_REQUEST,
                protocolVersion: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                action: "pickFile",
                payload: { options: options || {} },
                hop: 0,
            };
            var result = await forwardToParent(request);
            if (result && result.file) {
                return result.file;
            }
            return null;
        }
        if (hasFilePicker()) {
            return await nativePickFile(options);
        }

        return null;
    }

    function canPick() {
        if (hasFilePicker()) return true;
        if (isInIframe()) return true;
        return false;
    }

    function isNative() {
        return isCapacitorNative();
    }

    window.nativeBridge = {
        isNative: isNative,
        canPick: canPick,
        writeFile: writeFile,
        appendFile: appendFile,
        downloadFile: downloadFile,
        save: save,
        pickFile: pickFile,
        _protocol: {
            VERSION: PROTOCOL_VERSION,
            MAX_HOPS: MAX_HOPS,
            TIMEOUT_MS: TIMEOUT_MS,
        },
    };
})();
